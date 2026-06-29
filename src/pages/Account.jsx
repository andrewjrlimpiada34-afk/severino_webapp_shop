import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { compressImageFile } from '../lib/image.js'
import { CardSkeleton } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function Account() {
  const navigate = useNavigate()
  const { logout } = useAuth()
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
  const [canManageSecurity, setCanManageSecurity] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [profileUpdatedOpen, setProfileUpdatedOpen] = useState(false)
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
        setCanManageSecurity(Boolean(data.hasPassword ?? data.passwordHash))
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
        if (error.status === 401) {
          await logout().catch(() => {})
          navigate('/login', { replace: true })
          return
        }
        setStatus({ loading: false, error: error.message, success: '' })
      }
    }
    load()
  }, [logout, navigate])

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (
      !form.name ||
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
      setStatus({ loading: false, error: '', success: '' })
      setProfileUpdatedOpen(true)
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
      <div className="account-hero">
        <div className="tag">Severino Account</div>
        <h1 className="section-title">Account</h1>
        <p className="section-subtitle">
          Manage your profile, delivery addresses, and security settings.
        </p>
      </div>

      <div>
        <h2 className="section-title" style={{ fontSize: '26px' }}>Profile & Contacts</h2>
        <p className="section-subtitle">Keep your details up to date for faster deliveries.</p>
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

      {status.loading && <CardSkeleton lines={4} />}
      {status.error && <div className="card">Error: {status.error}</div>}

      <form className="grid two account-profile-grid" onSubmit={handleSubmit}>
        <div className="card form">
          <h3 className="account-form-title">Profile</h3>
          <div>
            <div className="label">Profile Picture (Optional)</div>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                compressImageFile(file, { maxSize: 800, quality: 0.8 })
                  .then((compressed) => api.uploadImage(compressed))
                  .then((upload) =>
                    setForm((prev) => ({ ...prev, profileImage: String(upload.url) }))
                  )
                  .catch((error) =>
                    setStatus({
                      loading: false,
                      error: error?.message || 'Failed to process image.',
                      success: '',
                    })
                  )
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
          {!canManageSecurity && (
            <div>
              <div className="label">Email</div>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </div>
          )}
          <div>
            <div className="label">Mobile Number</div>
            <input
              className="input"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </div>
        </div>

        <div className="card form">
          <h3 className="account-form-title">Contact Info</h3>
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
        </div>
        <div className="account-update-actions">
          <button className="button" type="submit" disabled={status.loading}>
            {status.loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </form>

      {canManageSecurity && (
        <div className="card form">
          <h2 className="section-title" style={{ fontSize: '24px' }}>Password Manager</h2>
          <div className="pill">Use your current password before setting a new one.</div>
          <button
            className="button secondary"
            type="button"
            onClick={() => setSecurityOpen((prev) => !prev)}
          >
            {securityOpen ? 'Hide Password Manager' : 'Manage Password'}
          </button>
        </div>
      )}

      {canManageSecurity && securityOpen && (
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

      {profileUpdatedOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setProfileUpdatedOpen(false)}
        >
          <div
            className="modal-card account-success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-updated-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setProfileUpdatedOpen(false)}
            >
              X
            </button>
            <div className="account-success-icon" aria-hidden="true">✓</div>
            <div className="tag">Profile Updated</div>
            <h2 id="profile-updated-title" className="section-title" style={{ fontSize: '30px' }}>
              Changes saved
            </h2>
            <p className="section-subtitle">
              Your profile and contact information were updated successfully.
            </p>
            <button className="button" type="button" onClick={() => setProfileUpdatedOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default Account
