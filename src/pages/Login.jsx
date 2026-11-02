import Modal from '../components/Modal.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api, API_URL } from '../lib/api.js'
import { loginErrors } from '../../server/shared/loginValidation.js'

const loginGreetings = [
  'Hello there!',
  'Welcome to Severino!',
  'Nice to see you!',
  'Find your signature scent.',
  'A fresh start awaits!',
  'Your scent story starts here.',
]

const termsSections = [
  {
    number: '1',
    title: 'General Acceptance and Legal Framework',
    body:
      'This agreement binds every user who signs in, creates an account, browses the catalog, places an order, or uses any Severino platform service.',
    items: [
      ['Account use', 'Users must provide accurate details and keep login credentials secure.'],
      ['Platform access', 'Continued access depends on compliance with these terms and local laws.'],
    ],
  },
  {
    number: '2',
    title: 'Privacy Law and Regulatory Data Compliance',
    body:
      'Personal information, order records, location-based forecasts, and system activity are handled only for account, delivery, security, and service improvement purposes.',
    items: [
      ['Data minimization', 'Only information needed to operate the service is collected.'],
      ['User rights', 'Users may request account updates, corrections, or deletion when allowed by law.'],
      ['Security logs', 'Technical records may be used to detect abuse and protect customer accounts.'],
    ],
  },
  {
    number: '3',
    title: 'E-Commerce and Transactional Provisions',
    body:
      'Orders, reservations, delivery details, and COD confirmations are processed as valid electronic records for the selected Severino products.',
    items: [
      ['Order records', 'Cart, checkout, and order status updates are maintained for fulfillment.'],
      ['Transparent totals', 'Product price, quantity, and customer-provided delivery details determine the final order record.'],
    ],
  },
  {
    number: '4',
    title: 'System Automation, Resource Abuse, and Metrics',
    body:
      'The platform may automate recommendations, notifications, reports, and operational checks to keep the shopping experience stable.',
    items: [
      ['Acceptable use', 'Users must not disrupt, overload, scrape, or reverse engineer platform systems.'],
      ['Operational metrics', 'Performance and error signals may be reviewed to improve reliability.'],
    ],
  },
  {
    number: '5',
    title: 'Limitation of Liability and Indemnification',
    body:
      'Services are provided as available. Severino is not liable for interruptions, incorrect user-provided details, third-party failures, or delays outside reasonable control.',
    items: [
      ['Customer responsibility', 'Users are responsible for truthful information and lawful platform use.'],
      ['Service limits', 'Remedies are limited to actions permitted by applicable consumer protection laws.'],
    ],
  },
]

function Login() {
  const [greeting] = useState(() => loginGreetings[Math.floor(Math.random() * loginGreetings.length)])
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
  const [termsOpen, setTermsOpen] = useState(false)
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
    <section className="grid" style={{ gap: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <div className="login-header-row">
        <div>
          <h1 className="section-title">Welcome back</h1>
          <p className="section-subtitle">Sign in with your email or Philippine mobile number.</p>
        </div>
        {hasAnnouncement && (
          <button
            className="announcement-trigger"
            type="button"
            onClick={() => setAnnouncementOpen(true)}
            aria-label="View announcements"
          >
            !
          </button>
        )}
      </div>
      <div className="grid two">
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
          <div className="pill">{greeting}</div>
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
                onClick={() => setTermsOpen(true)}
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
            Continue with Google
          </a>
          <Link to="/create-account" className="button secondary">
            Create Account
          </Link>
        </form>
        <div className="card terms-summary-card">
          <div className="tag">Agreement</div>
          <h2 className="section-title" style={{ fontSize: '26px' }}>
            Accept the terms and conditions
          </h2>
          <p className="section-subtitle">
            Review and agree to the platform terms before accessing your account.
          </p>
          <div className="terms-preview">
            <p>
              By checking the "I Agree" box, accessing, or utilizing the Platform, you confirm that
              you have read, understood, and agreed to be legally bound by this Agreement.
            </p>
            <p>
              We process personal data, system logs, and operational telemetry in strict compliance
              with applicable privacy regulations and platform security protocols.
            </p>
          </div>
          <button className="button secondary" type="button" onClick={() => setTermsOpen(true)}>
            Read More
          </button>
        </div>
      </div>
      {termsOpen && (
        <Modal
          role="presentation"
          onClick={() => setTermsOpen(false)}
        >
          <div
            className="modal-card modal-card--wide terms-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setTermsOpen(false)}
            >
              X
            </button>
            <div className="terms-content">
              <div className="terms-document-header">
                <div className="terms-document-heading">
                  <h2 id="terms-title">Terms of Service and Privacy Agreement</h2>
                  <span className="terms-updated">Last Updated: June 2026</span>
                  <p>
                    By checking the "I Agree" box, accessing, or utilizing Severino's web
                    application, you confirm that you have read, understood, and agreed to be legally
                    bound by this agreement.
                  </p>
                </div>
              </div>

              <div className="terms-section-stack">
                {termsSections.map((section) => (
                  <article className="terms-law-card" key={section.number}>
                    <div className="terms-card-copy">
                      <div className="terms-card-title-row">
                        <span className="terms-card-number">{section.number}.</span>
                        <h3>{section.title}</h3>
                      </div>
                      <p>{section.body}</p>
                      <div className="terms-clause-list">
                        {section.items.map(([label, description]) => (
                          <div className="terms-clause" key={label}>
                            <span>{label}</span>
                            <p>{description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="terms-document-footer">
                <p>
                  By using this platform, you acknowledge that you have read, understood, and agreed
                  to be bound by these Terms of Service and Privacy Agreement.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}
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
