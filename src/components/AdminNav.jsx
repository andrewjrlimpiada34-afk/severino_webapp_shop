import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AdminIcon from './AdminIcon.jsx'

const links = [
  { to: '/admin', label: 'Dashboard', icon: 'overview' },
  { to: '/admin/sales', label: 'Sales Report', icon: 'sales' },
  { to: '/admin/feedback', label: 'Feedback', icon: 'feedback' },
  { to: '/admin/add-product', label: 'Add Product', icon: 'add' },
  { to: '/admin/products', label: 'Modify Products', icon: 'products' },
  { to: '/admin/users', label: 'View Users', icon: 'users' },
  { to: '/admin/orders', label: 'View Orders', icon: 'orders' },
]

function AdminNav() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const navRef = useRef(null)
  const toggleRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => {
      if (!navRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="admin-nav" ref={navRef}>
      <div>
        <div className="nav-logo">Admin Studio</div>
        <p className="section-subtitle admin-subtitle">Secure dashboard access</p>
      </div>
      <button className={`admin-toggle ${open ? 'is-open' : ''}`} ref={toggleRef} type="button" aria-label={open ? 'Close admin menu' : 'Open admin menu'} aria-expanded={open} aria-controls="admin-links" onClick={() => setOpen((prev) => !prev)}>
        <span className="admin-hamburger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      <nav id="admin-links" aria-label="Admin navigation" className={`admin-links ${open ? 'open' : ''}`}>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/admin'} onClick={() => setOpen(false)}>
            <AdminIcon name={link.icon} /><span>{link.label}</span>
          </NavLink>
        ))}
        <button className="button ghost" type="button" onClick={handleLogout}>
          <AdminIcon name="logout" /><span>Sign Out</span>
        </button>
      </nav>
    </aside>
  )
}

export default AdminNav
