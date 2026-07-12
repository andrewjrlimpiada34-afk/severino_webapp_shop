import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

const termsSections = [
  {
    number: '1',
    icon: 'handshake',
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
    icon: 'shield',
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
    icon: 'cart',
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
    icon: 'speed',
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
    icon: 'scale',
    title: 'Limitation of Liability and Indemnification',
    body:
      'Services are provided as available. Severino is not liable for interruptions, incorrect user-provided details, third-party failures, or delays outside reasonable control.',
    items: [
      ['Customer responsibility', 'Users are responsible for truthful information and lawful platform use.'],
      ['Service limits', 'Remedies are limited to actions permitted by applicable consumer protection laws.'],
    ],
  },
]

function TermsIcon({ type }) {
  const paths = {
    document: (
      <>
        <path d="M7 3h7l5 5v13H7V3Z" />
        <path d="M14 3v5h5" />
        <path d="M10 12h6M10 15h6M10 18h4" />
      </>
    ),
    handshake: (
      <>
        <path d="M8 12.5 5.8 10.3a2.4 2.4 0 0 1 0-3.4l1.1-1.1 5.4 5.4" />
        <path d="m16 12.5 2.2-2.2a2.4 2.4 0 0 0 0-3.4l-1.1-1.1-5.4 5.4" />
        <path d="m9.7 14.2 1.2 1.2a1.4 1.4 0 0 0 2 0l1.4-1.4" />
        <path d="m7.5 10.8 2.2 2.2M16.5 10.8 14.3 13" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 18.5 6v5.7c0 4-2.6 7.5-6.5 8.8-3.9-1.3-6.5-4.8-6.5-8.8V6L12 3.5Z" />
        <path d="M9.8 12h4.4v4H9.8v-4Z" />
        <path d="M10.6 12V9.9a1.4 1.4 0 0 1 2.8 0V12" />
      </>
    ),
    cart: (
      <>
        <path d="M5 6h2l1.4 8.2h8.1l1.8-5.8H8" />
        <path d="M10 19.2a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4ZM16 19.2a.7.7 0 1 0 0-1.4.7.7 0 0 0 0 1.4Z" />
        <path d="M10.5 11.2h4.6" />
      </>
    ),
    speed: (
      <>
        <path d="M5.5 16.5a7 7 0 1 1 13 0" />
        <path d="m12 13 3.6-3.6" />
        <path d="M8 16h8" />
      </>
    ),
    scale: (
      <>
        <path d="M12 4v16M7 7h10" />
        <path d="m7 7-3 5h6L7 7ZM17 7l-3 5h6l-3-5Z" />
        <path d="M9 20h6" />
      </>
    ),
  }

  return (
    <svg className="terms-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[type] || paths.document}
    </svg>
  )
}

function Login() {
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [announcements, setAnnouncements] = useState([])
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const { startLogin } = useAuth()
  const navigate = useNavigate()
  const defaultApi =
    window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : 'https://severino-backend.onrender.com'
  const apiBase = import.meta.env.VITE_API_URL || defaultApi
  const googleUrl = `${apiBase}/api/auth/google`

  useEffect(() => {
    const oauthStatus = new URLSearchParams(window.location.search).get('oauth')
    if (oauthStatus === 'cancelled') {
      setStatus({ loading: false, error: 'Google sign-in was cancelled or not completed.', success: '' })
    } else if (oauthStatus === 'failed') {
      setStatus({ loading: false, error: 'Google sign-in failed. Please try again.', success: '' })
    }
  }, [])

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
  }

  const hasAnnouncement = announcements.length > 0

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!termsAccepted) {
      setStatus({
        loading: false,
        error: 'Please accept the terms and conditions before signing in.',
        success: '',
      })
      return
    }
    try {
      setStatus({ loading: true, error: '', success: '' })
      const data = await startLogin(form.identifier, form.password)
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
      <div className="login-header-row">
        <div>
          <h1 className="section-title">Login Page</h1>
          <p className="section-subtitle">Secure login with device verification.</p>
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
        <form className="card form" onSubmit={handleSubmit}>
          <div>
            <div className="label">Email or Contact Number</div>
            <input
              className="input"
              type="text"
              placeholder="email@example.com or 09XXXXXXXXX"
              autoComplete="username"
              value={form.identifier}
              onChange={(event) => updateField('identifier', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Password</div>
            <div className="input-row">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="********"
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
          <div className="pill">2FA ready | Security first</div>
          <label className="terms-check">
            <input
              type="checkbox"
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
          {status.error && <div className="card">Error: {status.error}</div>}
          {status.success && <div className="card">{status.success}</div>}
          <button className="button" type="submit" disabled={status.loading}>
            {status.loading ? 'Signing in...' : 'Sign In'}
          </button>
          <a
            className="button secondary"
            href={termsAccepted ? googleUrl : undefined}
            aria-disabled={!termsAccepted}
            onClick={(event) => {
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
          <a href="/create-account" className="button secondary">
            Create Account
          </a>
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
        <div
          className="modal-backdrop"
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
                <div className="terms-document-seal">
                  <TermsIcon type="document" />
                </div>
                <div className="terms-document-heading">
                  <h2 id="terms-title">Terms of Service and Privacy Agreement</h2>
                  <span className="terms-updated">Last Updated: June 2026</span>
                  <p>
                    By checking the "I Agree" box, accessing, or utilizing Severino's web
                    application, you confirm that you have read, understood, and agreed to be legally
                    bound by this agreement.
                  </p>
                </div>
                <div className="terms-document-art" aria-hidden="true">
                  <span className="terms-document-page">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="terms-document-lock" />
                </div>
              </div>

              <div className="terms-section-stack">
                {termsSections.map((section) => (
                  <article className="terms-law-card" key={section.number}>
                    <div className="terms-card-icon">
                      <TermsIcon type={section.icon} />
                    </div>
                    <div className="terms-card-copy">
                      <div className="terms-card-title-row">
                        <span className="terms-card-number">{section.number}</span>
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
                <span className="terms-leaf terms-leaf--left" aria-hidden="true" />
                <p>
                  By using this platform, you acknowledge that you have read, understood, and agreed
                  to be bound by these Terms of Service and Privacy Agreement.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {announcementOpen && hasAnnouncement && (
        <div
          className="modal-backdrop"
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
        </div>
      )}
    </section>
  )
}

export default Login
