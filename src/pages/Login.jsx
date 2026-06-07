import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
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
              <h2 id="terms-title">TERMS OF SERVICE AND PRIVACY AGREEMENT</h2>
              <p><strong>Last Updated: June 2026</strong></p>
              <p>
                By checking the "I Agree" box, accessing, or utilizing the services provided through
                this online web application (the "Platform"), you explicitly confirm that you have
                read, understood, and agreed to be legally bound by the terms, conditions, and
                regulatory statutes detailed in this Agreement. If you do not consent to these
                statutory terms, you are prohibited from initializing, browsing, or operating the
                Platform.
              </p>
              <h3>1. General Acceptance and Legal Framework</h3>
              <p>
                This document constitutes a binding legal agreement between the end-user ("User") and
                the platform operators. Access to the platform's automation tools, interactive
                dashboard modules, user profiles, and data management systems is strictly conditional
                upon continuous compliance with these provisions.
              </p>
              <h3>2. Privacy Law and Regulatory Data Compliance</h3>
              <p>
                We process personal data, system logs, and operational telemetry in strict compliance
                with global privacy regulations, including the General Data Protection Regulation
                (GDPR) and regional data privacy acts. As established by comprehensive frameworks
                regarding digital infrastructure and user privacy compliance, organizations must
                execute explicit technical safeguards, clear system boundaries, and structural access
                controls to maintain data confidentiality and mitigate system security vulnerabilities
                (Data Protection Search, 2026).
              </p>
              <p>Pursuant to these baseline legal directives, our data management mechanisms strictly enforce the following protocols:</p>
              <p>
                <strong>Data Minimization:</strong> The collection of metadata, operational logs, and
                user profiles is limited strictly to parameters necessary for functional automated
                workflows and performance metrics.
              </p>
              <p>
                <strong>Right to Erasure (Right to be Forgotten):</strong> Users maintain explicit
                operational authority to request the complete deletion of their account records,
                historical system interactions, and logged evaluation profiles at any time.
              </p>
              <p>
                <strong>Access Logs &amp; Technical Security:</strong> System auditing strictly logs
                execution trials, timestamps, and automated processes to preserve a secure tracking
                record while maintaining rigorous user anonymization.
              </p>
              <h3>3. E-Commerce and Transactional Provisions</h3>
              <p>
                To the extent that this web application features integrated billing, service tiers,
                digital subscriptions, or automated asset procurement, all operations conform strictly
                to online commercial standards and Electronic Commerce Acts.
              </p>
              <p>
                <strong>Digital Contracts:</strong> Users agree that electronic records, automated
                confirmations, and digital signatures constitute valid, legally enforceable
                transaction receipts.
              </p>
              <p>
                <strong>Transparent Accounting:</strong> Billing parameters, subscription cycles, and
                system resource allocations are calculated deterministically. System transactional
                integrity ensures that all processing variables align with standard platform
                performance indicators, fully satisfying consumer protection guidelines for
                transparent digital accounting.
              </p>
              <h3>4. System Automation, Resource Abuse, and Metrics</h3>
              <p>
                The platform operates complex automated management tasks, scheduling frameworks, and
                data evaluation modules. To maintain technical compliance and ensure platform
                stability, user access controls are explicitly governed to ensure zero degradation of
                the core hosting infrastructure.
              </p>
              <p>
                <strong>Acceptable Use of Automation:</strong> System metrics, execution latency, and
                automated task durations are continuously monitored. The platform calculates system
                task performance and execution rates to dynamically optimize resource quotas.
              </p>
              <p>
                <strong>Prohibited Activities:</strong> Unauthorized automated testing, deliberate
                system stress-testing, reverse engineering, or malicious script injections intended to
                alter standard operation speeds are strictly classified as violations of our
                acceptable use policies and will result in immediate termination of account access
                rights.
              </p>
              <h3>5. Limitation of Liability and Indemnification</h3>
              <p>
                The platform, its integrated sub-modules, and analytical evaluation instruments are
                delivered on an "as-is" and "as-available" architecture. To the fullest extent
                permitted by applicable law, the platform administrators, developers, and parent
                entities shall not be held liable for operational delays, algorithmic processing
                errors, data transmission drops, or automated hardware disconnects occurring during
                system use or evaluation trials.
              </p>
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
