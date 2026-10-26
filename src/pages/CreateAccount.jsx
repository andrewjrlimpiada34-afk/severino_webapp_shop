import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import { normalizePhilippineMobile, registrationProgress, registrationSteps, registrationStepFields } from '../lib/registration.js'

const OTP_LENGTH = 6
const OTP_RESEND_SECONDS = 60

function SectionTitle({ number, headingRef, children }) {
  return (
    <div className="create-step-title">
      <span className="create-step-number" aria-hidden="true">{number}</span>
      <h2 id="create-step-heading" ref={headingRef} tabIndex={-1}>{children}</h2>
      <span className="create-step-line" aria-hidden="true" />
    </div>
  )
}

function RegistrationField({ label, error, children, ...inputProps }) {
  return (
    <div className="create-field">
      <label className="label" htmlFor={inputProps.id}>{label}</label>
      {children || <input className="input" {...inputProps} />}
      {error && <p className="create-field-error" id={`${inputProps.id}-error`}>{error}</p>}
    </div>
  )
}

function PasswordIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function CreateAccount() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', mobile: '', password: '', confirmPassword: '',
    addressLine: '', barangay: '', city: '', province: '', zip: '', country: 'Philippines',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [createdOpen, setCreatedOpen] = useState(false)
  const [verifiedOpen, setVerifiedOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(1)
  const [touched, setTouched] = useState({})
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpState, setOtpState] = useState({
    sending: false, verifying: false, verified: false, message: '', challengeId: '', email: '',
  })
  const otpRefs = useRef([])
  const stepHeadingRef = useRef(null)
  const previousStepRef = useRef(1)
  const latestEmailRef = useRef('')
  const pendingRef = useRef({ send: false, verify: false, submit: false })
  const redirectTimerRef = useRef(null)
  const otpFocusTimerRef = useRef(null)
  const { register, sendRegisterOtp, verifyRegisterOtp } = useAuth()
  const navigate = useNavigate()
  const otp = otpDigits.join('')
  const email = form.email.trim().toLowerCase()
  const progress = registrationProgress(form, otpState)
  const busy = status.loading || otpState.sending || otpState.verifying

  const resetOtp = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''))
    setVerifiedOpen(false)
    setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }))
    setOtpState({ sending: false, verifying: false, verified: false, message: '', challengeId: '', email: '' })
    setResendCooldown(0)
  }

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'email') {
      latestEmailRef.current = value.trim().toLowerCase()
      if (latestEmailRef.current !== email) resetOtp()
    }
    setStatus((prev) => ({ ...prev, error: '' }))
  }

  const fieldProps = (name, extra = {}) => ({
    id: `create-${name}`,
    name,
    value: form[name],
    required: name !== 'addressLine',
    onChange: (event) => updateField(name, event.target.value),
    onBlur: () => setTouched((prev) => ({ ...prev, [name]: true })),
    'aria-invalid': Boolean(touched[name] && progress.errors[name]),
    'aria-describedby': touched[name] && progress.errors[name] ? `create-${name}-error` : undefined,
    ...extra,
  })
  const fieldError = (name) => touched[name] ? progress.errors[name] : ''
  const field = (name, label, extra) => <RegistrationField label={label} error={fieldError(name)} {...fieldProps(name, extra)} />

  const goToStep = (step) => {
    if (busy || step < 1 || step > progress.furthestStep) return
    setStatus({ loading: false, error: '', success: '' })
    setActiveStep(step)
  }

  const handleContinue = () => {
    const currentProgress = registrationProgress(form, otpState)
    if (!currentProgress.complete[activeStep - 1]) {
      setTouched((prev) => ({ ...prev, ...Object.fromEntries(registrationStepFields[activeStep - 1].map((name) => [name, true])) }))
      setStatus({ loading: false, error: activeStep === 2 ? 'Verify your email OTP before continuing.' : 'Please complete this step before continuing.', success: '' })
      return
    }
    goToStep(Math.min(activeStep + 1, currentProgress.furthestStep))
  }

  const handleOtpDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    setOtpDigits((prev) => prev.map((item, itemIndex) => itemIndex === index ? digit : item))
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  const handleOtpPaste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    setOtpDigits(Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] || ''))
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus()
  }

  const sendOtp = async () => {
    if (pendingRef.current.send || pendingRef.current.verify || resendCooldown > 0) return
    if (progress.errors.email) {
      setTouched((prev) => ({ ...prev, email: true }))
      setStatus({ loading: false, error: 'Enter a valid email address before sending OTP.', success: '' })
      return
    }
    pendingRef.current.send = true
    try {
      setStatus({ loading: false, error: '', success: '' })
      setOtpState((prev) => ({ ...prev, sending: true, message: '', verified: false }))
      const result = await sendRegisterOtp(email)
      if (latestEmailRef.current !== email) return
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setResendCooldown(OTP_RESEND_SECONDS)
      setOtpState({ sending: false, verifying: false, verified: false, message: result?.message || 'OTP sent to email', challengeId: result.challengeId, email })
      otpFocusTimerRef.current = window.setTimeout(() => otpRefs.current[0]?.focus(), 0)
    } catch (error) {
      if (latestEmailRef.current === email) setStatus({ loading: false, error: error.message, success: '' })
    } finally {
      pendingRef.current.send = false
      setOtpState((prev) => ({ ...prev, sending: false }))
    }
  }

  const verifyOtp = async () => {
    if (pendingRef.current.verify || pendingRef.current.send || progress.verified) return
    if (!otpState.challengeId || otpState.email !== email) {
      setStatus({ loading: false, error: 'Please send OTP first.', success: '' })
      return
    }
    if (otp.length !== OTP_LENGTH) {
      setStatus({ loading: false, error: 'Please enter the 6-digit OTP.', success: '' })
      return
    }
    pendingRef.current.verify = true
    try {
      setStatus({ loading: false, error: '', success: '' })
      setOtpState((prev) => ({ ...prev, verifying: true, message: '' }))
      const result = await verifyRegisterOtp({ challengeId: otpState.challengeId, code: otp })
      if (latestEmailRef.current !== email) return
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }))
      setOtpState((prev) => ({ ...prev, verifying: false, verified: true, message: result?.message || 'Email OTP verified' }))
      setVerifiedOpen(true)
    } catch (error) {
      if (latestEmailRef.current === email) setStatus({ loading: false, error: error.message, success: '' })
    } finally {
      pendingRef.current.verify = false
      setOtpState((prev) => ({ ...prev, verifying: false }))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy || pendingRef.current.submit) return
    if (activeStep < registrationSteps.length) {
      handleContinue()
      return
    }
    if (!progress.canCreate) {
      goToStep(progress.furthestStep)
      setStatus({ loading: false, error: 'Please complete all required fields and verify your email before creating an account.', success: '' })
      return
    }
    pendingRef.current.submit = true
    try {
      setStatus({ loading: true, error: '', success: '' })
      await register({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email,
        password: form.password,
        phone: normalizePhilippineMobile(form.mobile),
        addressLine: form.addressLine.trim(),
        barangay: form.barangay.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        zip: form.zip.trim(),
        country: form.country.trim(),
        verificationId: otpState.challengeId,
      })
      setStatus({ loading: false, error: '', success: '' })
      setCreatedOpen(true)
      redirectTimerRef.current = window.setTimeout(() => navigate('/login'), 1800)
    } catch (error) {
      pendingRef.current.submit = false
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const timer = window.setInterval(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  useEffect(() => {
    if (!verifiedOpen) return undefined
    const timer = window.setTimeout(() => setVerifiedOpen(false), 1150)
    return () => window.clearTimeout(timer)
  }, [verifiedOpen])

  useEffect(() => {
    if (previousStepRef.current !== activeStep) stepHeadingRef.current?.focus({ preventScroll: true })
    previousStepRef.current = activeStep
  }, [activeStep])

  useEffect(() => () => {
    window.clearTimeout(redirectTimerRef.current)
    window.clearTimeout(otpFocusTimerRef.current)
  }, [])

  return (
    <section className="create-account-page">
      <aside className="create-brand-panel" aria-hidden="true">
        <img className="create-brand-logo" src="/logo.svg" alt="" />
        <span className="create-brand-watermark">S</span>
        <span className="create-brand-ornament">— ୨୧ —</span>
      </aside>

      <div className="create-form-panel">
        <button className="button secondary create-back" type="button" disabled={busy} onClick={() => activeStep === 1 ? navigate('/login') : goToStep(activeStep - 1)}>
          Back
        </button>
        <div className="create-heading">
          <h1 className="section-title">Create <span>Severino</span> Account</h1>
          <p className="section-subtitle">Join us and begin your premium scented experience.</p>
        </div>

        <nav aria-label="Registration progress">
          <ol className="create-progress">
            {registrationSteps.map((label, index) => {
              const step = index + 1
              const completed = step < progress.furthestStep
              return (
                <li key={label} className={`${completed ? 'is-complete' : ''} ${step === activeStep ? 'is-active' : ''}`}>
                  <button type="button" onClick={() => goToStep(step)} disabled={busy || step > progress.furthestStep} aria-current={step === activeStep ? 'step' : undefined} aria-label={`${step}. ${label}${completed ? ', completed' : ''}`}>
                    <span className="create-progress-number" aria-hidden="true">{completed && step !== activeStep ? '✓' : step}</span>
                    <span className="create-progress-label">{label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <form className="create-account-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
          <div className="create-step-content" key={activeStep} role="group" aria-labelledby="create-step-heading">
            <SectionTitle number={activeStep} headingRef={stepHeadingRef}>
              {['Profile and Contact', 'Email Verification', 'Account Security', 'Address Info', 'Review Your Details'][activeStep - 1]}
            </SectionTitle>

            {activeStep === 1 && (
              <>
                <div className="grid two create-two">
                  {field('firstName', 'First Name', { placeholder: 'Enter first name', autoComplete: 'given-name' })}
                  {field('lastName', 'Last Name', { placeholder: 'Enter last name', autoComplete: 'family-name' })}
                </div>
                {field('email', 'Email', { type: 'email', placeholder: 'you@example.com', autoComplete: 'email' })}
                <RegistrationField label="Mobile Number" error={fieldError('mobile')} {...fieldProps('mobile')}>
                  <div className="create-phone-row">
                    <div className="create-phone-prefix"><span>PH</span><span>+63</span></div>
                    <input className="input" {...fieldProps('mobile', { type: 'tel', inputMode: 'tel', placeholder: '9XX XXX XXXX', autoComplete: 'tel' })} />
                  </div>
                </RegistrationField>
              </>
            )}

            {activeStep === 2 && (
              <>
                <p className="create-helper">Verify your email before continuing to account security.</p>
                <div className="create-field">
                  <label className="label" htmlFor="create-verification-email">Email</label>
                  <div className="create-phone-row create-email-row">
                    <input id="create-verification-email" className="input" type="email" value={form.email} readOnly />
                    <button className="button secondary create-send-otp" type="button" onClick={sendOtp} disabled={busy || resendCooldown > 0 || progress.verified}>
                      {otpState.sending && <span className="create-inline-spinner" aria-hidden="true" />}
                      {otpState.sending ? 'Sending...' : progress.verified ? 'Verified' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : otpState.challengeId ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  </div>
                </div>
                {otpState.challengeId && (
                  <>
                    <p className="create-helper" id="create-otp-help">Enter the 6-digit OTP sent to your email.</p>
                    <div className="create-otp-row">
                      <div className="create-otp-boxes" onPaste={handleOtpPaste} role="group" aria-label="Email verification code" aria-describedby="create-otp-help">
                        {otpDigits.map((digit, index) => (
                          <input key={index} ref={(node) => { otpRefs.current[index] = node }} className="create-otp-input" inputMode="numeric" maxLength={1} autoComplete={index === 0 ? 'one-time-code' : 'off'} aria-label={`OTP digit ${index + 1}`} value={digit} disabled={progress.verified || otpState.verifying} onChange={(event) => handleOtpDigitChange(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(index, event)} />
                        ))}
                      </div>
                      <button className="button secondary create-verify-otp" type="button" onClick={verifyOtp} disabled={busy || progress.verified || otp.length !== OTP_LENGTH}>
                        {otpState.verifying && <span className="create-inline-spinner" aria-hidden="true" />}
                        {progress.verified ? 'Verified' : otpState.verifying ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                  </>
                )}
                {otpState.message && <div className="pill create-status-pill" role="status">{otpState.message}</div>}
              </>
            )}

            {activeStep === 3 && (
              <>
                <div className="grid two create-two">
                  <RegistrationField label="Password" error={fieldError('password')} {...fieldProps('password')}>
                    <div className="input-row">
                      <input className="input" {...fieldProps('password', { type: showPassword ? 'text' : 'password', placeholder: 'Minimum 8 characters', autoComplete: 'new-password' })} />
                      <button type="button" className="icon-button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}><PasswordIcon /></button>
                    </div>
                  </RegistrationField>
                  <RegistrationField label="Confirm Password" error={fieldError('confirmPassword')} {...fieldProps('confirmPassword')}>
                    <div className="input-row">
                      <input className="input" {...fieldProps('confirmPassword', { type: showConfirm ? 'text' : 'password', placeholder: 'Re-enter password', autoComplete: 'new-password' })} />
                      <button type="button" className="icon-button" onClick={() => setShowConfirm((prev) => !prev)} aria-label={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'}><PasswordIcon /></button>
                    </div>
                  </RegistrationField>
                </div>
                <ul className="create-password-requirements" aria-label="Password requirements">
                  <li className={form.password.length >= 8 ? 'is-complete' : ''}>At least 8 characters</li>
                  <li className={form.confirmPassword && form.password === form.confirmPassword ? 'is-complete' : ''}>Passwords match</li>
                </ul>
              </>
            )}

            {activeStep === 4 && (
              <>
                {field('addressLine', 'Street Address (Optional)', { placeholder: 'House number, street, building, etc.', autoComplete: 'address-line1' })}
                <div className="grid two create-two">
                  {field('barangay', 'Barangay', { placeholder: 'Enter barangay', autoComplete: 'address-line2' })}
                  {field('city', 'City / Municipality', { placeholder: 'Enter city or municipality', autoComplete: 'address-level2' })}
                </div>
                <div className="grid two create-two">
                  {field('province', 'Province / State', { placeholder: 'Enter province or state', autoComplete: 'address-level1' })}
                  {field('zip', 'ZIP Code', { placeholder: 'Enter ZIP code', autoComplete: 'postal-code' })}
                </div>
                {field('country', 'Country', { autoComplete: 'country-name' })}
              </>
            )}

            {activeStep === 5 && (
              <div className="create-review">
                <div className="create-review-heading"><h3>Profile and Contact</h3><button className="terms-link" type="button" onClick={() => goToStep(1)}>Edit profile</button></div>
                <dl>
                  <div><dt>Name</dt><dd>{form.firstName.trim()} {form.lastName.trim()}</dd></div>
                  <div><dt>Email</dt><dd>{email} <span className="create-review-verified">Verified</span></dd></div>
                  <div><dt>Mobile</dt><dd>{normalizePhilippineMobile(form.mobile)}</dd></div>
                </dl>
                <div className="create-review-heading"><h3>Delivery Address</h3><button className="terms-link" type="button" onClick={() => goToStep(4)}>Edit address</button></div>
                <p>{[form.addressLine, form.barangay, form.city, form.province, form.zip, form.country].map((value) => value.trim()).filter(Boolean).join(', ')}</p>
                <div className="create-review-heading"><h3>Account Security</h3><button className="terms-link" type="button" onClick={() => goToStep(3)}>Edit password</button></div>
                <p>Password is set.</p>
              </div>
            )}
          </div>

          {status.error && <div className="card create-error-card" role="alert">{status.error}</div>}
          <div className="create-step-actions">
            <span className="create-step-caption">Step {activeStep} of {registrationSteps.length}</span>
            <button className={`button ${activeStep === 5 ? 'create-submit' : 'create-step-next'}`} type="submit" disabled={busy || createdOpen || (activeStep === 5 ? !progress.canCreate : !progress.complete[activeStep - 1])}>
              {status.loading && <span className="create-inline-spinner" aria-hidden="true" />}
              {status.loading ? 'Please wait...' : activeStep === 5 ? 'Create Account' : 'Continue'}
            </button>
          </div>
          <div className="pill create-status-pill">Data is encrypted at rest</div>
          <div className="create-bottom-ornament" aria-hidden="true">— ୨୧ —</div>
        </form>
      </div>

      {createdOpen && (
        <Modal onClick={() => navigate('/login')}>
          <div className="modal-card account-success-modal create-success-modal" role="dialog" aria-modal="true" aria-labelledby="create-success-title" onClick={(event) => event.stopPropagation()}>
            <div className="account-success-icon" aria-hidden="true">✓</div>
            <div className="create-bottom-ornament" aria-hidden="true">— ୨୧ —</div>
            <h2 id="create-success-title" className="section-title" style={{ fontSize: '30px' }}>Account Created Successfully!</h2>
            <p className="section-subtitle">You can now login.</p>
            <button className="button" type="button" onClick={() => navigate('/login')}>OK</button>
          </div>
        </Modal>
      )}
      {verifiedOpen && (
        <Modal className="create-verified-backdrop">
          <div className="modal-card create-verified-modal" role="status" aria-live="polite">
            <div className="create-verified-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" /><path d="M15 27.5L22.4 35L38 18.5" /></svg></div>
            <strong>Email Verified</strong>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default CreateAccount