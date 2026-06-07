import { useEffect, useState } from 'react'
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

function AdminDashboard() {
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
          setBanners(bannerImages)
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
          setFeaturedBanners(
            featured
              .filter((b) => b?.image)
              .slice(0, 3)
              .map((item, index) => ({
                id: item.id || `featured-${index + 1}`,
                title: item.title || `Featured Banner ${index + 1}`,
                image: item.image || '',
                message: item.message || '',
              }))
          )
        }

        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])

  const handleBannerFiles = (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    if (files.length > 5) {
      setBannerStatus({
        loading: false,
        error: 'You can upload up to 5 banners at a time.',
        success: '',
      })
      return
    }
    const maxSize = 20 * 1024 * 1024
    if (files.some((file) => file.size > maxSize)) {
      setBannerStatus({
        loading: false,
        error: 'Image too large. Please upload a banner under 20MB.',
        success: '',
      })
      return
    }
    Promise.all(
      files.map(async (file) => {
        const compressed = await compressImageFile(file, { maxSize: 1600, quality: 0.8 })
        const upload = await api.uploadImage(compressed)
        return upload.url
      })
    )
      .then((urls) => {
        const cleaned = urls.filter(Boolean).slice(0, 5)
        setBanners((prev) => {
          const next = [...cleaned]
          while (next.length < 5) next.push(prev[next.length] || '')
          return next
        })
        setBannerStatus({ loading: false, error: '', success: 'Loaded banner files.' })
      })
      .catch((error) => {
        setBannerStatus({
          loading: false,
          error: error?.message || 'Failed to process images.',
          success: '',
        })
      })
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

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Dashboard</h1>
        <p className="section-subtitle">Real-time operations overview with secure admin controls.</p>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading stats...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="stats">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="tag">{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid two">
        <div className="card">
          <h2 className="section-title" style={{ fontSize: '24px' }}>
            Orders Needing Attention
          </h2>
          <p className="section-subtitle"> </p>
        </div>
        <div className="card">
          <h2 className="section-title" style={{ fontSize: '24px' }}>
            Inventory Alerts
          </h2>
          <p className="section-subtitle"> </p>
        </div>
      </div>

      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Edit Banner
        </h2>
        <div>
          <div className="label">Upload up to 5 banners at once</div>
          <input
            className="input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleBannerFiles}
          />
        </div>
        {bannerStatus.error && <div className="card">Error: {bannerStatus.error}</div>}
        {bannerStatus.success && <div className="card">{bannerStatus.success}</div>}
        {banners.map((value, index) => (
          <div key={`banner-${index}`}>
            <div className="label">Banner Image {index + 1}</div>
            <input
              className="input"
              placeholder="https://..."
              value={value}
              onChange={(event) =>
                setBanners((prev) =>
                  prev.map((item, i) => (i === index ? event.target.value : item))
                )
              }
            />
            {value && (
              <div className="banner-preview" style={{ backgroundImage: `url(${value})` }} />
            )}
          </div>
        ))}
        <button
          className="button"
          type="button"
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

      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Featured Banner Images (required: 3)
        </h2>
        <p className="section-subtitle">Upload exactly 3 images. They will be saved to Cloudinary and used on the homepage.</p>
        {featuredBannerStatus.error && <div className="card">Error: {featuredBannerStatus.error}</div>}
        {featuredBannerStatus.success && <div className="card">{featuredBannerStatus.success}</div>}

        {featuredBanners.map((value, index) => (
          <div key={value.id || index}>
            <div className="label">Featured Banner {index + 1} Image</div>

            <div>
              <div className="label">Uploaded Image</div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <input
                  className="input"
                  placeholder="(Upload an image)"
                  value={value.image}
                  readOnly
                />

                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (!file) return

                    const maxSize = 20 * 1024 * 1024
                    if (file.size > maxSize) {
                      setFeaturedBannerStatus({
                        loading: false,
                        error: 'Image too large. Please upload under 20MB.',
                        success: '',
                      })
                      return
                    }

                    try {
                      setFeaturedBannerStatus({ loading: true, error: '', success: '' })
                      const compressed = await compressImageFile(file, { maxSize: 1400, quality: 0.82 })
                      const upload = await api.uploadImage(compressed)
                      setFeaturedBanners((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, image: upload.url } : item))
                      )
                      setFeaturedBannerStatus({ loading: false, error: '', success: '' })
                    } catch (error) {
                      setFeaturedBannerStatus({
                        loading: false,
                        error: error?.message || 'Failed to process image.',
                        success: '',
                      })
                    }
                  }}
                />

                {value.image && (
                  <div className="banner-preview" style={{ backgroundImage: `url(${value.image})` }} />
                )}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e5e2db', margin: '18px 0' }} />
          </div>
        ))}

        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              const missingIndex = featuredBanners.findIndex((b) => !b?.image?.trim())
              if (missingIndex !== -1) {
                setFeaturedBannerStatus({
                  loading: false,
                  error: `Please upload Featured Banner ${missingIndex + 1} image before saving.`,
                  success: '',
                })
                return
              }

              setFeaturedBannerStatus({ loading: true, error: '', success: '' })

              // Always save exactly 3 items in the correct order
              const cleaned = featuredBanners
                .slice(0, 3)
                .map((b, i) => ({
                  id: b.id || `featured-${i + 1}`,
                  title: (b.title || `Featured Banner ${i + 1}`).trim(),
                  image: b.image.trim(),
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


      <div className="card form">
        <h2 className="section-title" style={{ fontSize: '24px' }}>
          Featured Banner Pop-up Content
        </h2>
        <p className="section-subtitle">For each featured banner, set the title and the popup message.</p>

        {featuredBanners.map((value, index) => (
          <div key={value.id || index}>
            <div className="label">Featured Banner {index + 1} Popup</div>

            <div className="grid two" style={{ gap: '16px' }}>
              <div>
                <div className="label">Banner Title</div>
                <input
                  className="input"
                  value={value.title}
                  readOnly
                />
              </div>

              <div>
                <div className="label">Message</div>
                <textarea
                  className="input input-textarea"
                  placeholder="Write the popup message for this featured banner."
                  value={value.message}
                  onChange={(event) =>
                    setFeaturedBanners((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, message: event.target.value } : item))
                    )
                  }
                  rows={4}
                />
              </div>

            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e5e2db', margin: '18px 0' }} />
          </div>
        ))}

        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              setFeaturedBannerStatus({ loading: true, error: '', success: '' })

              // Only allow saving the 3-message popup content for the 3 featured banners.
              // Images must remain unchanged; titles are fixed/read-only.
              const missingIndex = featuredBanners.findIndex((b) => !b?.image?.trim())
              if (missingIndex !== -1) {
                setFeaturedBannerStatus({
                  loading: false,
                  error: `Please upload Featured Banner ${missingIndex + 1} image before saving content.`,
                  success: '',
                })
                return
              }

              const cleaned = featuredBanners
                .slice(0, 3)
                .map((b, i) => ({
                  id: b.id || `featured-${i + 1}`,
                  title: b.title || `Featured Banner ${i + 1}`,
                  image: b.image.trim(),
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
    </section>
  )
}

export default AdminDashboard
