import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function AdminDashboard() {
  const [stats, setStats] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [banners, setBanners] = useState(['', '', '', '', ''])
  const [bannerStatus, setBannerStatus] = useState({ loading: false, error: '', success: '' })
  const [loginPopup, setLoginPopup] = useState('')
  const [popupStatus, setPopupStatus] = useState({ loading: false, error: '', success: '' })

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const [sales, inventory, bannerImages, popup] = await Promise.all([
          api.adminSales(),
          api.adminInventory(),
          api.adminBanners().catch(() => []),
          api.adminLoginPopup().catch(() => ({ image: '' })),
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
        if (popup?.image) {
          setLoginPopup(popup.image)
        }
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])

  const handleBannerFile = (event, index) => {
    const file = event.target.files?.[0]
    if (!file) return
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      setBannerStatus({
        loading: false,
        error: 'Image too large. Please upload a banner under 20MB.',
        success: '',
      })
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      setBanners((prev) => prev.map((item, i) => (i === index ? String(reader.result) : item)))
    reader.readAsDataURL(file)
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
    const reader = new FileReader()
    reader.onload = () => setLoginPopup(String(reader.result))
    reader.readAsDataURL(file)
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
            <input
              className="input"
              type="file"
              accept="image/*"
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
