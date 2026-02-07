import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

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
    country: '',
  })
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const { register } = useAuth()

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.password !== form.confirmPassword) {
      setStatus({ loading: false, error: 'Passwords do not match.', success: '' })
      return
    }
    if (
      !form.firstName ||
      !form.lastName ||
      !form.email ||
      !form.mobile ||
      !form.barangay ||
      !form.city ||
      !form.province ||
      !form.zip ||
      !form.country
    ) {
      setStatus({ loading: false, error: 'Please complete all fields.', success: '' })
      return
    }
    try {
      setStatus({ loading: true, error: '', success: '' })
      const result = await register(`${form.firstName} ${form.lastName}`.trim(), form.email, form.password, {
        phone: form.mobile,
        addressLine: form.addressLine,
        barangay: form.barangay,
        city: form.city,
        province: form.province,
        zip: form.zip,
        country: form.country,
      })
      if (result?.challengeId) {
        setChallengeId(result.challengeId)
        setStatus({
          loading: false,
          error: '',
          success: 'Account created. Verification code sent to your email.',
        })
      } else {
        setStatus({
          loading: false,
          error: '',
          success: 'Account created. Please contact support to verify.',
        })
      }
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  const handleVerify = async (event) => {
    event.preventDefault()
    try {
      setStatus({ loading: true, error: '', success: '' })
      await api.verify2fa({ challengeId, code })
      setStatus({
        loading: false,
        error: '',
        success: 'Email verified. You can now log in.',
      })
    } catch (error) {
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

      <form className="card form" onSubmit={challengeId ? handleVerify : handleSubmit}>
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
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Mobile Number</div>
            <input
              className="input"
              placeholder="+63 9xx xxx xxxx"
              autoComplete="tel"
              required
              value={form.mobile}
              onChange={(event) => updateField('mobile', event.target.value)}
            />
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
        {challengeId && (
          <div>
            <div className="label">Verification Code</div>
            <input
              className="input"
              placeholder="6-digit code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
        )}
        {status.error && <div className="card">Error: {status.error}</div>}
        {status.success && <div className="card">{status.success}</div>}
        <button className="button" type="submit" disabled={status.loading}>
          {status.loading ? 'Please wait...' : challengeId ? 'Verify Email' : 'Create Account'}
        </button>
      </form>
    </section>
  )
}

export default CreateAccount
