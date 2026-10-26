import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { compressImageFile } from '../lib/image.js'

const defaultBannerStories = [
  { id: 'banner-1', title: 'Severino Perfume Tips', message: '' },
  { id: 'banner-2', title: 'Severino Inspiration', message: '' },
  { id: 'banner-3', title: 'Severino Stories', message: '' },
  { id: 'banner-4', title: 'Severino Scents', message: '' },
  { id: 'banner-5', title: 'Why Severino?', message: '' },
]

const createAnnouncement = (index) => ({
  id: `announcement-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  message: '',
})

const dashboardTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'banners', label: 'Edit Banner' },
  { id: 'banner-content', label: 'Banner Pop-up Content' },
  { id: 'featured-images', label: 'Featured Banner Images' },
  { id: 'featured-content', label: 'Featured Banner Pop-up Content' },
  { id: 'hero', label: 'Hero Header Image' },
  { id: 'announcements', label: 'Login Announcements' },
  { id: 'login-popup', label: 'Login Pop-up Image' },
]

function DashboardPanel({ id, activeTab, children }) {
  return (
    <div
      className="admin-tab-panel"
      id={`admin-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`admin-tab-${id}`}
      hidden={activeTab !== id}
      tabIndex={0}
    >
      {children}
    </div>
  )
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [banners, setBanners] = useState(['', '', '', '', ''])
  const [bannerStatus, setBannerStatus] = useState({ loading: false, error: '', success: '' })
  const [bannerStories, setBannerStories] = useState(defaultBannerStories)
  const [bannerStoryStatus, setBannerStoryStatus] = useState({ loading: false, error: '', success: '' })
  const [loginPopup, setLoginPopup] = useState('')
  const [popupStatus, setPopupStatus] = useState({ loading: false, error: '', success: '' })
  const [announcements, setAnnouncements] = useState([createAnnouncement(0)])
  const [announcementStatus, setAnnouncementStatus] = useState({
    loading: false,
    error: '',
    success: '',
  })
  const [heroImage, setHeroImage] = useState('')
  const [heroStatus, setHeroStatus] = useState({ loading: false, error: '', success: '' })

  const defaultFeaturedBanners = [
    { id: 'featured-1', title: 'Featured Banner 1', image: '', message: '' },
    { id: 'featured-2', title: 'Featured Banner 2', image: '', message: '' },
    { id: 'featured-3', title: 'Featured Banner 3', image: '', message: '' },
  ]
  const normalizeFeaturedBanners = (items = []) =>
    defaultFeaturedBanners.map((base, index) => {
      const current = items[index] || {}
      return {
        id: base.id,
        title: current.title || base.title,
        image: current.image || '',
        message: current.message || '',
      }
    })
  const [featuredBanners, setFeaturedBanners] = useState(defaultFeaturedBanners)
  const [featuredBannerStatus, setFeaturedBannerStatus] = useState({
    loading: false,
    error: '',
    success: '',
  })



  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const [
          sales,
          inventory,
          bannerImages,
          stories,
          popup,
          adminAnnouncements,
          hero,
          featured,
        ] = await Promise.all([
          api.adminSales(),
          api.adminInventory(),
          api.adminBanners().catch(() => []),
          api.adminBannerStories().catch(() => defaultBannerStories),
          api.adminLoginPopup().catch(() => ({ image: '' })),
          api.adminLoginAnnouncement().catch(() => []),
          api.adminHeroImage().catch(() => ({ image: '' })),
          api.adminFeaturedBanners().catch(() => defaultFeaturedBanners),
        ])

        const lowStock = inventory.filter((item) => item.stock < 12).length
        setStats([
          { label: 'Total Orders', value: sales.count },
          { label: 'Revenue (₱)', value: sales.revenue.toLocaleString() },
          { label: 'Low Stock', value: lowStock },
          { label: 'Active SKUs', value: inventory.length },
        ])
        if (bannerImages.length) {
          setBanners(defaultBannerStories.map((_, index) => bannerImages[index] || ''))
        }
        if (stories?.length) {
          setBannerStories(
            defaultBannerStories.map((item, index) => ({
              ...item,
              message: stories[index]?.message || '',
            }))
          )
        }
        if (popup?.image) {
          setLoginPopup(popup.image)
        }
        if (adminAnnouncements?.length) {
          setAnnouncements(
            adminAnnouncements.map((item, index) => ({
              id: item.id || createAnnouncement(index).id,
              title: item.title || '',
              message: item.message || '',
            }))
          )
        }
        if (hero?.image) {
          setHeroImage(hero.image)
        }

        if (featured?.length) {
          setFeaturedBanners(normalizeFeaturedBanners(featured))
        }

        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])

  const handleBannerFile = async (event, index) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      setBannerStatus({
        loading: false,
        error: 'Image too large. Please upload a banner under 20MB.',
        success: '',
      })
      input.value = ''
      return
    }

    try {
      setBannerStatus({ loading: true, error: '', success: '' })
      const compressed = await compressImageFile(file, { maxSize: 1600, quality: 0.8 })
      const upload = await api.uploadImage(compressed)
      setBanners((prev) => prev.map((value, itemIndex) => (itemIndex === index ? upload.url : value)))
      setBannerStatus({
        loading: false,
        error: '',
        success: `Banner Image ${index + 1} loaded. Click Save Banners to apply.`,
      })
    } catch (error) {
      setBannerStatus({
        loading: false,
        error: error?.message || 'Failed to process banner image.',
        success: '',
      })
    } finally {
      input.value = ''
    }
  }

  const handlePopupFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      setPopupStatus({
        loading: false,
        error: 'Image too large. Please upload a pop-up under 20MB.',
        success: '',
      })
      return
    }
    compressImageFile(file, { maxSize: 1200, quality: 0.82 })
      .then((compressed) => api.uploadImage(compressed))
      .then((upload) => setLoginPopup(upload.url))
      .catch((error) =>
        setPopupStatus({
          loading: false,
          error: error?.message || 'Failed to process image.',
          success: '',
        })
      )
  }

  const handleHeroFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      setHeroStatus({
        loading: false,
        error: 'Image too large. Please upload a hero image under 20MB.',
        success: '',
      })
      return
    }
    compressImageFile(file, { maxSize: 1800, quality: 0.82 })
      .then((compressed) => api.uploadImage(compressed))
      .then((upload) => setHeroImage(upload.url))
      .catch((error) =>
        setHeroStatus({
          loading: false,
          error: error?.message || 'Failed to process image.',
          success: '',
        })
      )
  }

  const handleFeaturedBannerFile = async (event, index) => {
    const file = event.target.files?.[0]
    if (!file) return
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      setFeaturedBannerStatus({
        loading: false,
        error: 'Image too large. Please upload a featured banner under 20MB.',
        success: '',
      })
      event.target.value = ''
      return
    }

    try {
      setFeaturedBannerStatus({ loading: true, error: '', success: '' })
      const compressed = await compressImageFile(file, { maxSize: 1400, quality: 0.82 })
      const upload = await api.uploadImage(compressed)
      setFeaturedBanners((prev) =>
        normalizeFeaturedBanners(prev).map((item, itemIndex) =>
          itemIndex === index ? { ...item, image: upload.url } : item
        )
      )
      setFeaturedBannerStatus({
        loading: false,
        error: '',
        success: `Featured Banner ${index + 1} image loaded.`,
      })
    } catch (error) {
      setFeaturedBannerStatus({
        loading: false,
        error: error?.message || 'Failed to process featured banner image.',
        success: '',
      })
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="admin-dashboard">
      <header className="admin-dashboard-heading">
        <h1 className="section-title">Dashboard</h1>
        <p className="section-subtitle">Real-time operations overview with secure admin controls.</p>
      </header>

      <div className="admin-dashboard-tabs" role="tablist" aria-label="Dashboard sections">
        {dashboardTabs.map((tab, index) => (
          <button
            key={tab.id}
            className="admin-dashboard-tab"
            id={`admin-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`admin-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              let nextIndex
              if (event.key === 'ArrowRight') nextIndex = (index + 1) % dashboardTabs.length
              else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + dashboardTabs.length) % dashboardTabs.length
              else if (event.key === 'Home') nextIndex = 0
              else if (event.key === 'End') nextIndex = dashboardTabs.length - 1
              else return
              event.preventDefault()
              setActiveTab(dashboardTabs[nextIndex].id)
              const nextTab = event.currentTarget.parentElement.children[nextIndex]
              nextTab.focus()
              nextTab.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DashboardPanel id="overview" activeTab={activeTab}>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading stats...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="stats admin-dashboard-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="tag">{stat.label}</div>
            <div className="admin-stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid two admin-dashboard-shortcuts">
        <div className="card">
          <h2 className="section-title" style={{ fontSize: '24px' }}>
            Orders Needing Attention
          </h2>
          <Link className="admin-dashboard-link" to="/admin/orders">View orders <span aria-hidden="true">→</span></Link>
        </div>
        <div className="card">
          <h2 className="section-title" style={{ fontSize: '24px' }}>
            Inventory Alerts
          </h2>
          <Link className="admin-dashboard-link" to="/admin/products">View inventory <span aria-hidden="true">→</span></Link>
        </div>
      </div>
      </DashboardPanel>

      <DashboardPanel id="banners" activeTab={activeTab}>
      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Edit Banner
        </h2>
        <p className="section-subtitle">Upload one image for each banner slot.</p>
        {bannerStatus.error && <div className="card">Error: {bannerStatus.error}</div>}
        {bannerStatus.success && <div className="card">{bannerStatus.success}</div>}
        {banners.map((value, index) => (
          <div key={`banner-${index}`}>
            <label className="label" htmlFor={`banner-image-${index}`}>Banner Image {index + 1}</label>
            <input
              id={`banner-image-${index}`}
              className="input"
              placeholder="https://..."
              value={value}
              disabled={bannerStatus.loading}
              onChange={(event) =>
                setBanners((prev) =>
                  prev.map((item, i) => (i === index ? event.target.value : item))
                )
              }
            />
            <input
              className="input"
              type="file"
              accept="image/*"
              aria-label={`Upload Banner Image ${index + 1}`}
              disabled={bannerStatus.loading}
              onChange={(event) => handleBannerFile(event, index)}
            />
            {value && (
              <div className="banner-preview" style={{ backgroundImage: `url(${value})` }} />
            )}
          </div>
        ))}
        <button
          className="button"
          type="button"
          disabled={bannerStatus.loading}
          onClick={async () => {
            try {
              setBannerStatus({ loading: true, error: '', success: '' })
              await api.updateBanners(banners.filter(Boolean))
              setBannerStatus({ loading: false, error: '', success: 'Banners updated.' })
            } catch (error) {
              setBannerStatus({ loading: false, error: error.message, success: '' })
            }
          }}
        >
          Save Banners
        </button>
      </div>
      </DashboardPanel>

      <DashboardPanel id="banner-content" activeTab={activeTab}>
      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Banner Pop-up Content
        </h2>
        <p className="section-subtitle">
          Each homepage banner opens a modal. Titles are fixed; only the messages are editable here.
        </p>
        {bannerStoryStatus.error && <div className="card">Error: {bannerStoryStatus.error}</div>}
        {bannerStoryStatus.success && <div className="card">{bannerStoryStatus.success}</div>}
        {bannerStories.map((story, index) => (
          <div key={story.id} className="announcement-editor">
            <div className="label">Banner {index + 1}</div>
            <input className="input" value={story.title} readOnly />
            <textarea
              className="input input-textarea"
              placeholder={`Write the popup content for ${story.title}.`}
              value={story.message}
              onChange={(event) =>
                setBannerStories((prev) =>
                  prev.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, message: event.target.value } : item
                  )
                )
              }
              rows={4}
            />
          </div>
        ))}
        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              setBannerStoryStatus({ loading: true, error: '', success: '' })
              await api.updateBannerStories(bannerStories)
              setBannerStoryStatus({ loading: false, error: '', success: 'Banner popup content updated.' })
            } catch (error) {
              setBannerStoryStatus({ loading: false, error: error.message, success: '' })
            }
          }}
        >
          Save Banner Content
        </button>
      </div>
      </DashboardPanel>

      <DashboardPanel id="featured-images" activeTab={activeTab}>
      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Featured Banner Images (max: 3)
        </h2>
        <p className="section-subtitle">Upload up to 3 images. They will be saved to Cloudinary and used on the homepage.</p>
        {featuredBannerStatus.error && <div className="card">Error: {featuredBannerStatus.error}</div>}
        {featuredBannerStatus.success && <div className="card">{featuredBannerStatus.success}</div>}

        {featuredBanners.map((value, index) => (
          <div key={value.id || index}>
            <div className="label">Featured Banner {index + 1} Image</div>
            <input
              className="input"
              placeholder="https://..."
              value={value.image}
              onChange={(event) =>
                setFeaturedBanners((prev) =>
                  normalizeFeaturedBanners(prev).map((item, i) =>
                    i === index ? { ...item, image: event.target.value } : item
                  )
                )
              }
            />
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => handleFeaturedBannerFile(event, index)}
            />
            {value.image && (
              <div className="banner-preview" style={{ backgroundImage: `url(${value.image})` }} />
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #e5e2db', margin: '18px 0' }} />
          </div>
        ))}

        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              setFeaturedBannerStatus({ loading: true, error: '', success: '' })

              const cleaned = normalizeFeaturedBanners(featuredBanners)
                .map((b, i) => ({
                  id: b.id || `featured-${i + 1}`,
                  title: (b.title || `Featured Banner ${i + 1}`).trim(),
                  image: b.image?.trim() || '',
                  message: b.message?.trim() || '',
                }))

              await api.updateFeaturedBanners(cleaned)
              setFeaturedBannerStatus({ loading: false, error: '', success: 'Featured images updated.' })
            } catch (error) {
              setFeaturedBannerStatus({ loading: false, error: error.message, success: '' })
            }
          }}
        >
          Save Featured Images
        </button>
      </div>
      </DashboardPanel>


      <DashboardPanel id="featured-content" activeTab={activeTab}>
      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Featured Banner Pop-up Content
        </h2>
        <p className="section-subtitle">For each featured banner, set the title and the popup message.</p>

        {featuredBannerStatus.error && <div className="card">Error: {featuredBannerStatus.error}</div>}
        {featuredBannerStatus.success && <div className="card">{featuredBannerStatus.success}</div>}

        {featuredBanners.map((value, index) => (
          <div key={value.id || index} className="announcement-editor">
            <div className="label">Banner {index + 1}</div>
            <input
              className="input"
              placeholder={`Featured Banner ${index + 1}`}
              value={value.title}
              onChange={(event) =>
                setFeaturedBanners((prev) =>
                  normalizeFeaturedBanners(prev).map((item, i) =>
                    i === index ? { ...item, title: event.target.value } : item
                  )
                )
              }
            />
            <textarea
              className="input input-textarea"
              placeholder="Write the popup message for this featured banner."
              value={value.message}
              onChange={(event) =>
                setFeaturedBanners((prev) =>
                  normalizeFeaturedBanners(prev).map((item, i) =>
                    i === index ? { ...item, message: event.target.value } : item
                  )
                )
              }
              rows={5}
            />
          </div>
        ))}

        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              setFeaturedBannerStatus({ loading: true, error: '', success: '' })

              const cleaned = normalizeFeaturedBanners(featuredBanners)
                .map((b, i) => ({
                  id: b.id || `featured-${i + 1}`,
                  title: (b.title || `Featured Banner ${i + 1}`).trim(),
                  image: b.image?.trim() || '',
                  message: b.message?.trim() || '',
                }))

              await api.updateFeaturedBanners(cleaned)
              setFeaturedBannerStatus({ loading: false, error: '', success: 'Featured popup content updated.' })
            } catch (error) {
              setFeaturedBannerStatus({ loading: false, error: error.message, success: '' })
            }
          }}
        >
          Save Featured Pop-up Content
        </button>

      </div>
      </DashboardPanel>

      <DashboardPanel id="hero" activeTab={activeTab}>
      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Hero Header Image
        </h2>

        <p className="section-subtitle">This is the full-width header background on the homepage.</p>
        {heroStatus.error && <div className="card">Error: {heroStatus.error}</div>}
        {heroStatus.success && <div className="card">{heroStatus.success}</div>}
        <div>
          <div className="label">Hero Image URL</div>
          <input
            className="input"
            placeholder="https://... or /hero/hero-default.svg"
            value={heroImage}
            onChange={(event) => setHeroImage(event.target.value)}
          />
          <input className="input" type="file" accept="image/*" onChange={handleHeroFile} />
          {heroImage && (
            <div className="banner-preview" style={{ backgroundImage: `url(${heroImage})` }} />
          )}
        </div>
        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              setHeroStatus({ loading: true, error: '', success: '' })
              await api.updateHeroImage(heroImage)
              setHeroStatus({ loading: false, error: '', success: 'Hero image updated.' })
            } catch (error) {
              setHeroStatus({ loading: false, error: error.message, success: '' })
            }
          }}
        >
          Save Hero Image
        </button>
      </div>
      </DashboardPanel>

      <DashboardPanel id="announcements" activeTab={activeTab}>
      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Login Announcements
        </h2>
        <p className="section-subtitle">
          The exclamation button appears on the login page only when at least one announcement exists.
        </p>
        {announcementStatus.error && <div className="card">Error: {announcementStatus.error}</div>}
        {announcementStatus.success && <div className="card">{announcementStatus.success}</div>}
        {announcements.map((announcement, index) => (
          <div key={announcement.id} className="announcement-editor">
            <div className="announcement-editor__header">
              <div className="label">Announcement {index + 1}</div>
              <button
                className="button secondary"
                type="button"
                onClick={() =>
                  setAnnouncements((prev) =>
                    prev.length > 1 ? prev.filter((item) => item.id !== announcement.id) : [createAnnouncement(0)]
                  )
                }
              >
                Remove
              </button>
            </div>
            <input
              className="input"
              placeholder="Important Notice"
              value={announcement.title}
              onChange={(event) =>
                setAnnouncements((prev) =>
                  prev.map((item) =>
                    item.id === announcement.id ? { ...item, title: event.target.value } : item
                  )
                )
              }
            />
            <textarea
              className="input input-textarea"
              placeholder="Type the admin announcement here."
              value={announcement.message}
              onChange={(event) =>
                setAnnouncements((prev) =>
                  prev.map((item) =>
                    item.id === announcement.id ? { ...item, message: event.target.value } : item
                  )
                )
              }
              rows={5}
            />
          </div>
        ))}
        <button
          className="button secondary"
          type="button"
          onClick={() => setAnnouncements((prev) => [...prev, createAnnouncement(prev.length)])}
        >
          Add Announcement
        </button>
        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              setAnnouncementStatus({ loading: true, error: '', success: '' })
              const nextAnnouncements = announcements.filter(
                (item) => item.title.trim() || item.message.trim()
              )
              await api.updateLoginAnnouncement(nextAnnouncements)
              if (!nextAnnouncements.length) {
                setAnnouncements([createAnnouncement(0)])
              }
              setAnnouncementStatus({
                loading: false,
                error: '',
                success: nextAnnouncements.length
                  ? 'Announcements updated.'
                  : 'All announcements cleared. The exclamation button will be hidden.',
              })
            } catch (error) {
              setAnnouncementStatus({ loading: false, error: error.message, success: '' })
            }
          }}
        >
          Save Announcements
        </button>
      </div>
      </DashboardPanel>

      <DashboardPanel id="login-popup" activeTab={activeTab}>
      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Login Pop-up Image
        </h2>
        <p className="section-subtitle">
          Shown once after a successful customer login.
        </p>
        {popupStatus.error && <div className="card">Error: {popupStatus.error}</div>}
        {popupStatus.success && <div className="card">{popupStatus.success}</div>}
        <div>
          <div className="label">Pop-up Image URL</div>
          <input
            className="input"
            placeholder="https://..."
            value={loginPopup}
            onChange={(event) => setLoginPopup(event.target.value)}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={handlePopupFile}
          />
          {loginPopup && (
            <div className="banner-preview" style={{ backgroundImage: `url(${loginPopup})` }} />
          )}
        </div>
        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              setPopupStatus({ loading: true, error: '', success: '' })
              await api.updateLoginPopup(loginPopup)
              setPopupStatus({ loading: false, error: '', success: 'Pop-up updated.' })
            } catch (error) {
              setPopupStatus({ loading: false, error: error.message, success: '' })
            }
          }}
        >
          Save Pop-up
        </button>
      </div>
      </DashboardPanel>
    </section>
  )
}

export default AdminDashboard
