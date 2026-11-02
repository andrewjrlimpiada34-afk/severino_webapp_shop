import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loginErrors, normalizeEmail } from '../../server/shared/loginValidation.js'

function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [touched, setTouched] = useState({})
  const pendingRef = useRef(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const errors = {
    ...loginErrors(form.email, form.password),
    email: normalizeEmail(form.email) ? '' : 'Enter a valid email address.',
  }
  const { startLogin, logout } = useAuth()
  const navigate = useNavigate()

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setStatus((prev) => ({ ...prev, error: '', success: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (pendingRef.current) return
    setTouched({ email: true, password: true })
    if (errors.email || errors.password) {
      setStatus({ loading: false, error: 'Check the highlighted fields.', success: '' })
      const invalidField = errors.email ? emailRef : passwordRef
      invalidField.current?.focus()
      return
    }
    pendingRef.current = true
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
    } finally {
      pendingRef.current = false
    }
  }
  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <header className="admin-login-heading">
          <div className="tag">Severino Atelier · Admin Studio</div>
          <h1 className="section-title" id="admin-login-title">Admin Login</h1>
          <p className="section-subtitle">
            Sign in with your administrator account.
          </p>
        </header>

        <form className="form admin-login-form auth-login-form" onSubmit={handleSubmit} noValidate aria-busy={status.loading}>
          <div className="auth-field">
            <label className="label" htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              name="email"
              ref={emailRef}
              className="input"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={status.loading}
              aria-invalid={Boolean(touched.email && errors.email)}
              aria-describedby={touched.email && errors.email ? 'admin-email-error' : undefined}
              placeholder="admin@severinoatelier.com"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            />
            {touched.email && errors.email && <p className="auth-field-error" id="admin-email-error">{errors.email}</p>}
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              ref={passwordRef}
              className="input"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
              disabled={status.loading}
              aria-invalid={Boolean(touched.password && errors.password)}
              aria-describedby={touched.password && errors.password ? 'admin-password-error' : undefined}
              placeholder="••••••••"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            />
            {touched.password && errors.password && <p className="auth-field-error" id="admin-password-error">{errors.password}</p>}
          </div>
          {status.error && <div className="auth-message" role="alert">{status.error}</div>}
          {status.success && <div className="pill" role="status">{status.success}</div>}
          <button className="button" type="submit" disabled={status.loading}>
            {status.loading ? 'Signing in...' : 'Enter Dashboard'}
          </button>
        </form>
        <footer className="admin-login-security">
          <div className="tag">Security</div>
          <p className="section-subtitle">
            Admin sessions expire after two hours. Sign out when you finish.
          </p>
          <div className="pill">Protected admin access</div>
        </footer>
      </section>
    </main>
  )
}

export default AdminLogin
