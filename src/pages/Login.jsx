import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const { startLogin } = useAuth()
  const navigate = useNavigate()
  const defaultApi =
    window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : 'https://severino-backend.onrender.com'
  const apiBase = import.meta.env.VITE_API_URL || defaultApi
  const googleUrl = `${apiBase}/api/auth/google`

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setStatus({ loading: true, error: '', success: '' })
      const data = await startLogin(form.email, form.password)
      setStatus({ loading: false, error: '', success: 'Logged in successfully.' })
      if (data?.role === 'admin') {
        navigate('/admin')
        return
      }
      const redirect = sessionStorage.getItem('severino_post_login_redirect')
      if (redirect) {
        sessionStorage.removeItem('severino_post_login_redirect')
        navigate(redirect)
        return
      }
      navigate('/')
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }
  return (
    <section className="grid" style={{ gap: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <div>
        <h1 className="section-title">Login Page</h1>
        <p className="section-subtitle">Secure login with device verification.</p>
      </div>
      <div className="grid two">
        <form className="card form" onSubmit={handleSubmit}>
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Password</div>
            <div className="input-row">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label="Toggle password"
              >
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
          </div>
          <div className="pill">2FA ready · Security first</div>
          {status.error && <div className="card">Error: {status.error}</div>}
          {status.success && <div className="card">{status.success}</div>}
          <button className="button" type="submit" disabled={status.loading}>
            {status.loading ? 'Signing in...' : 'Sign In'}
          </button>
          <a className="button secondary" href={googleUrl}>
            Continue with Google
          </a>
          <a href="/create-account" className="button secondary">
            Create Account
          </a>
        </form>
        <div className="card">
          <div className="tag">Security</div>
          <h2 className="section-title" style={{ fontSize: '26px' }}>
            Protected Access
          </h2>
          <ul>
            <li>Passwords are hashed and never stored in plain text.</li>
            <li>Login attempts are rate limited.</li>
            <li>Device verification available for new logins.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export default Login
