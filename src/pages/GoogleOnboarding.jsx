import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, API_URL } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { TERMS_VERSION } from '../../server/shared/policyVersions.js'
import TermsAcceptance from '../components/TermsAcceptance.jsx'

export default function GoogleOnboarding() {
  const [profile, setProfile] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ loading: true, error: '' })
  const { refresh } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    let active = true
    api
      .googleOnboarding()
      .then((data) => {
        if (active) {
          setProfile(data)
          setStatus({ loading: false, error: '' })
        }
      })
      .catch((error) => {
        if (active) setStatus({ loading: false, error: error.message })
      })
    return () => {
      active = false
    }
  }, [])
  const complete = async (event) => {
    event.preventDefault()
    if (!accepted || status.loading) return
    setStatus({ loading: true, error: '' })
    try {
      if (profile.needsLinkLogin)
        await api.login({ identifier: profile.email, password })
      await api.completeGoogle({
        termsAccepted: accepted,
        termsVersion: TERMS_VERSION
      })
      await refresh()
      navigate('/', { replace: true })
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    }
  }
  return (
    <section className="google-onboarding card form">
      <h1 className="section-title">Continue with Google</h1>
      {profile && (
        <>
          <p>
            {profile.name}
            <br />
            {profile.email}
          </p>
          <form className="form" onSubmit={complete}>
            {profile.needsLinkLogin && (
              <div>
                <p>
                  An account already uses this email. Confirm its existing
                  Severino password to link Google.
                </p>
                <label className="label" htmlFor="link-password">
                  Existing Severino password
                </label>
                <input
                  id="link-password"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={status.loading}
                />
              </div>
            )}
            <TermsAcceptance
              checked={accepted}
              onChange={setAccepted}
              disabled={status.loading}
            />
            <button className="button" disabled={!accepted || status.loading}>
              {status.loading
                ? 'Completing account…'
                : profile.needsLinkLogin
                  ? 'Link Google and continue'
                  : 'Complete account'}
            </button>
          </form>
        </>
      )}
      {status.error && <p role="alert">{status.error}</p>}
      {!profile && !status.loading && (
        <a className="button" href={`${API_URL}/api/auth/google`}>
          Restart Google sign-in
        </a>
      )}
      <Link to="/login">Back to sign in</Link>
    </section>
  )
}
