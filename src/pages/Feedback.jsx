import { useState } from 'react'
import { api } from '../lib/api.js'

function Feedback() {
  const [form, setForm] = useState({ orderId: '', rating: 5, message: '' })
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setStatus({ loading: true, error: '', success: '' })
      await api.submitFeedback({
        orderId: form.orderId,
        rating: Number(form.rating),
        message: form.message,
      })
      setStatus({ loading: false, error: '', success: 'Feedback submitted. Thank you!' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }
  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Feedback Area</h1>
        <p className="section-subtitle">
          Share your experience so we can refine every detail.
        </p>
      </div>

      <div className="grid two">
        <form className="card form" onSubmit={handleSubmit}>
          <div>
            <div className="label">Order ID</div>
            <input
              className="input"
              placeholder="ORD-2026-0012"
              value={form.orderId}
              onChange={(event) => updateField('orderId', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Rating</div>
            <select
              className="input"
              value={form.rating}
              onChange={(event) => updateField('rating', event.target.value)}
            >
              <option>5 - Exceptional</option>
              <option>4 - Great</option>
              <option>3 - Good</option>
              <option>2 - Needs Improvement</option>
              <option>1 - Unhappy</option>
            </select>
          </div>
          <div>
            <div className="label">Feedback</div>
            <textarea
              className="input"
              rows="4"
              placeholder="Tell us what stood out"
              value={form.message}
              onChange={(event) => updateField('message', event.target.value)}
            />
          </div>
          {status.error && <div className="card">Error: {status.error}</div>}
          {status.success && <div className="card">{status.success}</div>}
          <button className="button" type="submit" disabled={status.loading}>
            {status.loading ? 'Sending...' : 'Submit Feedback'}
          </button>
        </form>

        <div className="card">
          <div className="tag">What happens next</div>
          <h2 className="section-title" style={{ fontSize: '26px' }}>
            We value our customers' response
          </h2>
          <p className="section-subtitle">
            Your message is reviewed by our care team. Sensitive data is masked
            and stored securely.
          </p>
          <div className="pill">Secure feedback storage</div>
        </div>
      </div>
    </section>
  )
}

export default Feedback
