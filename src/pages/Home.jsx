import BannerStoryModal from '../components/BannerStoryModal.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import AdaptiveScentFloating from '../components/AdaptiveScentFloating.jsx'
import HomeScrollVideo from '../components/HomeScrollVideo.jsx'
import useAdaptiveScent from '../hooks/useAdaptiveScent.js'
import StoreProductCard, { StoreCatalogSkeleton } from '../components/StoreProductCard.jsx'
import StoreIcon from '../components/StoreIcon.jsx'
import FacebookPageCard from '../components/FacebookPageCard.jsx'
import { facebookPageUrl } from '../lib/social.js'

import { useAuth } from '../context/AuthContext.jsx'
import { defaultBannerStories, normalizeBannerStories } from '../../server/shared/bannerContent.js'



const SHOW_HOME_SCROLL_VIDEO = false

function Home() {
  const { user } = useAuth()

  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const [bannersLoading, setBannersLoading] = useState(true)
  const [loadedBannerImages, setLoadedBannerImages] = useState({})
  const [bannerAspectRatios, setBannerAspectRatios] = useState({})
  const bannerRailRef = useRef(null)
  const featuredRailRef = useRef(null)
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [heroImage, setHeroImage] = useState('')
  const [bannerStories, setBannerStories] = useState(() => normalizeBannerStories())
  const [featuredBanners, setFeaturedBanners] = useState([])
  const [loadedFeaturedImages, setLoadedFeaturedImages] = useState({})
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0)
  const [adaptiveProducts, setAdaptiveProducts] = useState([])
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [openBannerStory, setOpenBannerStory] = useState(null)
  const adaptive = useAdaptiveScent(adaptiveProducts)



  useEffect(() => {
    const loadHeroAndBanners = async () => {
      try {
        const [bannerImages, stories, hero, featured] = await Promise.all([
          api.banners().catch(() => []),
          api.bannerStories().catch(() => defaultBannerStories),
          api.heroImage().catch(() => ({ image: '' })),
          api.featuredBanners().catch(() => []),
        ])
        setHeroImage(hero?.image || '')
        setBannerStories(normalizeBannerStories(stories))
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
      } finally {
        setBannersLoading(false)
      }

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
    let active = true
    setCatalogStatus('loading')
    api.products().then((products) => {
      if (!active) return
      setAdaptiveProducts(products)
      setCatalogStatus('ready')
    }).catch(() => {
      if (active) setCatalogStatus('error')
    })
    return () => { active = false }
  }, [catalogAttempt])

  const handleBannerRailScroll = () => {
    const track = bannerRailRef.current
    if (!track || !track.children.length) return
    const trackCenter = track.scrollLeft + track.clientWidth / 2
    const cards = Array.from(track.children)
    const nextIndex = cards.reduce((closestIndex, card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2
      const closestCard = cards[closestIndex]
      const closestCenter = closestCard.offsetLeft + closestCard.offsetWidth / 2
      return Math.abs(cardCenter - trackCenter) < Math.abs(closestCenter - trackCenter)
        ? index
        : closestIndex
    }, 0)
    setActiveBannerIndex(nextIndex)
  }

  const scrollToBanner = (index) => {
    const track = bannerRailRef.current
    if (!track || !track.children?.[index]) return
    setActiveBannerIndex(index)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const card = track.children?.[index]
        if (!card) return
        const left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2
        track.scrollTo({ left, behavior: 'smooth' })
      })
    })
  }

  const goToBanner = (direction) => {
    if (!banners.length) return
    const next = (activeBannerIndex + direction + banners.length) % banners.length
    scrollToBanner(next)
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
    <section className="grid home-page boutique-page boutique-home">
      {SHOW_HOME_SCROLL_VIDEO && <HomeScrollVideo />}

      <div className="store-home-hero">
        <div className="store-home-hero-copy">
          <span className="store-eyebrow">The Severino collection</span>
          <h1>Scent stories for<br />everyday elegance.</h1>
          <p className="section-subtitle">
            Thoughtfully chosen fragrances for quiet moments, calm confidence, and lasting impressions.
          </p>
          <div className="store-hero-actions">
            <Link className="button" to="/shop">Explore collection <StoreIcon name="arrow" /></Link>
            {!user && <Link className="store-text-link" to="/create-account">Join Severino</Link>}
          </div>
          <span className="store-hero-footnote">Cash on delivery · Carefully packed</span>
        </div>
        <div className="store-home-hero-media"><img src={heroImage || '/images/severino-editorial.webp'} alt="The Severino fragrance collection" fetchPriority="high" /></div>
      </div>

      <nav className="store-category-links" aria-label="Shop by category">
        {['All scents', 'Men', 'Women', 'Unisex'].map((category, index) => <Link key={category} className={index === 0 ? 'is-active' : ''} to={index === 0 ? '/shop' : `/shop?category=${category}`}>{category}</Link>)}
        <span>A scent for every version of you.</span>
      </nav>

      <section className="store-featured-section" aria-labelledby="featured-scents-title">
        <div className="store-section-heading"><div><span className="store-eyebrow">Discover your next favorite</span><h2 id="featured-scents-title">Featured scents</h2></div><Link className="store-text-link" to="/shop">View collection <StoreIcon name="arrow" /></Link></div>
        {catalogStatus === 'loading' && <StoreCatalogSkeleton />}
        {catalogStatus === 'error' && <div className="store-empty-state" role="status"><p>We couldn’t load the collection right now.</p><button className="button secondary" type="button" onClick={() => setCatalogAttempt((attempt) => attempt + 1)}>Try again</button></div>}
        {catalogStatus === 'ready' && (adaptiveProducts.length ? <div className="store-catalog store-grid">{adaptiveProducts.slice(0, 4).map((product) => <StoreProductCard key={product.id} product={product} />)}</div> : <div className="store-empty-state"><p>A new scent story is on its way. Check back soon.</p></div>)}
      </section>

      <div className="store-brand-story"><div className="store-brand-monogram" aria-hidden="true">S.</div><div><span className="store-eyebrow">A little more about us</span><h2>The Severino story</h2><p>Fragrances chosen for everyday elegance. Find your signature, make it part of your day.</p></div><Link className="store-text-link" to="/shop">Find your scent <StoreIcon name="arrow" /></Link></div>

      <AdaptiveScentFloating
        adaptive={adaptive}
        recommendationsLimit={3}
        onViewProduct={(productId) => navigate(`/product/${productId}`)}
      />

      {bannersLoading && (
        <section className="home-banner-rail banner-skeleton-region" aria-label="Loading homepage banners" aria-busy="true">
          <div className="home-banner-rail__track" aria-hidden="true">
            {[0, 1].map((item) => (
              <div key={`home-banner-skeleton-${item}`} className="home-banner-card banner-skeleton-card">
                <span className="banner-skeleton-shimmer" />
              </div>
            ))}
          </div>
          <div className="home-banner-dots banner-skeleton-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      )}

      {!bannersLoading && banners.length > 0 && (
        <section className="home-banner-rail" aria-label="Homepage banner stories">
          {banners.length > 1 && (
            <>
              <button
                className="home-banner-arrow home-banner-arrow--prev"
                type="button"
                aria-label="Previous banner"
                onClick={() => goToBanner(-1)}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                className="home-banner-arrow home-banner-arrow--next"
                type="button"
                aria-label="Next banner"
                onClick={() => goToBanner(1)}
              >
                <span aria-hidden="true">›</span>
              </button>
            </>
          )}
          <div
            className="home-banner-rail__track"
            ref={bannerRailRef}
            onScroll={handleBannerRailScroll}
          >
            {banners.map((banner, index) => (
              <button
                key={banner.title}
                className={`home-banner-card ${
                  loadedBannerImages[index] ? 'is-loaded' : 'is-loading'
                } ${activeBannerIndex === index ? 'active' : ''}`}
                style={
                  bannerAspectRatios[index]
                    ? { '--banner-aspect-ratio': bannerAspectRatios[index] }
                    : undefined
                }
                type="button"
                aria-label={`Open ${banner.title}`}
                onClick={() =>
                  setOpenBannerStory({
                    ...bannerStories[index],
                    title: bannerStories[index]?.title || banner.title,
                    message: bannerStories[index]?.message || '',
                  })
                }
              >
                {!loadedBannerImages[index] && (
                  <span className="banner-skeleton-shimmer" aria-hidden="true" />
                )}
                <img
                  className="home-banner-card__image"
                  src={banner.image}
                  alt=""
                  aria-hidden="true"
                  onLoad={(event) => {
                    const image = event.currentTarget
                    setLoadedBannerImages((current) => ({ ...current, [index]: true }))
                    if (image.naturalWidth && image.naturalHeight) {
                      setBannerAspectRatios((current) => ({
                        ...current,
                        [index]: `${image.naturalWidth} / ${image.naturalHeight}`,
                      }))
                    }
                  }}
                  onError={() =>
                    setLoadedBannerImages((current) => ({ ...current, [index]: true }))
                  }
                />
                <span className="home-banner-card__shade" aria-hidden="true" />
                <span className="home-banner-card__content">
                  <span className="home-banner-card__eyebrow">Featured story</span>
                  <span className="home-banner-card__title">
                    {bannerStories[index]?.title || banner.title}
                  </span>
                </span>
              </button>
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
        {bannersLoading && (
          <section className="featured-banner-slider banner-skeleton-region" aria-label="Loading featured banners" aria-busy="true">
            <div className="featured-banner-slider__viewport" aria-hidden="true">
              <div className="featured-banner-slider__track">
                {[0, 1].map((item) => (
                  <div
                    key={`featured-banner-skeleton-${item}`}
                    className="featured-banner-slide featured-banner-skeleton-card"
                  >
                    <div className="featured-banner-slide__image">
                      <span className="banner-skeleton-shimmer" />
                    </div>
                    <div className="featured-banner-card__content banner-skeleton-copy">
                      <span />
                      <span />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {!bannersLoading && featuredBanners.length > 0 && (
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
                      className={`featured-banner-slide__image ${
                        loadedFeaturedImages[index] ? 'is-loaded' : 'is-loading'
                      }`}
                    >
                      {!loadedFeaturedImages[index] && (
                        <span className="banner-skeleton-shimmer" aria-hidden="true" />
                      )}
                      <img
                        src={banner.image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        onLoad={() =>
                          setLoadedFeaturedImages((current) => ({
                            ...current,
                            [index]: true,
                          }))
                        }
                        onError={() =>
                          setLoadedFeaturedImages((current) => ({
                            ...current,
                            [index]: true,
                          }))
                        }
                      />
                    </div>
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
        <FacebookPageCard />
      </section>

      {openBannerStory && (
        <BannerStoryModal story={openBannerStory} onClose={() => setOpenBannerStory(null)} />
      )}
    </section>
  )
}

export default Home
