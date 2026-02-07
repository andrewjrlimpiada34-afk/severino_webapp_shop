import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function Account() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    addressLine: '',
    barangay: '',
    city: '',
    province: '',
    zip: '',
    country: '',
    backupAddress: '',
    profileImage: '',
  })
  const [status, setStatus] = useState({ loading: true, error: '', success: '' })
  const [theme, setTheme] = useState('Default')
  const [userId, setUserId] = useState('')
  const [securityOpen, setSecurityOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: '', success: '' })

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '', success: '' })
        const data = await api.profile()
        setForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          addressLine: data.addressLine || '',
          barangay: data.barangay || '',
          city: data.city || '',
          province: data.province || '',
          zip: data.zip || '',
          country: data.country || '',
          backupAddress: data.backupAddress || '',
          profileImage: data.profileImage || '',
        })
        setUserId(data.id || '')
        const savedTheme =
          data.preferredTheme ||
          (data.id ? localStorage.getItem(`severino_theme_${data.id}`) : '') ||
          'Default'
        setTheme(savedTheme)
        if (savedTheme === 'Default') {
          document.documentElement.removeAttribute('data-theme')
        } else {
          document.documentElement.setAttribute('data-theme', savedTheme)
        }
        setStatus({ loading: false, error: '', success: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message, success: '' })
      }
    }
    load()
  }, [])

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (
      !form.name ||
      !form.email ||
      !form.phone ||
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
      await api.updateProfile(form)
      setStatus({ loading: false, error: '', success: 'Profile updated.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ loading: false, error: 'Passwords do not match.', success: '' })
      return
    }
    try {
      setPasswordStatus({ loading: true, error: '', success: '' })
      await api.updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordStatus({
        loading: false,
        error: '',
        success: 'Password updated successfully.',
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordStatus({ loading: false, error: error.message, success: '' })
    }
  }

  const handleThemeChange = (value) => {
    setTheme(value)
    if (value === 'Default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', value)
    }
    if (userId) {
      localStorage.setItem(`severino_theme_${userId}`, value)
    }
    api.updateTheme(value).catch(() => {})
  }

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Account Page</h1>
        <p className="section-subtitle">
          Manage your profile, delivery addresses, and security settings.
        </p>
      </div>

      <div className="card form">
        <div className="label">Theme Preference</div>
        <select
          className="input"
          value={theme}
          onChange={(event) => handleThemeChange(event.target.value)}
        >
          <option>Default</option>
          <option>Daylight</option>
          <option>Pink Splush</option>
          <option>Blazing Maroon</option>
          <option>Forest Brown</option>
          <option>Beach Blue</option>
          <option>Luxurious Gold</option>
          <option>Shadow Dark Mode</option>
        </select>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading profile...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      {status.success && <div className="card">{status.success}</div>}

      <form className="grid two" onSubmit={handleSubmit}>
        <div className="card form">
          <div>
            <div className="label">Profile Picture (Optional)</div>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () =>
                  setForm((prev) => ({ ...prev, profileImage: String(reader.result) }))
                reader.readAsDataURL(file)
              }}
            />
          </div>
          <div>
            <div className="label">Full Name</div>
            <input
              className="input"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Mobile Number</div>
            <input
              className="input"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </div>
          <button className="button" type="submit" disabled={status.loading}>
            Update Profile
          </button>
        </div>

        <div className="card form">
          <div className="label">Street Address (Optional)</div>
          <input
            className="input"
            value={form.addressLine}
            onChange={(event) => updateField('addressLine', event.target.value)}
          />
          <div className="label">Backup Address (Optional)</div>
          <input
            className="input"
            value={form.backupAddress}
            onChange={(event) => updateField('backupAddress', event.target.value)}
          />
          <div className="grid two">
            <div>
              <div className="label">Barangay (Required)</div>
              <input
                className="input"
                value={form.barangay}
                onChange={(event) => updateField('barangay', event.target.value)}
              />
            </div>
            <div>
              <div className="label">City/Municipality (Required)</div>
              <input
                className="input"
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
                value={form.province}
                onChange={(event) => updateField('province', event.target.value)}
              />
            </div>
            <div>
              <div className="label">ZIP Code (Required)</div>
              <input
                className="input"
                value={form.zip}
                onChange={(event) => updateField('zip', event.target.value)}
              />
            </div>
          </div>
          <div className="label">Country (Required)</div>
          <input
            className="input"
            value={form.country}
            onChange={(event) => updateField('country', event.target.value)}
          />
          <div className="label">Security</div>
          <div className="pill">Two-factor verification enabled</div>
          <button
            className="button secondary"
            type="button"
            onClick={() => setSecurityOpen((prev) => !prev)}
          >
            {securityOpen ? 'Hide Security' : 'Manage Security'}
          </button>
        </div>
      </form>

      {securityOpen && (
        <form className="card form" onSubmit={handlePasswordChange}>
          <div className="label">Change Password</div>
          <div>
            <div className="label">Current Password</div>
            <div className="input-row">
              <input
                className="input"
                type={showCurrent ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowCurrent((prev) => !prev)}
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
            <div className="label">New Password</div>
            <div className="input-row">
              <input
                className="input"
                type={showNew ? 'text' : 'password'}
                placeholder="At least 8 chars, letters, numbers, symbols"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowNew((prev) => !prev)}
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
            <div className="label">Confirm New Password</div>
            <div className="input-row">
              <input
                className="input"
                type={showConfirm ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
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
          {passwordStatus.error && <div className="card">Error: {passwordStatus.error}</div>}
          {passwordStatus.success && <div className="card">{passwordStatus.success}</div>}
          <button className="button" type="submit" disabled={passwordStatus.loading}>
            {passwordStatus.loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
    </section>
  )
}

export default Account
