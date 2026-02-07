import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function AdminFeedback() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const data = await api.feedback()
        setItems(data)
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])
  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Admin Feedback</h1>
        <p className="section-subtitle">All feedback is tagged and secured.</p>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading feedback...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="grid two">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div className="tag">Order {item.orderId}</div>
            <p className="section-subtitle">{item.userName || 'Customer'} · {item.userEmail || ''}</p>
            <p>{item.message}</p>
            <div className="pill">Rating: {item.rating}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default AdminFeedback
