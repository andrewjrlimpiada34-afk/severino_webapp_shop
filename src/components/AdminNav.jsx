import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function AdminNav() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="admin-nav">
      <div>
        <div className="nav-logo">Admin Studio</div>
        <p className="section-subtitle admin-subtitle">Secure dashboard access</p>
      </div>
      <button className="admin-toggle" type="button" onClick={() => setOpen((prev) => !prev)}>
        Menu
      </button>
      <div className={`admin-links ${open ? 'open' : ''}`}>
        <NavLink to="/admin" onClick={() => setOpen(false)}>Dashboard</NavLink>
        <NavLink to="/admin/sales" onClick={() => setOpen(false)}>Sales Report</NavLink>
        <NavLink to="/admin/feedback" onClick={() => setOpen(false)}>Feedback</NavLink>
        <NavLink to="/admin/add-product" onClick={() => setOpen(false)}>Add Product</NavLink>
        <NavLink to="/admin/products" onClick={() => setOpen(false)}>Modify Products</NavLink>
        <NavLink to="/admin/users" onClick={() => setOpen(false)}>View Users</NavLink>
        <NavLink to="/admin/orders" onClick={() => setOpen(false)}>View Orders</NavLink>
        <button className="button ghost" type="button" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export default AdminNav
