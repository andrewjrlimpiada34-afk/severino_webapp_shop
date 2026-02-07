import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const { startLogin, logout } = useAuth()
  const navigate = useNavigate()

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setStatus({ loading: true, error: '', success: '' })
      const data = await startLogin(form.email, form.password)
      if (data?.role !== 'admin') {
        await logout()
        setStatus({ loading: false, error: 'Admin access only.', success: '' })
        return
      }
      sessionStorage.setItem('admin_session', 'active')
      setStatus({ loading: false, error: '', success: 'Admin session started.' })
      navigate('/admin')
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }
  return (
    <section className="grid" style={{ gap: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div>
        <h1 className="section-title">Admin Login</h1>
        <p className="section-subtitle">
          Authorized access only. Activity is logged and monitored.
        </p>
      </div>

      <div className="grid two">
        <form className="card form" onSubmit={handleSubmit}>
          <div>
            <div className="label">Admin Email</div>
            <input
              className="input"
              type="email"
              placeholder="admin@severinoatelier.com"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
            />
          </div>
          {status.error && <div className="card">Error: {status.error}</div>}
          {status.success && <div className="card">{status.success}</div>}
          <button className="button" type="submit" disabled={status.loading}>
            {status.loading ? 'Signing in...' : 'Enter Dashboard'}
          </button>
        </form>
        <div className="card">
          <div className="tag">Security</div>
          <p className="section-subtitle">
            Admin sessions use short-lived tokens and IP-based access policies.
          </p>
          <div className="pill">Audit logging enabled</div>
        </div>
      </div>
    </section>
  )
}

export default AdminLogin
