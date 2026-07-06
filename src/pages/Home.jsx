import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import AdaptiveScentFloating from '../components/AdaptiveScentFloating.jsx'
import HomeScrollVideo from '../components/HomeScrollVideo.jsx'
import useAdaptiveScent from '../hooks/useAdaptiveScent.js'

import { useAuth } from '../context/AuthContext.jsx'



const defaultBannerStories = [
  { id: 'banner-1', title: 'Severino Perfume Tips', message: '' },
  { id: 'banner-2', title: 'Severino Inspiration', message: '' },
  { id: 'banner-3', title: 'Severino Stories', message: '' },
  { id: 'banner-4', title: 'Severino Scents', message: '' },
  { id: 'banner-5', title: 'Why Severino?', message: '' },
]

const SHOW_HOME_SCROLL_VIDEO = false
const facebookDesktopHeight = 460
const facebookMobileHeight = 620
const facebookPageUrl = import.meta.env.VITE_FACEBOOK_PAGE_URL || 'https://www.facebook.com/uver.guevara.9'
const facebookPluginUrlDesktop = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
  facebookPageUrl
)}&tabs=timeline&width=500&height=${facebookDesktopHeight}&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`

function getFacebookPluginUrl(width) {
  return `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
    facebookPageUrl
  )}&tabs=timeline&width=${width}&height=${facebookMobileHeight}&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`
}

function Home() {
  const { user } = useAuth()

  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const bannerRailRef = useRef(null)
  const featuredRailRef = useRef(null)
  const facebookEmbedFrameRef = useRef(null)
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [heroImage, setHeroImage] = useState('')
  const [bannerStories, setBannerStories] = useState(defaultBannerStories)
  const [featuredBanners, setFeaturedBanners] = useState([])
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0)
  const [adaptiveProducts, setAdaptiveProducts] = useState([])
  const [openBannerStory, setOpenBannerStory] = useState(null)
  const [facebookMobileWidth, setFacebookMobileWidth] = useState(320)
  const adaptive = useAdaptiveScent(adaptiveProducts)



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
    if (featuredBanners.length <= 1) return undefined
    const interval = setInterval(() => {
      setActiveFeaturedIndex((prev) => {
        const next = (prev + 1) % featuredBanners.length
        scrollToFeaturedBanner(next)
        return next
      })
    }, 5200)
    return () => clearInterval(interval)
  }, [featuredBanners.length])

  useEffect(() => {
    if (banners.length <= 1) return undefined
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => {
        const next = (prev + 1) % banners.length
        scrollToBanner(next)
        return next
      })
    }, 4400)
    return () => clearInterval(interval)
  }, [banners.length])

  useEffect(() => {
    if (!adaptive.enabled || adaptiveProducts.length) return
    api.products().then(setAdaptiveProducts).catch(() => setAdaptiveProducts([]))
  }, [adaptive.enabled, adaptiveProducts.length])

  useEffect(() => {
    const frame = facebookEmbedFrameRef.current
    if (!frame) return undefined

    const updateFacebookWidth = () => {
      if (window.innerWidth > 768) return
      const rect = frame.getBoundingClientRect()
      const nextWidth = Math.max(180, Math.min(500, Math.floor(rect.width)))
      setFacebookMobileWidth((prev) => (prev === nextWidth ? prev : nextWidth))
      window.FB?.XFBML?.parse?.()
    }

    updateFacebookWidth()
    const observer = new ResizeObserver(updateFacebookWidth)
    observer.observe(frame)
    window.addEventListener('resize', updateFacebookWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateFacebookWidth)
    }
  }, [])

  const handleBannerRailScroll = () => {
    const track = bannerRailRef.current
    if (!track || !track.firstElementChild) return
    const firstCard = track.firstElementChild
    const cardWidth = firstCard.getBoundingClientRect().width
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || '0') || 0
    const nextIndex = Math.round(track.scrollLeft / Math.max(cardWidth + gap, 1))
    setActiveBannerIndex(Math.max(0, Math.min(banners.length - 1, nextIndex)))
  }

  const scrollToBanner = (index) => {
    const track = bannerRailRef.current
    const card = track?.children?.[index]
    if (!track || !card) return
    track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
    setActiveBannerIndex(index)
  }

  const handleFeaturedRailScroll = () => {
    const track = featuredRailRef.current
    if (!track || !track.firstElementChild) return
    const firstCard = track.firstElementChild
    const cardWidth = firstCard.getBoundingClientRect().width
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || '0') || 0
    const nextIndex = Math.round(track.scrollLeft / Math.max(cardWidth + gap, 1))
    setActiveFeaturedIndex(Math.max(0, Math.min(featuredBanners.length - 1, nextIndex)))
  }

  const scrollToFeaturedBanner = (index) => {
    const track = featuredRailRef.current
    const card = track?.children?.[index]
    if (!track || !card) return
    track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
    setActiveFeaturedIndex(index)
  }

  const goToFeaturedBanner = (direction) => {
    if (!featuredBanners.length) return
    const next = (activeFeaturedIndex + direction + featuredBanners.length) % featuredBanners.length
    scrollToFeaturedBanner(next)
  }

  return (
    <section className="grid home-page">
      {SHOW_HOME_SCROLL_VIDEO && <HomeScrollVideo />}

      <div
        className="hero home-hero"
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
      </div>

      <AdaptiveScentFloating
        adaptive={adaptive}
        recommendationsLimit={3}
        onViewProduct={(productId) => navigate(`/product/${productId}`)}
      />

      {banners.length > 0 && (
        <section className="home-banner-rail" aria-label="Homepage banner stories">
          <div
            className="home-banner-rail__track"
            ref={bannerRailRef}
            onScroll={handleBannerRailScroll}
          >
            {banners.map((banner, index) => (
              <button
                key={banner.title}
                className="home-banner-card"
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
                }}
              />
            ))}
          </div>
          <div className="home-banner-dots" aria-label="Banner slider pages">
            {banners.map((banner, index) => (
              <button
                key={`${banner.title}-dot`}
                className={`home-banner-dot ${activeBannerIndex === index ? 'active' : ''}`}
                type="button"
                aria-label={`Show banner ${index + 1}`}
                aria-current={activeBannerIndex === index ? 'true' : undefined}
                onClick={() => scrollToBanner(index)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid home-shop-section">
        <div className="home-section-heading">
          <h2 className="section-title">Explore the Shop</h2>
          <p className="section-subtitle">Browse new scents, find your signature, and build your collection.</p>
        </div>

        <div className="card home-shop-card">
          <div className="home-shop-card__copy">
            <div className="tag">Curated for you</div>
            <div className="home-shop-card__title">Severino Collection - always ready to discover.</div>
          </div>
          <div className="home-shop-icon-actions">
            <a className="button home-shop-icon-button" href="/shop" aria-label="Shop all scents" title="Shop all scents">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6h14l-1.6 7.5a2 2 0 0 1-2 1.5H9.2a2 2 0 0 1-2-1.5L5.4 4.5H3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="19" r="1.4" fill="currentColor" />
                <circle cx="17" cy="19" r="1.4" fill="currentColor" />
              </svg>
            </a>
            <a className="button secondary home-shop-icon-button" href="/search" aria-label="Search products" title="Search products">
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M16.5 16.5L21 21"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </a>
          </div>
        </div>

        {featuredBanners.length > 0 && (
          <section className="featured-banner-slider" aria-label="Featured banner slider">
            <div className="featured-banner-slider__viewport">
              {featuredBanners.length > 1 && (
                <>
                  <button
                    className="featured-banner-arrow featured-banner-arrow--prev"
                    type="button"
                    aria-label="Previous featured banner"
                    onClick={() => goToFeaturedBanner(-1)}
                  >
                    ‹
                  </button>
                  <button
                    className="featured-banner-arrow featured-banner-arrow--next"
                    type="button"
                    aria-label="Next featured banner"
                    onClick={() => goToFeaturedBanner(1)}
                  >
                    ›
                  </button>
                </>
              )}
              <div
                className="featured-banner-slider__track"
                ref={featuredRailRef}
                onScroll={handleFeaturedRailScroll}
              >
                {featuredBanners.map((banner, index) => (
                  <button
                    key={`${banner.id}-${index}`}
                    type="button"
                    className={`card featured-banner-card featured-banner-slide ${
                      activeFeaturedIndex === index ? 'active' : ''
                    }`}
                    onClick={() =>
                      setOpenBannerStory({
                        title: banner.title,
                        message: banner.message || '',
                      })
                    }
                    aria-label={`Open ${banner.title}`}
                  >
                    <div
                      className="featured-banner-slide__image"
                      style={{
                        backgroundImage: `url(${banner.image})`,
                      }}
                    />
                    <div className="featured-banner-card__content">
                      <div className="tag">Featured Banner</div>
                      <div className="featured-banner-card__title">{banner.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="featured-banner-dots" aria-label="Featured banner pages">
              {featuredBanners.map((banner, index) => (
                <button
                  key={`${banner.id}-featured-dot`}
                  className={`home-banner-dot ${activeFeaturedIndex === index ? 'active' : ''}`}
                  type="button"
                  aria-label={`Show featured banner ${index + 1}`}
                  aria-current={activeFeaturedIndex === index ? 'true' : undefined}
                  onClick={() => scrollToFeaturedBanner(index)}
                />
              ))}
            </div>
          </section>
        )}

      </div>

      <section className="facebook-follow-section">
        <div className="facebook-follow-copy">
          <div className="tag">Stay Connected</div>
          <h2 className="section-title">Follow Our Journey</h2>
          <p className="section-subtitle">
            See the latest updates, new arrivals, and behind-the-scenes stories from our Facebook page.
          </p>
          <a
            className="button"
            href={facebookPageUrl}
            target="_blank"
            rel="noreferrer"
          >
            Visit Facebook Page
          </a>
        </div>
        <div className="facebook-page-card">
          <div>
            <div className="tag">Follow us on Facebook</div>
            <h3>Latest Posts</h3>
          </div>
          <div className="facebook-embed-frame" ref={facebookEmbedFrameRef}>
            <iframe
              className="facebook-embed-desktop"
              title="Severino Facebook Page"
              src={facebookPluginUrlDesktop}
              width="500"
              height={facebookDesktopHeight}
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
            <iframe
              key={`facebook-mobile-${facebookMobileWidth}`}
              className="facebook-embed-mobile"
              title="Severino Facebook Page Mobile"
              src={getFacebookPluginUrl(facebookMobileWidth)}
              width={facebookMobileWidth}
              height={facebookMobileHeight}
              style={{ border: 'none', overflow: 'hidden' }}
              scrolling="no"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
          </div>
        </div>
      </section>

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
