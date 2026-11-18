import StoreIcon from '../components/StoreIcon.jsx'
import Modal from '../components/Modal.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import QuantityControl from '../components/QuantityControl.jsx'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'
import { buildCloudinarySrcSet, buildCloudinaryUrl } from '../lib/image.js'
import { DetailSkeleton } from '../components/Skeleton.jsx'
import { useActionAnimation } from '../context/useActionAnimation.js'
import MediaAttachmentField, { MediaAttachmentDisplay } from '../components/MediaAttachmentField.jsx'
import RatingStars from '../components/RatingStars.jsx'
import useInventoryStock from '../hooks/useInventoryStock.js'
import SpeechControls from '../components/SpeechControls.jsx'
import { withInventoryStock } from '../lib/inventoryStore.js'

function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { playActionAnimation } = useActionAnimation()
  const [productData, setProduct] = useState(null)
  const stocks = useInventoryStock()
  const product = useMemo(() => withInventoryStock(productData, stocks), [productData, stocks])
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '', success: '' })
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [reviewAttachment, setReviewAttachment] = useState(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [activeImage, setActiveImage] = useState('')
  const [isFav, setIsFav] = useState(false)
  const [cartQuantity, setCartQuantity] = useState(0)
  const [cartBusy, setCartBusy] = useState(false)
  const cartPending = useRef(false)

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '', success: '' })
        const [data, list] = await Promise.all([api.product(id), api.productReviews(id)])
        setProduct(data)
        setReviews(list)
        const first = data?.imageUrls?.[0] || data?.imageUrl || ''
        setActiveImage(first)
        setStatus({ loading: false, error: '', success: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message, success: '' })
      }
    }
    load()
  }, [id])

  useEffect(() => {
    setIsFav(getFavorites(user?.id).includes(id))
  }, [user, id])

  const [quantityModal, setQuantityModal] = useState({
    open: false,
    action: 'cart',
    quantity: 1,
  })

  const closeQuantityModal = () => {
    if (cartPending.current) return
    setQuantityModal({ open: false, action: 'cart', quantity: 1 })
  }

  const openAddToCartModal = async () => {
    if (cartPending.current) return
    if (product?.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      return
    }
    setStatus((prev) => ({ ...prev, error: '', success: '' }))
    setQuantityModal({ open: true, action: 'cart', quantity: 1 })
    cartPending.current = true
    setCartBusy(true)
    try {
      const cart = user ? await api.cart() : { items: [] }
      setCartQuantity(cart.items.filter((item) => item.productId === product.id || item.productId === product.legacyId).reduce((sum, item) => sum + item.quantity, 0))
    } catch (error) { setStatus((previous) => ({ ...previous, error: error.message })); setQuantityModal({ open: false, action: 'cart', quantity: 1 }) }
    finally { cartPending.current = false; setCartBusy(false) }
  }

  const openBuyNowModal = () => {
    if (product?.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      return
    }
    setStatus((prev) => ({ ...prev, error: '', success: '' }))
    setQuantityModal({ open: true, action: 'buy-now', quantity: 1 })
  }

  const addToCartWithQuantity = async () => {
    if (cartPending.current) return
    if (!user) {
      navigate('/login')
      return
    }
    if (!product || product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      closeQuantityModal()
      return
    }

    const desiredQty = Number(quantityModal.quantity) || 1
    const qtyToAdd = Math.max(1, Math.min(Math.max(0, Math.min(100, product.stock) - cartQuantity), desiredQty))

    cartPending.current = true
    setCartBusy(true)
    try {
      const cart = await api.cart()
      const existing = cart.items.find((item) => item.productId === product.id)
      const remaining = Math.min(100, product.stock) - (existing?.quantity || 0)
      setCartQuantity(existing?.quantity || 0)
      if (qtyToAdd > remaining || remaining < 1) throw new Error('Maximum stock reached. Review the quantity already in your cart.')
      const nextItems = existing
        ? cart.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.min(product.stock, Math.min(100, item.quantity + qtyToAdd)) }
              : item
          )
        : [...cart.items, { productId: product.id, quantity: qtyToAdd }]
      await api.updateCart(nextItems)
      setQuantityModal({ open: false, action: 'cart', quantity: 1 })
      setStatus((previous) => ({ ...previous, success: `${product.name} added to your cart.` }))
      playActionAnimation('cart')
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    } finally { cartPending.current = false; setCartBusy(false) }
  }


  const buyNowWithQuantity = () => {
    if (!product || product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      closeQuantityModal()
      return
    }

    const desiredQty = Number(quantityModal.quantity) || 1
    const quantity = Math.max(1, Math.min(100, Math.min(product.stock, desiredQty)))
    const directPurchase = {
      productId: product.id,
      quantity,
      createdAt: Date.now(),
    }

    if (!user) {
      localStorage.setItem('severino_pending_buy_now', JSON.stringify(directPurchase))
      sessionStorage.setItem('severino_post_login_redirect', '/checkout')
      closeQuantityModal()
      navigate('/login')
      return
    }

    localStorage.setItem(`severino_direct_checkout_${user.id}`, JSON.stringify(directPurchase))
    localStorage.removeItem(`checkout_selection_${user.id}`)
    closeQuantityModal()
    navigate('/checkout')
  }

  const submitReview = async (event) => {
    event.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    if (!reviewForm.comment.trim()) {
      setStatus((prev) => ({ ...prev, error: 'Please add a comment (min 3 chars).' }))
      return
    }
    try {
      setReviewSubmitting(true)
      setStatus((prev) => ({ ...prev, error: '', success: '' }))
      const uploadedMedia = reviewAttachment ? await api.uploadMedia(reviewAttachment) : null
      const data = await api.addReview(id, {
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
        attachment: uploadedMedia
          ? { url: uploadedMedia.url, mediaType: uploadedMedia.mediaType }
          : null,
      })
      setReviews((prev) => [data, ...prev])
      setReviewForm({ rating: 5, comment: '' })
      setReviewAttachment(null)
      setStatus((prev) => ({ ...prev, success: 'Review submitted.' }))
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    } finally {
      setReviewSubmitting(false)
    }
  }

  const removeReview = async (reviewId) => {
    try {
      await api.deleteReview(reviewId)
      setReviews((prev) => prev.filter((review) => review.id !== reviewId))
      setStatus((prev) => ({ ...prev, success: 'Review deleted.' }))
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    }
  }

  if (status.loading) {
    return <DetailSkeleton />
  }

  if (!product) {
    return <div className="card">Product not found.</div>
  }

  const average =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length

  return (
    <section className="grid product-detail-page" style={{ gap: '24px' }}>
      {status.error && <div className="card">Error: {status.error}</div>}
      {status.success && <div className="card">{status.success}</div>}

      <nav className="product-desktop-only product-detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="grid two product-detail-hero">
        <div className="card product-detail-gallery">
          <div className="product-image product-image--detail">
            {activeImage ? (
              <img
                className="product-image-img"
                src={activeImage}
                srcSet={buildCloudinarySrcSet(activeImage, [480, 640, 800, 1000, 1200])}
                sizes="(min-width: 1024px) 600px, (max-width: 768px) 90vw, 560px"
                alt={product.name}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span>{product.name}</span>
            )}
          </div>
          <div className="product-detail-previews">
            {(product.imageUrls || []).filter(Boolean).map((img, index) => (
              <button
                key={`${img}-${index}`}
                type="button"
                className="thumb"
                aria-label={`View ${product.name} image ${index + 1}`}
                aria-pressed={activeImage === img}
                style={{ backgroundImage: `url(${buildCloudinaryUrl(img, { width: 200 })})` }}
                onClick={() => setActiveImage(img)}
              />
            ))}
          </div>
        </div>
        <div className="card product-detail-summary">
          <div className="tag">{product.size}</div>
          <h1 className="section-title">{product.name}</h1>
          <a className="product-desktop-only product-detail-rating-link" href="#product-reviews">
            <span className="product-detail-rating-star" aria-hidden="true">★</span>
            {reviews.length ? `${average.toFixed(1)} / 5 · ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}` : 'Be the first to review'}
          </a>
          <p className="section-subtitle">{product.description || product.notes}</p>
          <SpeechControls text={`${product.name}. ${product.description || product.notes || ''}`} label="product description" />
          {product.notes && (
            <div className="product-desktop-only product-detail-notes">
              <div className="tag">Scent notes</div>
              <p>{product.notes}</p>
            </div>
          )}
          <p className="product-detail-price">₱{product.price.toLocaleString()}</p>
          {product.stock > 0 ? (
            <div className="pill">Stock: {product.stock}</div>
          ) : (
            <div className="pill out-stock">Out of Stock</div>
          )}
          <div className="product-detail-actions">
            <button className="button" disabled={product.stock <= 0} onClick={openBuyNowModal}>
              <StoreIcon name="bag" /> Buy Now
            </button>
            <button
              className="button secondary product-detail-actions__add"
              type="button"
              onClick={openAddToCartModal}
              disabled={product.stock <= 0}
              aria-label="Add to Cart"
              title="Add to Cart"
            >
              <StoreIcon name="cart" />
              <span>Add to Cart</span>
            </button>
            <button
              className={`icon-button ${isFav ? 'favorited' : ''}`}
              type="button"
              onClick={() => {
                if (!user) {
                  navigate('/login')
                  return
                }
                const next = toggleFavorite(product.id, user?.id)
                setIsFav(next.includes(product.id))
                if (!isFav && next.includes(product.id)) {
                  playActionAnimation('favorite')
                }
              }}
              aria-label="Favorite"
              aria-pressed={isFav}
              title="Favorite"
            >
              <StoreIcon name="heart" fill={isFav ? "currentColor" : "none"} />
            </button>
            <button className="button secondary product-detail-actions__back" onClick={() => navigate('/shop')}>
              <StoreIcon name="arrow" className="back-arrow" /> Back to Shop
            </button>
          </div>
          <p className="product-desktop-only product-detail-payment-note">Cash on delivery available</p>
        </div>
      </div>

      {quantityModal.open && product && (
        <Modal>
          <div className="modal-card" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={closeQuantityModal}
            >
              X
            </button>

            <div className="tag">
              {quantityModal.action === 'buy-now' ? 'Buy Now' : 'Add to Cart'}
            </div>
            <h2 className="section-title" style={{ fontSize: '28px', marginTop: '10px' }}>
              {product.name}
            </h2>
            <p className="section-subtitle">{product.stock > 0 ? 'Select quantity' : 'This item is now out of stock.'}</p>

            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
              <QuantityControl value={quantityModal.quantity} maximum={Math.max(0, Math.min(100, product.stock) - (quantityModal.action === 'cart' ? cartQuantity : 0))} disabled={cartBusy} onChange={(quantity) => setQuantityModal((previous) => ({ ...previous, quantity }))} />

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <button className="button secondary" type="button" onClick={closeQuantityModal}>
                  Cancel
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={cartBusy || product.stock <= 0 || (quantityModal.action === 'cart' && cartQuantity >= Math.min(100, product.stock))}
                  onClick={
                    quantityModal.action === 'buy-now'
                      ? buyNowWithQuantity
                      : addToCartWithQuantity
                  }
                >
                  {cartBusy ? 'Please wait…' : quantityModal.action === 'buy-now' ? 'Continue to Checkout' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <div className="grid two product-detail-reviews" id="product-reviews">
        <form className="card form product-detail-review-form" id="product-review-form" onSubmit={submitReview}>

          <div className="tag">Rate this scent</div>
          <div className="card product-detail-review-summary">
            <div className="label">Summary</div>
            <div className="section-subtitle">
              Average: {average.toFixed(1)} ★ · {reviews.length} review(s)
            </div>
            <div className="section-subtitle">
              {reviews.map((review) => review.userName || 'Customer').join(', ') || 'No reviews yet'}
            </div>
          </div>
          <RatingStars value={reviewForm.rating} onChange={(rating) => setReviewForm((prev) => ({ ...prev, rating }))} disabled={reviewSubmitting} />
          <div>
            <div className="label">Comment</div>
            <textarea
              className="input"
              rows="4"
              placeholder="Share your experience"
              value={reviewForm.comment}
              onChange={(event) =>
                setReviewForm((prev) => ({ ...prev, comment: event.target.value }))
              }
              required
            />
          </div>
          <MediaAttachmentField
            file={reviewAttachment}
            onChange={setReviewAttachment}
            disabled={reviewSubmitting}
            onError={(message) =>
              setStatus((prev) => ({ ...prev, error: message, success: '' }))
            }
          />
          <button className="button" type="submit" disabled={reviewSubmitting}>
            {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>

        <div className="card product-detail-review-list">
          <div className="tag">Reviews</div>
          {reviews.length === 0 && <p className="section-subtitle">No reviews yet.</p>}
          {reviews.length === 0 && <a className="product-desktop-only product-detail-write-review" href="#product-review-form">Share your first impression <span aria-hidden="true">↗</span></a>}
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <RatingStars value={review.rating} readOnly />
              <p>{review.comment}</p>
              <MediaAttachmentDisplay attachment={review.attachment} />
              {review.canDelete && (
                <button className="button ghost" type="button" onClick={() => removeReview(review.id)}>
                  Delete Review
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ProductDetail
