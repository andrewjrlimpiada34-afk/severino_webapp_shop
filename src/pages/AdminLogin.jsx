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
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <header className="admin-login-heading">
          <div className="tag">Severino Atelier · Admin Studio</div>
          <h1 className="section-title" id="admin-login-title">Admin Login</h1>
          <p className="section-subtitle">
            Authorized access only. Activity is logged and monitored.
          </p>
        </header>

        <form className="form admin-login-form" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              className="input"
              type="email"
              placeholder="admin@severinoatelier.com"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
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
        <footer className="admin-login-security">
          <div className="tag">Security</div>
          <p className="section-subtitle">
            Admin sessions use short-lived tokens and IP-based access policies.
          </p>
          <div className="pill">Audit logging enabled</div>
        </footer>
      </section>
    </main>
  )
}

export default AdminLogin
