import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [resending, setResending] = useState(false)

  const challengeId = searchParams.get('challengeId') || ''
  const email = searchParams.get('email') || ''
  const maskedEmail = useMemo(() => {
    if (!email.includes('@')) return email
    const [name, domain] = email.split('@')
    if (name.length <= 2) return `${name[0] || ''}***@${domain}`
    return `${name.slice(0, 2)}***@${domain}`
  }, [email])

  const handleVerify = async (event) => {
    event.preventDefault()
    if (!challengeId) {
      setStatus({ loading: false, error: 'Missing verification challenge. Register again.', success: '' })
      return
    }
    if (!code.trim()) {
      setStatus({ loading: false, error: 'Please enter the OTP code.', success: '' })
      return
    }

    try {
      setStatus({ loading: true, error: '', success: '' })
      await api.verify2fa({ challengeId, code: code.trim() })
      setStatus({ loading: false, error: '', success: 'Email verified. Redirecting to login...' })
      setTimeout(() => navigate('/login', { replace: true }), 700)
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  const handleResend = async () => {
    if (!challengeId) {
      setStatus({ loading: false, error: 'Missing verification challenge. Register again.', success: '' })
      return
    }
    try {
      setResending(true)
      const data = await api.resendVerifyOtp({ challengeId })
      const params = new URLSearchParams({
        challengeId: data.challengeId,
        email: data.email || email,
      }).toString()
      navigate(`/verify-email?${params}`, { replace: true })
      setStatus({ loading: false, error: '', success: 'A new OTP was sent to your email.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    } finally {
      setResending(false)
    }
  }

  return (
    <section className="grid" style={{ gap: '24px', maxWidth: '620px', margin: '0 auto' }}>
      <div>
        <h1 className="section-title">Verify Email</h1>
        <p className="section-subtitle">
          Enter the OTP sent to {maskedEmail || 'your email'}.
        </p>
      </div>
      <form className="card form" onSubmit={handleVerify}>
        <div>
          <div className="label">One-Time Password</div>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
        </div>
        {status.error && <div className="card">Error: {status.error}</div>}
        {status.success && <div className="card">{status.success}</div>}
        <button className="button" type="submit" disabled={status.loading}>
          {status.loading ? 'Verifying...' : 'Verify OTP'}
        </button>
        <button className="button secondary" type="button" onClick={() => navigate('/create-account', { replace: true })}>
          Back to Create Account
        </button>
        <button className="button secondary" type="button" onClick={handleResend} disabled={resending || status.loading}>
          {resending ? 'Sending...' : 'Resend OTP'}
        </button>
      </form>
    </section>
  )
}

export default VerifyEmail
