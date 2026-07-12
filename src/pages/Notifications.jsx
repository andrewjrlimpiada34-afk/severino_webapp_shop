import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { CardSkeleton } from '../components/Skeleton.jsx'

const tabs = [
  { id: 'all', label: 'All inboxes' },
  { id: 'unread', label: 'Unread inboxes' },
  { id: 'opened', label: 'Opened inboxes' },
]

function NotificationFilterIcon({ type }) {
  if (type === 'unread') {
    return (
      <svg className="notif-filter-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="m4.5 8 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19" cy="5" r="2.4" fill="currentColor" stroke="var(--glass)" strokeWidth="1.2" />
      </svg>
    )
  }
  if (type === 'opened') {
    return (
      <svg className="notif-filter-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5 12 4l9 6.5V19H3Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m4 11 8 5 8-5M8 8h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className="notif-filter-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14l2 9v6H3v-6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3.5 13h5l1.5 2h4l1.5-2h5M8 8h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        setStatus({ loading: true, error: '' })
        const orders = await api.orders()
        const openedIds = JSON.parse(localStorage.getItem(`severino_notif_opened_${user.id}`) || '[]')
        const deletedIds = JSON.parse(localStorage.getItem(`severino_notif_deleted_${user.id}`) || '[]')
        const mapped = orders.map((order) => ({
          id: order.id,
          text: `Order ${order.id} is ${order.status}`,
          opened: openedIds.includes(order.id),
          createdAt: order.createdAt,
        }))
        setItems(mapped.filter((item) => !deletedIds.includes(item.id)))
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [user])

  const visible = useMemo(() => {
    if (activeTab === 'unread') return items.filter((item) => !item.opened)
    if (activeTab === 'opened') return items.filter((item) => item.opened)
    return items
  }, [activeTab, items])

  const inboxCounts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((item) => !item.opened).length,
      opened: items.filter((item) => item.opened).length,
    }),
    [items]
  )

  const markOpened = (id) => {
    if (!user) return
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, opened: true } : item)))
    const openedIds = JSON.parse(localStorage.getItem(`severino_notif_opened_${user.id}`) || '[]')
    if (!openedIds.includes(id)) {
      localStorage.setItem(`severino_notif_opened_${user.id}`, JSON.stringify([...openedIds, id]))
    }
  }

  const deleteInbox = (id) => {
    if (!user) return
    setItems((prev) => prev.filter((item) => item.id !== id))
    const deletedIds = JSON.parse(localStorage.getItem(`severino_notif_deleted_${user.id}`) || '[]')
    if (!deletedIds.includes(id)) {
      localStorage.setItem(`severino_notif_deleted_${user.id}`, JSON.stringify([...deletedIds, id]))
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

      <div className="card notif-filter-card">
        <div className="notif-tabs" role="tablist" aria-label="Filter notifications">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`notif-filter-button ${activeTab === tab.id ? 'notif-tab-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-label={`${tab.label}: ${inboxCounts[tab.id]}`}
              title={tab.label}
              onClick={() => setActiveTab(tab.id)}
            >
              <NotificationFilterIcon type={tab.id} />
              <span className="notif-filter-count" aria-hidden="true">{inboxCounts[tab.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {status.loading && <CardSkeleton lines={4} />}
      {status.error && <div className="card">Error: {status.error}</div>}
      {!status.loading && !status.error && (
        <div className="card notif-list">
          {visible.length === 0 && <p className="section-subtitle">No inboxes in this category.</p>}
          {visible.map((item) => (
            <div key={item.id} className={`notif-row ${item.opened ? 'opened' : ''}`}>
              <button
                className="notif-row__content"
                type="button"
                onClick={() => markOpened(item.id)}
              >
                <span>{item.text}</span>
                {!item.opened && <span className="pill">Unread</span>}
              </button>
              {item.opened && (
                <button
                  className="button secondary notif-delete"
                  type="button"
                  onClick={() => deleteInbox(item.id)}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default Notifications
