import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const normalizePhilippineMobile = (value = '') => {
  const compact = value.replace(/[\s-]/g, '')
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`
  if (/^\+639\d{9}$/.test(compact)) return compact
  if (/^639\d{9}$/.test(compact)) return `+${compact}`
  return ''
}

function CreateAccount() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    addressLine: '',
    barangay: '',
    city: '',
    province: '',
    zip: '',
    country: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [otp, setOtp] = useState('')
  const [otpState, setOtpState] = useState({
    sending: false,
    verifying: false,
    verified: false,
    message: '',
    challengeId: '',
    mobile: '',
  })
  const { register, sendRegisterOtp, verifyRegisterOtp } = useAuth()
  const navigate = useNavigate()

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const mobile = normalizePhilippineMobile(form.mobile)
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
    if (!otpState.verified || !otpState.challengeId || otpState.mobile !== mobile) {
      setStatus({ loading: false, error: 'Verify OTP before creating account', success: '' })
      return
    }
    try {
      setStatus({ loading: true, error: '', success: '' })
      await register({
        name: `${firstName} ${lastName}`,
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
      setStatus({
        loading: false,
        error: '',
        success: 'Account created successfully. You can now log in.',
      })
      setTimeout(() => navigate('/login'), 800)
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  useEffect(() => {
    const mobile = normalizePhilippineMobile(form.mobile)
    if (!otpState.mobile || otpState.mobile === mobile) return
    setOtp('')
    setOtpState({
      sending: false,
      verifying: false,
      verified: false,
      message: '',
      challengeId: '',
      mobile: '',
    })
  }, [form.mobile, otpState.mobile])

  const sendOtp = async () => {
    const mobile = normalizePhilippineMobile(form.mobile)
    if (!mobile) {
      setStatus({
        loading: false,
        error: 'Enter a valid Philippine mobile number before sending OTP.',
        success: '',
      })
      return
    }
    try {
      setStatus({ loading: false, error: '', success: '' })
      setOtpState((prev) => ({ ...prev, sending: true, message: '', verified: false }))
      const result = await sendRegisterOtp(mobile)
      setOtp('')
      setOtpState({
        sending: false,
        verifying: false,
        verified: false,
        message: result?.message || 'OTP sent to mobile number',
        challengeId: result.challengeId,
        mobile,
      })
    } catch (error) {
      setOtpState((prev) => ({ ...prev, sending: false }))
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  const verifyOtp = async () => {
    if (!otpState.challengeId) {
      setStatus({ loading: false, error: 'Please send OTP first.', success: '' })
      return
    }
    try {
      setOtpState((prev) => ({ ...prev, verifying: true, message: '' }))
      const result = await verifyRegisterOtp({
        challengeId: otpState.challengeId,
        code: otp.trim(),
      })
      setOtpState((prev) => ({
        ...prev,
        verifying: false,
        verified: true,
        message: result?.message || 'Mobile OTP verified',
      }))
    } catch (error) {
      setOtpState((prev) => ({ ...prev, verifying: false }))
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }
  return (
    <section className="grid" style={{ gap: '24px', maxWidth: '980px', margin: '0 auto' }}>
      <div>
        <button className="button secondary" type="button" onClick={() => (window.location.href = '/login')}>
          Back
        </button>
        <h1 className="section-title">Create Account</h1>
        <p className="section-subtitle">
          Start your premium scent experience with secure onboarding.
        </p>
      </div>

      <form className="card form" onSubmit={handleSubmit}>
        <div className="grid two">
          <div>
            <div className="label">First Name</div>
            <input
              className="input"
              placeholder="First name"
              required
              value={form.firstName}
              onChange={(event) => updateField('firstName', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Last Name</div>
            <input
              className="input"
              placeholder="Last name"
              required
              value={form.lastName}
              onChange={(event) => updateField('lastName', event.target.value)}
            />
          </div>
        </div>
        <div className="grid two">
          <div>
            <div className="label">Mobile Number</div>
            <div className="input-row">
              <input
                className="input"
                placeholder="+63 9xx xxx xxxx"
                autoComplete="tel"
                required
                value={form.mobile}
                onChange={(event) => updateField('mobile', event.target.value)}
              />
              <button
                type="button"
                className="button secondary"
                onClick={sendOtp}
                disabled={otpState.sending}
              >
                {otpState.sending ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
            {otpState.message && <div className="pill">{otpState.message}</div>}
          </div>
          <div>
            <div className="label">OTP Status</div>
            <div className="pill" style={{ minHeight: '54px', display: 'flex', alignItems: 'center' }}>
              {otpState.verified ? 'Mobile OTP verified' : 'Verify OTP before creating account'}
            </div>
          </div>
        </div>
        <div className="grid two">
          <div>
            <div className="label">OTP</div>
            <div className="input-row">
              <input
                className="input"
                placeholder="6-digit OTP"
                inputMode="numeric"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
              />
              <button
                type="button"
                className="button secondary"
                onClick={verifyOtp}
                disabled={otpState.verifying || otpState.verified}
              >
                {otpState.verified ? 'Verified' : otpState.verifying ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          </div>
          <div className="pill" style={{ alignSelf: 'end' }}>
            {otpState.verified ? 'Mobile OTP verified' : 'Verify OTP before creating account'}
          </div>
        </div>
        <div className="grid two">
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
        <div className="label">Street Address (Optional)</div>
        <input
          className="input"
          placeholder="House number, street"
          value={form.addressLine}
          onChange={(event) => updateField('addressLine', event.target.value)}
        />
        <div className="grid two">
          <div>
            <div className="label">Barangay (Required)</div>
            <input
              className="input"
              required
              value={form.barangay}
              onChange={(event) => updateField('barangay', event.target.value)}
            />
          </div>
          <div>
            <div className="label">City/Municipality (Required)</div>
            <input
              className="input"
              required
              value={form.city}
              onChange={(event) => updateField('city', event.target.value)}
            />
          </div>
        </div>
        <div className="grid two">
          <div>
            <div className="label">Province/State (Required)</div>
            <input
              className="input"
              required
              value={form.province}
              onChange={(event) => updateField('province', event.target.value)}
            />
          </div>
          <div>
            <div className="label">ZIP Code (Required)</div>
            <input
              className="input"
              required
              value={form.zip}
              onChange={(event) => updateField('zip', event.target.value)}
            />
          </div>
        </div>
        <div className="label">Country (Required)</div>
        <input
          className="input"
          required
          value={form.country}
          onChange={(event) => updateField('country', event.target.value)}
        />
        <div className="pill">Data is encrypted at rest</div>
        {status.error && <div className="card">Error: {status.error}</div>}
        {status.success && <div className="card">{status.success}</div>}
        <button className="button" type="submit" disabled={status.loading}>
          {status.loading ? 'Please wait...' : 'Create Account'}
        </button>
      </form>
    </section>
  )
}

export default CreateAccount
