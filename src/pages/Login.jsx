import Modal from '../components/Modal.jsx'
import PolicyModal from '../components/PolicyModal.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api, API_URL } from '../lib/api.js'
import { loginErrors } from '../../server/shared/loginValidation.js'


function Login() {
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState({})
  const identifierRef = useRef(null)
  const passwordRef = useRef(null)
  const pendingRef = useRef(false)
  const errors = loginErrors(form.identifier, form.password)
  const [status, setStatus] = useState(() => {
    const oauthStatus = new URLSearchParams(window.location.search).get('oauth')
    const error = oauthStatus === 'cancelled'
      ? 'Google sign-in was cancelled or not completed.'
      : oauthStatus === 'failed' ? 'Google sign-in failed. Please try again.' : ''
    return { loading: false, error, success: '' }
  })
  const [announcements, setAnnouncements] = useState([])
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsOpen, setTermsOpen] = useState('')
  const { startLogin } = useAuth()
  const navigate = useNavigate()
  const googleUrl = `${API_URL}/api/auth/google`

  useEffect(() => {
    let active = true
    api
      .loginAnnouncement()
      .then((data) => {
        if (!active) return
        setAnnouncements(Array.isArray(data) ? data.filter((item) => item?.title || item?.message) : [])
      })
      .catch(() => {
        if (!active) return
        setAnnouncements([])
      })

    return () => {
      active = false
    }
  }, [])

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setStatus((prev) => ({ ...prev, error: '', success: '' }))
  }

  const hasAnnouncement = announcements.length > 0

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (pendingRef.current) return
    setTouched({ identifier: true, password: true })
    if (errors.identifier || errors.password) {
      setStatus({ loading: false, error: 'Check the highlighted fields.', success: '' })
      const invalidField = errors.identifier ? identifierRef : passwordRef
      invalidField.current?.focus()
      return
    }
    if (!termsAccepted) {
      setStatus({
        loading: false,
        error: 'Please accept the terms and conditions before signing in.',
        success: '',
      })
      return
    }
    pendingRef.current = true
    try {
      setStatus({ loading: true, error: '', success: '' })
      const data = await startLogin(form.identifier, form.password)
      setStatus({ loading: false, error: '', success: 'Logged in successfully.' })
      if (data?.role === 'admin') {
        sessionStorage.setItem('admin_session', 'active')
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
    } finally {
      pendingRef.current = false
    }
  }

  return (
    <section className="boutique-page boutique-login">
      <div className="store-login-panel">
        <div className="store-login-visual">
          <img src="/images/severino-editorial.webp" alt="Severino perfume in warm afternoon light" fetchPriority="high" />
          <div className="store-login-caption"><span className="store-eyebrow">The Severino collection</span><p>Find your<br />signature scent.</p></div>
        </div>
        <div className="store-login-content">
          <div className="login-header-row">
            <div>
              <span className="store-eyebrow">A little everyday elegance</span>
              <h1 className="section-title">Welcome back</h1>
              <p className="section-subtitle">Sign in to save your favorites, discover new scents, and keep track of your orders.</p>
            </div>
            {hasAnnouncement && <button className="announcement-trigger" type="button" onClick={() => setAnnouncementOpen(true)} aria-label="View announcements">!</button>}
          </div>
        <form className="card form auth-login-form" onSubmit={handleSubmit} noValidate aria-busy={status.loading}>
          <div className="auth-field">
            <label className="label" htmlFor="login-identifier">Email or Mobile Number</label>
            <input
              id="login-identifier"
              name="identifier"
              ref={identifierRef}
              className="input"
              type="text"
              placeholder="email@example.com or 09XXXXXXXXX"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={status.loading}
              aria-invalid={Boolean(touched.identifier && errors.identifier)}
              aria-describedby={touched.identifier && errors.identifier ? 'login-identifier-error' : undefined}
              value={form.identifier}
              onChange={(event) => updateField('identifier', event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, identifier: true }))}
            />
            {touched.identifier && errors.identifier && <p className="auth-field-error" id="login-identifier-error">{errors.identifier}</p>}
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="login-password">Password</label>
            <div className="input-row">
              <input
                id="login-password"
                name="password"
                ref={passwordRef}
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="********"
                autoComplete="current-password"
                required
                minLength={8}
                disabled={status.loading}
                aria-invalid={Boolean(touched.password && errors.password)}
                aria-describedby={touched.password && errors.password ? 'login-password-error' : undefined}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
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
            {touched.password && errors.password && <p className="auth-field-error" id="login-password-error">{errors.password}</p>}
          </div>
          <label className="terms-check">
            <input
              type="checkbox"
              disabled={status.loading}
              checked={termsAccepted}
              onChange={(event) => {
                setTermsAccepted(event.target.checked)
                if (event.target.checked) {
                  setStatus((prev) => ({ ...prev, error: '' }))
                }
              }}
            />
            <span>
              I accept the{' '}
              <button
                className="terms-link"
                type="button"
                onClick={() => setTermsOpen('terms')}
              >
                terms and conditions
              </button>
            </span>
          </label>
          {status.error && <div className="auth-message" role="alert">{status.error}</div>}
          {status.success && <div className="pill" role="status">{status.success}</div>}
          <button className="button" type="submit" disabled={status.loading}>
            {status.loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div className="store-auth-divider"><span>or</span></div>
          <a
            className="button secondary"
            href={termsAccepted && !status.loading ? googleUrl : undefined}
            aria-disabled={!termsAccepted || status.loading}
            onClick={(event) => {
              if (status.loading) {
                event.preventDefault()
                return
              }
              if (!termsAccepted) {
                event.preventDefault()
                setStatus({
                  loading: false,
                  error: 'Please accept the terms and conditions before continuing with Google.',
                  success: '',
                })
              }
            }}
          >
            <svg className="store-google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5a6 6 0 0 1-9-3.1H3.1v2.6A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" /><path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 3.1 7.4L6.4 10A6 6 0 0 1 12 6Z" /></svg>
            Continue with Google
          </a>
          <p className="store-signup-prompt">New to Severino? <Link to="/create-account" className="store-text-link">Create an account</Link></p>
          <button className="store-text-link store-login-policy-link" type="button" onClick={() => setTermsOpen('cookies')}>Cookie Policy</button>
        </form>
        </div>
      </div>
      {termsOpen && <PolicyModal initialPolicy={termsOpen} onClose={() => setTermsOpen('')} />}
      {announcementOpen && hasAnnouncement && (
        <Modal
          role="presentation"
          onClick={() => setAnnouncementOpen(false)}
        >
          <div
            className="modal-card announcement-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-announcement-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setAnnouncementOpen(false)}
            >
              X
            </button>
            <div className="announcement-modal__badge">Announcements</div>
            <h2 id="login-announcement-title" className="section-title" style={{ fontSize: '28px' }}>
              Latest Updates
            </h2>
            <div className="announcement-list">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="announcement-item">
                  <h3>{announcement.title.trim() || 'Important Notice'}</h3>
                  <p className="announcement-modal__message">{announcement.message}</p>
                </article>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default Login
