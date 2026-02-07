import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'

function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '', success: '' })
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [activeImage, setActiveImage] = useState('')
  const [isFav, setIsFav] = useState(false)

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

  const addToCart = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      return
    }
    try {
      const cart = await api.cart()
      const existing = cart.items.find((item) => item.productId === product.id)
      const nextItems = existing
        ? cart.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.min(product.stock, Math.min(100, item.quantity + 1)) }
              : item
          )
        : [...cart.items, { productId: product.id, quantity: 1 }]
      await api.updateCart(nextItems)
      setStatus((prev) => ({ ...prev, success: 'Added to cart.' }))
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    }
  }

  const buyNow = async () => {
    if (!user) {
      const pending = JSON.parse(localStorage.getItem('severino_pending_buy_now') || '[]')
      const next = Array.from(new Set([...pending, id]))
      localStorage.setItem('severino_pending_buy_now', JSON.stringify(next))
      sessionStorage.setItem('severino_post_login_redirect', '/checkout')
      navigate('/login')
      return
    }
    if (product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      return
    }
    try {
      const cart = await api.cart()
      const existing = cart.items.find((item) => item.productId === product.id)
      const nextItems = existing
        ? cart.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.min(100, Math.min(product.stock, item.quantity + 1)) }
              : item
          )
        : [...cart.items, { productId: product.id, quantity: 1 }]
      await api.updateCart(nextItems)
      const selectionKey = `checkout_selection_${user.id}`
      localStorage.setItem(selectionKey, JSON.stringify([product.id]))
      navigate('/checkout')
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    }
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
      const data = await api.addReview(id, {
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      })
      setReviews((prev) => [data, ...prev])
      setReviewForm({ rating: 5, comment: '' })
      setStatus((prev) => ({ ...prev, success: 'Review submitted.' }))
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
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
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="loader" />
        Loading product...
      </div>
    )
  }

  if (!product) {
    return <div className="card">Product not found.</div>
  }

  const average =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length

  return (
    <section className="grid" style={{ gap: '24px' }}>
      {status.error && <div className="card">Error: {status.error}</div>}
      {status.success && <div className="card">{status.success}</div>}

      <div className="grid two">
        <div className="card">
          <div className="product-image product-image--detail">
            {activeImage ? (
              <img className="product-image-img" src={activeImage} alt={product.name} />
            ) : (
              <span>{product.name}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            {(product.imageUrls || []).filter(Boolean).map((img) => (
              <button
                key={img}
                type="button"
                className="thumb"
                style={{ backgroundImage: `url(${img})` }}
                onClick={() => setActiveImage(img)}
              />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="tag">{product.size}</div>
          <h1 className="section-title">{product.name}</h1>
          <p className="section-subtitle">{product.description || product.notes}</p>
          <p>₱{product.price.toLocaleString()}</p>
          {product.stock > 0 ? (
            <div className="pill">Stock: {product.stock}</div>
          ) : (
            <div className="pill out-stock">Out of Stock</div>
          )}
          <div className="product-actions product-actions--wrap" style={{ marginTop: '16px' }}>
            <button className="button" onClick={addToCart}>
              Add to Cart
            </button>
            <button className="button secondary" onClick={buyNow}>
              Buy Now
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
              }}
              aria-label="Favorite"
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20s-7-4.4-9-8.6C1.5 8 3.4 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.6 5 20.5 8 21 11.4 19 15.6 12 20 12 20Z"
                  fill={isFav ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="button secondary" onClick={() => navigate('/shop')}>
              Back to Shop
            </button>
          </div>
        </div>
      </div>

      <div className="grid two">
        <form className="card form" onSubmit={submitReview}>
          <div className="tag">Rate this scent</div>
          <div className="card">
            <div className="label">Summary</div>
            <div className="section-subtitle">
              Average: {average.toFixed(1)} ★ · {reviews.length} review(s)
            </div>
            <div className="section-subtitle">
              {reviews.map((review) => review.userName || 'Customer').join(', ') || 'No reviews yet'}
            </div>
          </div>
          <div>
            <div className="label">Rating</div>
            <div className="star-row large">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`star ${Number(reviewForm.rating) >= value ? 'active' : ''}`}
                  onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
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
          <button className="button" type="submit">
            Submit Review
          </button>
        </form>

        <div className="card">
          <div className="tag">Reviews</div>
          {reviews.length === 0 && <p className="section-subtitle">No reviews yet.</p>}
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="star-row readonly large">
                {[1, 2, 3, 4, 5].map((value) => (
                  <span key={value} className={`star ${review.rating >= value ? 'active' : ''}`}>
                    ★
                  </span>
                ))}
              </div>
              <p>{review.comment}</p>
              {user?.id === review.userId && (
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
