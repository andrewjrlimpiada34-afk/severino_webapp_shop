import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const tabs = ['All Inboxes', 'Unread Inboxes', 'Opened Inboxes']

function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('All Inboxes')
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        setStatus({ loading: true, error: '' })
        const orders = await api.orders()
        const openedIds = JSON.parse(localStorage.getItem(`severino_notif_opened_${user.id}`) || '[]')
        const mapped = orders.map((order) => ({
          id: order.id,
          text: `Order ${order.id} is ${order.status}`,
          opened: openedIds.includes(order.id),
          createdAt: order.createdAt,
        }))
        setItems(mapped)
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [user])

  const visible = useMemo(() => {
    if (activeTab === 'Unread Inboxes') return items.filter((item) => !item.opened)
    if (activeTab === 'Opened Inboxes') return items.filter((item) => item.opened)
    return items
  }, [activeTab, items])

  const markOpened = (id) => {
    if (!user) return
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, opened: true } : item)))
    const openedIds = JSON.parse(localStorage.getItem(`severino_notif_opened_${user.id}`) || '[]')
    if (!openedIds.includes(id)) {
      localStorage.setItem(`severino_notif_opened_${user.id}`, JSON.stringify([...openedIds, id]))
    }
  }

  return (
    <section className="grid" style={{ gap: '24px', maxWidth: '980px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">View and manage your inbox updates.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      <div className="card">
        <div className="notif-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`button secondary ${activeTab === tab ? 'notif-tab-active' : ''}`}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {status.loading && <div className="card">Loading inboxes...</div>}
      {status.error && <div className="card">Error: {status.error}</div>}
      {!status.loading && !status.error && (
        <div className="card notif-list">
          {visible.length === 0 && <p className="section-subtitle">No inboxes in this category.</p>}
          {visible.map((item) => (
            <button
              key={item.id}
              className={`notif-row ${item.opened ? 'opened' : ''}`}
              type="button"
              onClick={() => markOpened(item.id)}
            >
              <span>{item.text}</span>
              {!item.opened && <span className="pill">Unread</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export default Notifications
