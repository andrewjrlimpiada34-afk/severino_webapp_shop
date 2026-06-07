import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'
import { buildCloudinarySrcSet } from '../lib/image.js'

function Search() {
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('all')
  const [category, setCategory] = useState('all')
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [cartModal, setCartModal] = useState({ open: false, product: null, quantity: 1 })

  const { user } = useAuth()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])

  const results = useMemo(() => {
    return items.filter((product) => {
      const matchesName = product.name.toLowerCase().includes(query.toLowerCase())
      const matchesNote =
        note === 'all' || product.notes.toLowerCase().includes(note.toLowerCase())
      const matchesCategory =
        category === 'all' || (product.category || 'Unisex') === category
      return matchesName && matchesNote && matchesCategory
    })
  }, [items, query, note, category])

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const data = await api.products()
        setItems(data)
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])

  useEffect(() => {
    setFavorites(getFavorites(user?.id))
  }, [user])

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Search Tab</h1>
        <p className="section-subtitle">
          Locate scents by name, note, or mood. Results update instantly.
        </p>
      </div>

      <div className="card grid two">
        <div>
          <div className="label">Search by Name</div>
          <input
            className="input"
            placeholder="Type a product name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div>
          <div className="label">Filter by Note</div>
          <select className="input" value={note} onChange={(event) => setNote(event.target.value)}>
            <option value="all">All notes</option>
            <option value="amber">Amber</option>
            <option value="musk">Musk</option>
            <option value="floral">Floral</option>
            <option value="citrus">Citrus</option>
            <option value="vanilla">Vanilla</option>
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
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading products...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="grid four">
        {results.map((product) => {

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
              <div>
                <strong>{product.name}</strong>
                <p className="section-subtitle">{product.notes}</p>
              </div>
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
                  <button
                    className="button ghost"
                    onClick={() => openAddToCartModal(product.id)}
                  >
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


export default Search
