import Modal from '../components/Modal.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { compressImageFile } from '../lib/image.js'
import { CardSkeleton } from '../components/Skeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import StoreIcon from '../components/StoreIcon.jsx'
import { FONT_OPTIONS, applyFontPreference, readFontPreference, saveFontPreference } from '../lib/fontPreference.js'

function Account() {
  const navigate = useNavigate()
  const { logout, updateUser } = useAuth()
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
  const [font, setFont] = useState('editorial')
  const [userId, setUserId] = useState('')
  const [canManageSecurity, setCanManageSecurity] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [profileUpdatedOpen, setProfileUpdatedOpen] = useState(false)
  const photoInput = useRef(null)
  const [photoUploading, setPhotoUploading] = useState(false)
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
        const savedFont = readFontPreference(data.id)
        setFont(savedFont)
        applyFontPreference(savedFont)
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
      const updated = await api.updateProfile(form)
      updateUser(updated)
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

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const compressed = await compressImageFile(file, { maxSize: 800, quality: 0.8 })
      const upload = await api.uploadImage(compressed)
      setForm((previous) => ({ ...previous, profileImage: String(upload.url) }))
    } catch (error) {
      setStatus({ loading: false, error: error?.message || 'Failed to process image.', success: '' })
    } finally {
      setPhotoUploading(false)
      event.target.value = ''
    }
  }
  const initials = form.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S'
  const selectedFont = FONT_OPTIONS.find((option) => option.id === font) || FONT_OPTIONS[0]

  return (
    <section className="boutique-page boutique-account">
      <header className="store-page-heading"><span className="store-eyebrow">Your Severino space</span><h1>My account</h1><p>A few details for a more personal experience.</p></header>

      <div className="store-account-identity">
        <div className="store-account-avatar">{form.profileImage ? <img src={form.profileImage} alt="Your profile" /> : <span>{initials}</span>}</div>
        <div className="store-account-name"><strong>{form.name || 'Your profile'}</strong>{form.email && <span>{form.email}</span>}<button className="store-text-link" type="button" onClick={() => photoInput.current?.click()} disabled={status.loading || photoUploading}>{photoUploading ? 'Uploading photo...' : 'Change photo'}</button><input ref={photoInput} className="sr-only" type="file" accept="image/*" aria-label="Upload profile photo" onChange={handlePhotoChange} disabled={status.loading || photoUploading} /></div>
        <nav className="store-account-shortcuts" aria-label="Account shortcuts"><Link to="/orders"><StoreIcon name="box" /><span>Orders</span><StoreIcon name="chevron" /></Link><Link to="/favorites"><StoreIcon name="heart" /><span>Favorites</span><StoreIcon name="chevron" /></Link></nav>
      </div>

      {status.loading && !userId && <CardSkeleton lines={4} />}
      {status.error && <div className="store-notice" role="alert">{status.error}</div>}

      <form className="store-account-form" onSubmit={handleSubmit} aria-busy={status.loading}>
        <fieldset className="store-account-fields" disabled={status.loading || photoUploading}>
          <section className="store-account-section">
            <h2>Personal information</h2><p className="store-section-description">The details that make this account yours.</p>
            <div className="store-field"><label htmlFor="account-name">Full name</label><input className="input" id="account-name" autoComplete="name" required value={form.name} onChange={(event) => updateField('name', event.target.value)} /></div>
            <div className="store-field"><label htmlFor="account-email">Email</label><input className="input" id="account-email" type="email" autoComplete="email" readOnly={canManageSecurity} value={form.email} onChange={(event) => updateField('email', event.target.value)} /></div>
            <div className="store-field"><label htmlFor="account-phone">Mobile number</label><input className="input" id="account-phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(event) => updateField('phone', event.target.value)} /></div>
            <div className="store-account-preferences">
              <div className="store-preference-row"><StoreIcon name="palette" /><label htmlFor="account-theme">Theme</label><select className="input" id="account-theme" value={theme} onChange={(event) => handleThemeChange(event.target.value)}>{['Default', 'Daylight', 'Pink Splush', 'Blazing Maroon', 'Forest Brown', 'Beach Blue', 'Luxurious Gold', 'Shadow Dark Mode'].map((option) => <option key={option}>{option}</option>)}</select></div>
              <div className="store-preference-row"><StoreIcon name="type" /><label htmlFor="account-font">Font</label><select className="input" id="account-font" aria-describedby="account-font-description" value={font} onChange={(event) => setFont(saveFontPreference(userId, event.target.value))}>{FONT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
              <p className="store-font-description" id="account-font-description">{selectedFont.heading} headings · {selectedFont.body} text. Saved on this browser.</p>
              {canManageSecurity && <div className="store-preference-row"><StoreIcon name="shield" /><span>Security</span><button className="store-text-link" type="button" aria-expanded={securityOpen} aria-controls="account-password-form" onClick={() => setSecurityOpen((open) => !open)}>{securityOpen ? 'Close password settings' : 'Change password'}</button></div>}
            </div>
          </section>
          <section className="store-account-section">
            <h2>Delivery address</h2><p className="store-section-description">Help your next favorite find its way to you.</p>
            <div className="store-field"><label htmlFor="account-street">Street address <span>(optional)</span></label><input className="input" id="account-street" autoComplete="address-line1" value={form.addressLine} onChange={(event) => updateField('addressLine', event.target.value)} /></div>
            <div className="store-field-pair">
              <div className="store-field"><label htmlFor="account-barangay">Barangay</label><input className="input" id="account-barangay" autoComplete="address-level3" required value={form.barangay} onChange={(event) => updateField('barangay', event.target.value)} /></div>
              <div className="store-field"><label htmlFor="account-city">City / Municipality</label><input className="input" id="account-city" autoComplete="address-level2" required value={form.city} onChange={(event) => updateField('city', event.target.value)} /></div>
            </div>
            <div className="store-field-pair">
              <div className="store-field"><label htmlFor="account-province">Province / State</label><input className="input" id="account-province" autoComplete="address-level1" required value={form.province} onChange={(event) => updateField('province', event.target.value)} /></div>
              <div className="store-field"><label htmlFor="account-zip">ZIP code</label><input className="input" id="account-zip" autoComplete="postal-code" required value={form.zip} onChange={(event) => updateField('zip', event.target.value)} /></div>
            </div>
            <div className="store-field"><label htmlFor="account-country">Country</label><input className="input" id="account-country" autoComplete="country-name" required value={form.country} onChange={(event) => updateField('country', event.target.value)} /></div>
            <div className="store-field"><label htmlFor="account-backup">Backup address <span>(optional)</span></label><input className="input" id="account-backup" value={form.backupAddress} onChange={(event) => updateField('backupAddress', event.target.value)} /></div>
          </section>
        </fieldset>
        <div className="store-account-save"><span>Keep your details up to date for smooth deliveries.</span><button className="button" type="submit" disabled={status.loading || photoUploading}>{status.loading ? 'Saving...' : 'Save changes'}</button></div>
      </form>

      {canManageSecurity && securityOpen && (
        <form className="card form store-password-form" id="account-password-form" onSubmit={handlePasswordChange}>
          <div className="label">Change Password</div>
          <div>
            <label className="label" htmlFor="account-current-password">Current password</label>
            <div className="input-row">
              <input
                id="account-current-password"
                autoComplete="current-password"
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
            <label className="label" htmlFor="account-new-password">New password</label>
            <div className="input-row">
              <input
                id="account-new-password"
                autoComplete="new-password"
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
            <label className="label" htmlFor="account-confirm-password">Confirm new password</label>
            <div className="input-row">
              <input
                id="account-confirm-password"
                autoComplete="new-password"
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
        <Modal
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
        </Modal>
      )}
    </section>
  )
}

export default Account
