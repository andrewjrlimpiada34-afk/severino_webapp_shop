import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

function NavBar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [mobileQuickOpen, setMobileQuickOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [profileImage, setProfileImage] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const isActivePath = (path) => location.pathname === path

  const triggerSpray = (event) => {
    const target = event.currentTarget
    if (!target) return
    const count = 10
    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('span')
      particle.className = 'spray-particle'
      particle.style.setProperty('--x', `${(Math.random() * 2 - 1).toFixed(2)}`)
      particle.style.setProperty('--y', `${(Math.random() * -1 - 0.2).toFixed(2)}`)
      particle.style.setProperty('--s', `${(Math.random() * 0.6 + 0.4).toFixed(2)}`)
      target.appendChild(particle)
      setTimeout(() => particle.remove(), 750)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const orders = await api.orders()
        const openedIds = JSON.parse(localStorage.getItem(`severino_notif_opened_${user.id}`) || '[]')
        const list = orders.slice(0, 5).map((order) => ({
          id: order.id,
          text: `Order ${order.id} is ${order.status}`,
          opened: openedIds.includes(order.id),
        }))
        setNotifications(list)
        const profile = await api.profile().catch(() => null)
        setProfileImage(profile?.profileImage || '')
      } catch {
        setNotifications([])
      }
    }
    load()
  }, [user])

  useEffect(() => {
    document.body.classList.toggle('nav-quick-open', mobileQuickOpen)
    return () => document.body.classList.remove('nav-quick-open')
  }, [mobileQuickOpen])

  return (
    <>
      <nav className="nav">
        <div className="nav-logo">Severino</div>
        <div className={`nav-links ${open ? 'open' : ''}`}>
        <NavLink to="/" onClick={() => setOpen(false)}>Home</NavLink>
        <NavLink to="/shop" onClick={() => setOpen(false)}>Shop</NavLink>
        {user && (
          <>
            <NavLink to="/feedback" onClick={() => setOpen(false)}>Feedback</NavLink>
            <NavLink to="/orders" onClick={() => setOpen(false)}>Orders</NavLink>
          </>
        )}
        {user && (
          <>
            <button
              className="icon-button nav-utility"
              type="button"
              aria-label="Search"
              onClick={() => navigate('/search')}
            >
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
            </button>
            <button
              className="icon-button nav-utility"
              type="button"
              aria-label="Favorites"
              onClick={() => navigate('/favorites')}
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20s-7-4.4-9-8.6C1.5 8 3.4 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.6 5 20.5 8 21 11.4 19 15.6 12 20 12 20Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className="icon-button nav-utility"
              type="button"
              aria-label="Cart"
              onClick={() => navigate('/cart')}
            >
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
            </button>
            <div className="notif-wrapper">
              <button
                className="icon-button"
                type="button"
                aria-label="Notifications"
                onClick={() => navigate('/notifications')}
              >
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 17h12l-1.2-2.4a6.5 6.5 0 0 1-.7-2.9V10a5 5 0 1 0-10 0v1.7a6.5 6.5 0 0 1-.7 2.9L6 17Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.5 18.5a2.5 2.5 0 0 0 5 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                {notifications.some((item) => !item.opened) && <span className="badge-dot" />}
              </button>
            </div>
          </>
        )}
        {!user && <NavLink to="/login" onClick={() => setOpen(false)}>Login</NavLink>}
        {user && (
          <button className="button ghost logout-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        )}
        </div>
        <div className="nav-actions">
        {user && (
          <button
            className="avatar-button"
            type="button"
            onClick={() => navigate('/account')}
            aria-label="Account"
          >
            {profileImage ? (
              <img src={profileImage} alt="Profile" />
            ) : (
              <span>Me</span>
            )}
          </button>
        )}
        <button
          className="nav-toggle"
          onClick={() => setOpen((prev) => !prev)}
          type="button"
          aria-label="Open menu"
        >
          <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        </div>
      </nav>
      {user && (
        <>
          <div className={`nav-mobile-toggle-row ${mobileQuickOpen ? 'open' : ''}`}>
            <button
              className="icon-button nav-mobile-toggle"
              type="button"
              aria-label="Toggle quick actions"
              onClick={() => setMobileQuickOpen((prev) => !prev)}
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className={`nav-mobile-float ${mobileQuickOpen ? 'open' : ''}`}>
            <div className="nav-mobile-actions">
            <button
              className={`icon-button ${isActivePath('/favorites') ? 'active' : ''}`}
              type="button"
              aria-label="Favorites"
              onClick={(event) => {
                triggerSpray(event)
                navigate('/favorites')
              }}
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20s-7-4.4-9-8.6C1.5 8 3.4 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.6 5 20.5 8 21 11.4 19 15.6 12 20 12 20Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className={`icon-button ${isActivePath('/search') ? 'active' : ''}`}
              type="button"
              aria-label="Search"
              onClick={(event) => {
                triggerSpray(event)
                navigate('/search')
              }}
            >
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
            </button>
            <button
              className={`icon-button ${isActivePath('/cart') ? 'active' : ''}`}
              type="button"
              aria-label="Cart"
              onClick={(event) => {
                triggerSpray(event)
                navigate('/cart')
              }}
            >
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
            </button>
          </div>
          </div>
        </>
      )}
    </>
  )
}

export default NavBar
