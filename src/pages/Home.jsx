import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'

function Home() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const { user } = useAuth()
  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const bannerRef = useRef(null)
  const [bannerIndex, setBannerIndex] = useState(0)
  const [favorites, setFavorites] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const [data, bannerImages] = await Promise.all([
          api.products(),
          api.banners().catch(() => []),
        ])
        setItems(data)
        setBanners(
          bannerImages.length
            ? bannerImages.map((image, index) => ({ title: `Banner ${index + 1}`, image }))
            : []
        )
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

  useEffect(() => {
    if (!banners.length) return undefined
    const interval = setInterval(() => {
      setBannerIndex((prev) => {
        const next = (prev + 1) % banners.length
        const track = bannerRef.current
        if (track && track.firstElementChild) {
          const cardWidth = track.firstElementChild.offsetWidth || 0
          const gap = 16
          track.scrollTo({ left: (cardWidth + gap) * next, behavior: 'smooth' })
        }
        return next
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [banners.length])

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

  return (
    <section className="grid" style={{ gap: '32px' }}>
      <div className="hero">
        <div>
          <div className="tag">Severino Collection</div>
          <h1 className="section-title">Scent stories crafted for calm confidence.</h1>
          <p className="section-subtitle">
            Discover a boutique line of fragrances with luxurious notes, created for everyday
            elegance. COD only, verified deliveries, and careful packaging for every order.
          </p>
          <div style={{ marginTop: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a className="button" href="/shop">
              Explore Collection
            </a>
            {!user && (
              <a className="button secondary" href="/create-account">
                Create Account
              </a>
            )}
          </div>
        </div>
        <div className="hero-card hero-banner">
          <div className="banner-track" ref={bannerRef}>
            {banners.map((banner) => (
              <div
                key={banner.title}
                className="banner-card"
                style={{
                  backgroundImage: `url(${banner.image})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundColor: '#f7f6f1',
                }}
              >
                <div className="banner-overlay" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid">
        <div>
          <h2 className="section-title">Featured Scents</h2>
          <p className="section-subtitle">A refined lineup for every mood.</p>
        </div>
        {status.loading && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="loader" />
            Loading products...
          </div>
        )}
        {status.error && <div className="card">Error: {status.error}</div>}
        <div className="grid four">
          {items.slice(0, 8).map((product) => {
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
                    <button className="button ghost" onClick={() => addToCart(product.id)}>
                      Add
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Home
