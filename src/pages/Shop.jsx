import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'

function Shop() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const [category, setCategory] = useState('all')
  const [maxPrice, setMaxPrice] = useState(3500)
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [filtersOpen, setFiltersOpen] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])

  const filtered = useMemo(() => {
    const base = items.filter((product) =>
      product.name.toLowerCase().includes(query.toLowerCase())
    )

    const categoryFiltered =
      category === 'all'
        ? base
        : base.filter((product) => (product.category || 'Unisex') === category)

    const priceFiltered = categoryFiltered.filter((product) => product.price <= maxPrice)

    if (sort === 'price-low') {
      return [...priceFiltered].sort((a, b) => a.price - b.price)
    }
    if (sort === 'price-high') {
      return [...priceFiltered].sort((a, b) => b.price - a.price)
    }
    return priceFiltered
  }, [items, query, sort, maxPrice, category])

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

  const addToCart = async (productId) => {
    if (!user) {
      navigate('/login')
      return
    }
    try {
      const product = items.find((item) => item.id === productId)
      if (!product || product.stock <= 0) {
        setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
        return
      }
      const cart = await api.cart()
      const existing = cart.items.find((item) => item.productId === productId)
      const nextItems = existing
        ? cart.items.map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  quantity: Math.min(100, Math.min(product.stock, item.quantity + 1)),
                }
              : item
          )
        : [...cart.items, { productId, quantity: 1 }]
      await api.updateCart(nextItems)
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

  return (
    <section className="grid" style={{ gap: '28px' }}>
      <div>
        <h1 className="section-title">Shop the Collection</h1>
        <p className="section-subtitle">
          Full lineup of signature scents, inspired with luxurious brands.
        </p>
      </div>

      <div className="card">
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
              <option value="featured">Featured</option>
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
          <div>
            <div className="label">Max Price (₱{maxPrice})</div>
            <input
              className="input"
              type="range"
              min="1500"
              max="3500"
              step="100"
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
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
      <div className="grid four">
        {filtered.map((product) => {
          const isFav = favorites.includes(product.id)
          return (
            <article key={product.id} className="product-card">
              <div className="product-image">
                {product.imageUrls?.[0] || product.imageUrl ? (
                  <img
                    className="product-image-img"
                    src={product.imageUrls?.[0] || product.imageUrl}
                    alt={product.name}
                  />
                ) : (
                  <span>{product.name}</span>
                )}
              </div>
              <div>
                <strong>{product.name}</strong>
                <p className="section-subtitle">{product.notes}</p>
              </div>
              <div className="pill">{product.size}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <button className="button" onClick={() => addToCart(product.id)}>
                    Add
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default Shop
