import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const OTP_LENGTH = 6
const OTP_RESEND_SECONDS = 60

const normalizePhilippineMobile = (value = '') => {
  const compact = value.replace(/[\s-]/g, '')
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`
  if (/^9\d{9}$/.test(compact)) return `+63${compact}`
  if (/^\+639\d{9}$/.test(compact)) return compact
  if (/^639\d{9}$/.test(compact)) return `+${compact}`
  return ''
}

function SectionTitle({ number, children }) {
  return (
    <div className="create-step-title">
      <span className="create-step-number">{number}</span>
      <h2>{children}</h2>
      <span className="create-step-line" aria-hidden="true" />
    </div>
  )
}

function CreateAccount() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    addressLine: '',
    barangay: '',
    city: '',
    province: '',
    zip: '',
    country: 'Philippines',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [createdOpen, setCreatedOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(1)
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef([])
  const [otpState, setOtpState] = useState({
    sending: false,
    verifying: false,
    verified: false,
    message: '',
    challengeId: '',
    email: '',
  })
  const { register, sendRegisterOtp, verifyRegisterOtp } = useAuth()
  const navigate = useNavigate()
  const otp = otpDigits.join('')
  const firstName = form.firstName.trim()
  const lastName = form.lastName.trim()
  const email = form.email.trim().toLowerCase()
  const mobile = normalizePhilippineMobile(form.mobile)
  const profileStepComplete = Boolean(firstName && lastName && email && mobile)
  const passwordStepComplete =
    otpState.verified &&
    otpState.email === email &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const resetOtp = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''))
    setOtpState({
      sending: false,
      verifying: false,
      verified: false,
      message: '',
      challengeId: '',
      email: '',
    })
  }

  const handleOtpDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    setOtpDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((digit, index) => {
      next[index] = digit
    })
    setOtpDigits(next)
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const addressLine = form.addressLine.trim()
    const barangay = form.barangay.trim()
    const city = form.city.trim()
    const province = form.province.trim()
    const zip = form.zip.trim()
    const country = form.country.trim()

    if (form.password !== form.confirmPassword) {
      setStatus({ loading: false, error: 'Passwords do not match.', success: '' })
      return
    }
    if (form.password.length < 8) {
      setStatus({ loading: false, error: 'Password must be at least 8 characters.', success: '' })
      return
    }
    if (
      !firstName ||
      !lastName ||
      !email ||
      !mobile ||
      !barangay ||
      !city ||
      !province ||
      !zip ||
      !country
    ) {
      setStatus({ loading: false, error: 'Please complete all fields.', success: '' })
      return
    }
    if (!otpState.verified || !otpState.challengeId || otpState.email !== email) {
      setStatus({ loading: false, error: 'Verify OTP before creating account', success: '' })
      return
    }
    try {
      setStatus({ loading: true, error: '', success: '' })
      await register({
        name: `${firstName} ${lastName}`,
        email,
        password: form.password,
        phone: mobile,
        addressLine,
        barangay,
        city,
        province,
        zip,
        country,
        verificationId: otpState.challengeId,
      })
      setStatus({ loading: false, error: '', success: '' })
      setCreatedOpen(true)
      setTimeout(() => navigate('/login'), 1800)
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  useEffect(() => {
    const email = form.email.trim().toLowerCase()
    if (!otpState.email || otpState.email === email) return
    resetOtp()
  }, [form.email, otpState.email])

  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const timer = setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const sendOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({
        loading: false,
        error: 'Enter a valid email address before sending OTP.',
        success: '',
      })
      return
    }
    if (resendCooldown > 0) return
    try {
      setStatus({ loading: false, error: '', success: '' })
      setOtpState((prev) => ({ ...prev, sending: true, message: '', verified: false }))
      const result = await sendRegisterOtp(email)
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setResendCooldown(OTP_RESEND_SECONDS)
      setOtpState({
        sending: false,
        verifying: false,
        verified: false,
        message: result?.message || 'OTP sent to email',
        challengeId: result.challengeId,
        email,
      })
      setTimeout(() => otpRefs.current[0]?.focus(), 0)
    } catch (error) {
      setOtpState((prev) => ({ ...prev, sending: false }))
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  const goToVerificationStep = () => {
    if (!profileStepComplete) {
      setStatus({
        loading: false,
        error: 'Please complete first name, last name, email, and mobile number first.',
        success: '',
      })
      return
    }
    setStatus({ loading: false, error: '', success: '' })
    setActiveStep(2)
  }

  const goToAddressStep = () => {
    if (!passwordStepComplete) {
      setStatus({
        loading: false,
        error: 'Verify your email OTP and make sure your passwords match first.',
        success: '',
      })
      return
    }
    setStatus({ loading: false, error: '', success: '' })
    setActiveStep(3)
  }

  const verifyOtp = async () => {
    if (!otpState.challengeId) {
      setStatus({ loading: false, error: 'Please send OTP first.', success: '' })
      return
    }
    if (otp.length !== OTP_LENGTH) {
      setStatus({ loading: false, error: 'Please enter the 6-digit OTP.', success: '' })
      return
    }
    try {
      setStatus({ loading: false, error: '', success: '' })
      setOtpState((prev) => ({ ...prev, verifying: true, message: '' }))
      const result = await verifyRegisterOtp({
        challengeId: otpState.challengeId,
        code: otp,
      })
      setOtpState((prev) => ({
        ...prev,
        verifying: false,
        verified: true,
        message: result?.message || 'Email OTP verified',
      }))
    } catch (error) {
      setOtpState((prev) => ({ ...prev, verifying: false }))
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  return (
    <section className="create-account-page">
      <aside className="create-brand-panel" aria-hidden="true">
        <img className="create-brand-logo" src="/logo.svg" alt="" />
        <span className="create-brand-watermark">S</span>
        <span className="create-brand-ornament">— ୨୧ —</span>
      </aside>

      <div className="create-form-panel">
        <button className="button secondary create-back" type="button" onClick={() => navigate('/login')}>
          Back
        </button>
        <div className="create-heading">
          <h1 className="section-title">
            Create <span>Severino</span> Account
          </h1>
          <p className="section-subtitle">
            Join us and begin your premium scented experience.
          </p>
        </div>

        <form className="create-account-form" onSubmit={handleSubmit}>
          <SectionTitle number="1">Profile and Contact</SectionTitle>
          <div className="grid two create-two">
            <div>
              <div className="label">First Name</div>
              <input
                className="input"
                placeholder="Enter first name"
                required
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
              />
            </div>
            <div>
              <div className="label">Last Name</div>
              <input
                className="input"
                placeholder="Enter last name"
                required
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
              />
            </div>
          </div>
          <div>
            <div className="label">Email</div>
            <div className="create-phone-row">
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
              <button
                type="button"
                className="button secondary create-send-otp"
                onClick={sendOtp}
                disabled={otpState.sending || resendCooldown > 0}
              >
                {otpState.sending
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : otpState.challengeId
                      ? 'Resend OTP'
                      : 'Send OTP'}
              </button>
            </div>
            {otpState.message && <div className="pill create-status-pill">{otpState.message}</div>}
          </div>
          <div>
            <div className="label">Mobile Number</div>
            <div className="create-phone-row">
              <div className="create-phone-prefix">
                <span>🇵🇭</span>
                <span>+63</span>
              </div>
              <input
                className="input"
                placeholder="9XX XXX XXXX"
                autoComplete="tel"
                required
                value={form.mobile}
                onChange={(event) => updateField('mobile', event.target.value)}
              />
            </div>
          </div>

          {activeStep === 1 && (
            <button
              type="button"
              className="button create-step-next"
              onClick={goToVerificationStep}
              disabled={!profileStepComplete}
            >
              Continue to Email Verification
            </button>
          )}

          {activeStep >= 2 && (
            <>
              <SectionTitle number="2">Email Verification</SectionTitle>
              <p className="create-helper">Please enter the 6-digit OTP sent to your email:</p>
              <div className="create-otp-row">
                <div className="create-otp-boxes" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => {
                        otpRefs.current[index] = node
                      }}
                      className="create-otp-input"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`OTP digit ${index + 1}`}
                      value={digit}
                      onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="button secondary create-verify-otp"
                  onClick={verifyOtp}
                  disabled={otpState.verifying || otpState.verified}
                >
                  {otpState.verified ? 'Verified' : otpState.verifying ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
              <div className="pill create-status-pill">
                {otpState.verified ? 'Email OTP verified' : 'Verify OTP before creating account'}
              </div>

              <div className="grid two create-two">
                <div>
                  <div className="label">Password</div>
                  <div className="input-row">
                    <input
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      required
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
                <div>
                  <div className="label">Confirm Password</div>
                  <div className="input-row">
                    <input
                      className="input"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      required
                      value={form.confirmPassword}
                      onChange={(event) => updateField('confirmPassword', event.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShowConfirm((prev) => !prev)}
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
              </div>

              {activeStep === 2 && (
                <button
                  type="button"
                  className="button create-step-next"
                  onClick={goToAddressStep}
                  disabled={!passwordStepComplete}
                >
                  Continue to Address Info
                </button>
              )}
            </>
          )}

          {activeStep >= 3 && (
            <>
              <SectionTitle number="3">Address Info</SectionTitle>
              <div className="grid two create-two">
                <div>
                  <div className="label">Street Address (Optional)</div>
                  <input
                    className="input"
                    placeholder="House number, street, building, etc."
                    value={form.addressLine}
                    onChange={(event) => updateField('addressLine', event.target.value)}
                  />
                </div>
                <div>
                  <div className="label">Barangay (Required)</div>
                  <input
                    className="input"
                    required
                    placeholder="Enter barangay"
                    value={form.barangay}
                    onChange={(event) => updateField('barangay', event.target.value)}
                  />
                </div>
              </div>
              <div className="grid two create-two">
                <div>
                  <div className="label">City/Municipality (Required)</div>
                  <input
                    className="input"
                    required
                    placeholder="Enter city or municipality"
                    value={form.city}
                    onChange={(event) => updateField('city', event.target.value)}
                  />
                </div>
                <div>
                  <div className="label">Province/State (Required)</div>
                  <input
                    className="input"
                    required
                    placeholder="Enter province or state"
                    value={form.province}
                    onChange={(event) => updateField('province', event.target.value)}
                  />
                </div>
              </div>
              <div className="grid two create-two">
                <div>
                  <div className="label">ZIP Code (Required)</div>
                  <input
                    className="input"
                    required
                    placeholder="Enter ZIP code"
                    value={form.zip}
                    onChange={(event) => updateField('zip', event.target.value)}
                  />
                </div>
                <div>
                  <div className="label">Country (Required)</div>
                  <input
                    className="input"
                    required
                    value={form.country}
                    onChange={(event) => updateField('country', event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="pill create-status-pill">Data is encrypted at rest</div>
          {status.error && <div className="card create-error-card">Error: {status.error}</div>}
          {activeStep >= 3 && (
            <button className="button create-submit" type="submit" disabled={status.loading}>
              {status.loading ? 'Please wait...' : 'Confirm'}
            </button>
          )}
          <div className="create-bottom-ornament" aria-hidden="true">— ୨୧ —</div>
        </form>
      </div>

      {createdOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => navigate('/login')}>
          <div
            className="modal-card account-success-modal create-success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-success-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="account-success-icon" aria-hidden="true">✓</div>
            <div className="create-bottom-ornament" aria-hidden="true">— ୨୧ —</div>
            <h2 id="create-success-title" className="section-title" style={{ fontSize: '30px' }}>
              Account Created Successfully!
            </h2>
            <p className="section-subtitle">You can now login.</p>
            <button className="button" type="button" onClick={() => navigate('/login')}>
              OK
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default CreateAccount
