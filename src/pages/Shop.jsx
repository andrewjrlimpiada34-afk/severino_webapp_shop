import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'
import { buildCloudinarySrcSet } from '../lib/image.js'

function Shop() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('default')
  const [category, setCategory] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [filtersOpen, setFiltersOpen] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const base = normalizedQuery
      ? items.filter((product) => product.name.toLowerCase().includes(normalizedQuery))
      : items

    const categoryFiltered =
      category === 'all'
        ? base
        : base.filter((product) => (product.category || 'Unisex') === category)

    const minValue = minPrice === '' ? null : Number(minPrice)
    const maxValue = maxPrice === '' ? null : Number(maxPrice)
    const resolvedMin = Number.isFinite(minValue) ? minValue : Number.NEGATIVE_INFINITY
    const resolvedMax = Number.isFinite(maxValue) ? maxValue : Number.POSITIVE_INFINITY
    const priceFiltered = categoryFiltered.filter(
      (product) => product.price >= resolvedMin && product.price <= resolvedMax
    )

    if (sort === 'price-low') {
      return [...priceFiltered].sort((a, b) => a.price - b.price)
    }
    if (sort === 'price-high') {
      return [...priceFiltered].sort((a, b) => b.price - a.price)
    }
    if (sort === 'popularity') {
      return [...priceFiltered].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    }
    return priceFiltered
  }, [items, query, sort, maxPrice, minPrice, category])

  const loadProducts = async () => {
    try {
      setStatus({ loading: true, error: '' })
      const data = await api.products()
      setItems(data)
      setStatus({ loading: false, error: '' })
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    }
  }

  const [cartModal, setCartModal] = useState({ open: false, product: null, quantity: 1 })

  const openAddToCartModal = (productId) => {
    const product = items.find((item) => item.id === productId)
    if (!product || product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      return
    }
    setStatus((prev) => ({ ...prev, error: '' }))
    setCartModal({
      open: true,
      product,
      quantity: 1,
    })
  }

  const closeAddToCartModal = () => {
    setCartModal({ open: false, product: null, quantity: 1 })
  }

  const addToCartWithQuantity = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    const product = cartModal.product
    if (!product || product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      closeAddToCartModal()
      return
    }

    const desiredQty = Number(cartModal.quantity) || 1
    const qtyToAdd = Math.max(1, Math.min(100, Math.min(product.stock, desiredQty)))

    try {
      const cart = await api.cart()
      const existing = cart.items.find((item) => item.productId === product.id)
      const nextItems = existing
        ? cart.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.min(100, Math.min(product.stock, item.quantity + qtyToAdd)) }
              : item
          )
        : [...cart.items, { productId: product.id, quantity: qtyToAdd }]

      await api.updateCart(nextItems)
      closeAddToCartModal()
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    }
  }


  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    setFavorites(getFavorites(user?.id))
  }, [user])

  const maxQty = cartModal.product ? Math.min(100, cartModal.product.stock ?? 100) : 1

  return (
    <section className="grid shop-page">

      <div className="page-hero shop-hero">
        <div className="tag">Severino Collection</div>
        <h1 className="section-title">Shop the Collection</h1>
        <p className="section-subtitle">
          Full lineup of signature scents, inspired with luxurious brands.
        </p>
      </div>

      <div className="card shop-filter-card">
        <div className="filter-header">
          <div className="tag">Filters</div>
          <button
            className="button secondary filter-toggle"
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            {filtersOpen ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className={`grid three filter-body ${filtersOpen ? 'open' : ''}`}>
          <div>
            <div className="label">Search</div>
            <input
              className="input"
              placeholder="Search by name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div>
            <div className="label">Sort</div>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="default">Default</option>
              <option value="popularity">Popularity</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
          <div>
            <div className="label">Category</div>
            <select
              className="input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All</option>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Unisex">Unisex</option>
            </select>
          </div>
          <div className="price-range">
            <div>
              <div className="label">Min. Price</div>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="0"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
              />
            </div>
            <div>
              <div className="label">Max. Price</div>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="3500"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading products...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="grid four shop-product-grid">
        {filtered.map((product) => {
          const isFav = favorites.includes(product.id)
          return (
            <article key={product.id} className="product-card">


              <div className="product-image">
                {product.imageUrls?.[0] || product.imageUrl ? (
                  <img
                    className="product-image-img"
                    src={product.imageUrls?.[0] || product.imageUrl}
                    srcSet={buildCloudinarySrcSet(product.imageUrls?.[0] || product.imageUrl)}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span>{product.name}</span>
                )}
              </div>
              <div className="product-copy">
                <strong>{product.name}</strong>
                <p className="section-subtitle">{product.notes}</p>
              </div>
              <div className="pill">{product.size}</div>
              <div className="product-card-footer">
                <span>₱{product.price.toLocaleString()}</span>
                <div className="product-actions">
                  <button
                    className={`icon-button ${isFav ? 'favorited' : ''}`}
                    type="button"
                    onClick={() => {
                      if (!user) {
                        navigate('/login')
                        return
                      }
                      const next = toggleFavorite(product.id, user?.id)
                      setFavorites(next)
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
                  <button className="button secondary" onClick={() => navigate(`/product/${product.id}`)}>
                    View
                  </button>
                  <button className="button" onClick={() => openAddToCartModal(product.id)}>
                    Add
                  </button>

                </div>
              </div>
            </article>
          )
        })}
      </div>

      {cartModal.open && cartModal.product && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={closeAddToCartModal}
            >
              X
            </button>

            <div className="tag">Add to Cart</div>
            <h2 className="section-title" style={{ fontSize: '28px', marginTop: '10px' }}>
              {cartModal.product.name}
            </h2>
            <p className="section-subtitle">Select quantity</p>

            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
              <div>
                <div className="label">Quantity</div>
                <select
                  className="input"
                  value={cartModal.quantity}
                  onChange={(e) =>
                    setCartModal((prev) => ({ ...prev, quantity: Number(e.target.value) }))
                  }
                >
                  {Array.from({ length: maxQty }, (_, i) => i + 1).map((qty) => (
                    <option key={qty} value={qty}>
                      {qty}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="button secondary" type="button" onClick={closeAddToCartModal}>
                  Cancel
                </button>
                <button className="button" type="button" onClick={addToCartWithQuantity}>
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}


export default Shop
