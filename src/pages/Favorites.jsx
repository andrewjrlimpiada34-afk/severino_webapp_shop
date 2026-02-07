import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Favorites() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const favs = getFavorites(user?.id)
        const products = await api.products()
        setItems(products.filter((p) => favs.includes(p.id)))
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [user])

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Favorites</h1>
        <p className="section-subtitle">Your saved scents.</p>
      </div>
      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading favorites...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      {!status.loading && items.length === 0 && (
        <div className="card empty-state">
          You have no current favorite. Try our scents now!
        </div>
      )}
      {items.length > 0 && (
        <div className="grid four">
          {items.map((product) => (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>₱{product.price.toLocaleString()}</span>
                <div className="product-actions">
                  <button
                    className="icon-button favorited"
                    type="button"
                    onClick={() => {
                      toggleFavorite(product.id, user?.id)
                      setItems((prev) => prev.filter((item) => item.id !== product.id))
                    }}
                    aria-label="Remove favorite"
                  >
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 20s-7-4.4-9-8.6C1.5 8 3.4 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.6 5 20.5 8 21 11.4 19 15.6 12 20 12 20Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    View
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Favorites
