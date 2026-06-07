import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

import { useAuth } from '../context/AuthContext.jsx'



const defaultBannerStories = [
  { id: 'banner-1', title: 'Severino Perfume Tips', message: '' },
  { id: 'banner-2', title: 'Severino Inspiration', message: '' },
  { id: 'banner-3', title: 'Severino Stories', message: '' },
  { id: 'banner-4', title: 'Severino Scents', message: '' },
  { id: 'banner-5', title: 'Why Severino?', message: '' },
]

function Home() {
  const { user } = useAuth()

  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const bannerRef = useRef(null)
  const [bannerIndex, setBannerIndex] = useState(0)
  const [heroImage, setHeroImage] = useState('')
  const [bannerStories, setBannerStories] = useState(defaultBannerStories)
  const [featuredBanners, setFeaturedBanners] = useState([])
  const [openBannerStory, setOpenBannerStory] = useState(null)



  useEffect(() => {
    const loadHeroAndBanners = async () => {
      const [bannerImages, stories, hero, featured] = await Promise.all([
        api.banners().catch(() => []),
        api.bannerStories().catch(() => defaultBannerStories),
        api.heroImage().catch(() => ({ image: '' })),
        api.featuredBanners().catch(() => []),
      ])
      setHeroImage(hero?.image || '')
      setBannerStories(
        defaultBannerStories.map((item, index) => ({
          ...item,
          message: stories?.[index]?.message || '',
        }))
      )
      setBanners(
        bannerImages.length
          ? bannerImages.map((image, index) => ({
              title: defaultBannerStories[index]?.title || `Banner ${index + 1}`,
              image,
              message: stories?.[index]?.message || '',
            }))
          : []
      )
      setFeaturedBanners(
        (featured || [])
          .filter((b) => b?.image)
          .slice(0, 3)
          .map((b, idx) => ({
            id: b.id || `featured-${idx + 1}`,
            title: b.title || `Featured Banner ${idx + 1}`,
            image: b.image,
            message: b.message || '',
          }))
      )

    }
    loadHeroAndBanners()
  }, [])

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




  return (
    <section className="grid" style={{ gap: '32px' }}>
      <div
        className="hero"
        style={heroImage ? { '--hero-image': `url(${heroImage})` } : undefined}
      >
        <div className="hero-content">
          <div className="tag">Severino Collection</div>
          <h1 className="section-title">Scent stories crafted for calm confidence.</h1>
          <p className="section-subtitle">
            Discover a boutique line of fragrances with luxurious notes, created for everyday
            elegance. COD only, verified deliveries, and careful packaging for every order.
          </p>
          <div className="hero-actions">
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
            {banners.map((banner, index) => (
              <button
                key={banner.title}
                className="banner-card banner-card-button"
                type="button"
                aria-label={`Open ${banner.title}`}
                onClick={() =>
                  setOpenBannerStory({
                    title: bannerStories[index]?.title || banner.title,
                    message: bannerStories[index]?.message || '',
                  })
                }
                style={{
                  backgroundImage: `url(${banner.image})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundColor: '#f7f6f1',
                }}
              >
                <div className="banner-overlay banner-overlay--interactive" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid">
        <div>
          <h2 className="section-title">Explore the Shop</h2>
          <p className="section-subtitle">Browse new scents, find your signature, and build your collection.</p>
        </div>

        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <div className="tag">Curated for you</div>
            <div style={{ fontWeight: 700 }}>Severino Collection — always ready to discover.</div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a className="button" href="/shop">
              Shop All Scents
            </a>
            <a className="button secondary" href="/search">
              Search Products
            </a>
          </div>
        </div>

        {featuredBanners.length > 0 && (
          <div className="grid three" style={{ width: '100%' }}>
            {featuredBanners.map((banner, index) => (
              <button
                key={`${banner.id}-${index}`}
                type="button"
                className="card"
                style={{
                  padding: '0',
                  border: 'none',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#f7f6f1',
                }}
                onClick={() =>
                  setOpenBannerStory({
                    title: banner.title,
                    message: banner.message || '',
                  })
                }

                aria-label={`Open ${banner.title}`}
              >
                <div
                  style={{
                    height: '160px',
                    backgroundImage: `url(${banner.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
                <div style={{ padding: '14px 16px' }}>
                  <div className="tag">Featured Banner</div>
                  <div style={{ fontWeight: 800, marginTop: '8px' }}>{banner.title}</div>
                </div>
              </button>
            ))}
          </div>
        )}

      </div>

      {openBannerStory && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setOpenBannerStory(null)}
        >
          <div
            className="modal-card announcement-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-banner-story-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setOpenBannerStory(null)}
            >
              X
            </button>
            <div className="announcement-modal__badge">Severino Banner</div>
            <h2 id="home-banner-story-title" className="section-title" style={{ fontSize: '28px' }}>
              {openBannerStory.title}
            </h2>
            <p className="announcement-modal__message">
              {openBannerStory.message.trim() || 'No message yet for this banner.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default Home
