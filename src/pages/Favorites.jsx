import StoreIcon from '../components/StoreIcon.jsx'
﻿import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { buildCloudinarySrcSet } from '../lib/image.js'
import { ProductGridSkeleton } from '../components/Skeleton.jsx'
import useInventoryStock from '../hooks/useInventoryStock.js'
import { withInventoryStock } from '../lib/inventoryStore.js'

function Favorites() {
  const [catalog, setItems] = useState([])
  const stocks = useInventoryStock()
  const items = useMemo(() => catalog.map((item) => withInventoryStock(item, stocks)), [catalog, stocks])
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
      {status.loading && <ProductGridSkeleton count={4} />}
      {status.error && <div className="card">Error: {status.error}</div>}
      {!status.loading && items.length === 0 && (
        <div className="card empty-state">
          You have no current favorite. Try our scents now!
        </div>
      )}
      {items.length > 0 && (
        <div className="grid four catalog-product-grid">
          {items.map((product) => (
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
                    className="icon-button favorited"
                    type="button"
                    onClick={() => {
                      toggleFavorite(product.id, user?.id)
                      setItems((prev) => prev.filter((item) => item.id !== product.id))
                    }}
                    aria-label="Remove favorite"
                  >
                    <StoreIcon name="heart" className="icon" fill="currentColor" />
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
