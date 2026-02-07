import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

function parseAddress(address) {
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return {
    country: parts.at(-1) || '',
    province: parts.at(-3) || '',
    city: parts.at(-4) || '',
    barangay: parts.at(-5) || '',
  }
}

function AdminViewOrders() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const data = await api.orders()
        setOrders(data)
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])

  const byAddress = useMemo(() => {
    const counts = {}
    orders.forEach((order) => {
      const address = parseAddress(order.address)
      const key = `${address.country}|${address.province}|${address.city}|${address.barangay}`
      counts[key] = counts[key] || { ...address, count: 0 }
      counts[key].count += 1
    })
    return Object.values(counts).sort((a, b) => {
      return (
        a.country.localeCompare(b.country) ||
        a.province.localeCompare(b.province) ||
        a.city.localeCompare(b.city) ||
        a.barangay.localeCompare(b.barangay)
      )
    })
  }, [orders])

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">View Orders</h1>
        <p className="section-subtitle">COD orders with secure verification.</p>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading orders...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="card table-scroll">
        <h2 className="section-title" style={{ fontSize: '22px' }}>
          Orders by Address
        </h2>
        {byAddress.length === 0 && <p className="section-subtitle">No orders yet.</p>}
        {byAddress.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Province</th>
                <th>Municipality</th>
                <th>Barangay</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {byAddress.map((item) => (
                <tr key={`${item.country}-${item.province}-${item.city}-${item.barangay}`}>
                  <td>{item.country || '-'}</td>
                  <td>{item.province || '-'}</td>
                  <td>{item.city || '-'}</td>
                  <td>{item.barangay || '-'}</td>
                  <td>
                    <span className="badge">{item.count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Name</th>
              <th>Contact Number</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr key={order.id}>
                <td>{index + 1}</td>
                <td>{order.id}</td>
                <td>{order.email || order.userId || 'Customer'}</td>
                <td>{order.contactName || 'Customer'}</td>
                <td>{order.phone || '-'}</td>
                <td>₱{order.total.toLocaleString()}</td>
                <td>
                  <span className="badge">{order.status}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['Verify', 'To Ship', 'To Receive', 'To Review'].map((label) => (
                      <button
                        key={label}
                        className="button ghost"
                        onClick={async () => {
                          try {
                            const nextStatus = label === 'Verify' ? 'To Ship' : label
                            if (label === 'Verify') {
                              await api.verifyOrder(order.id)
                            } else {
                              await api.updateOrderStatus(order.id, nextStatus)
                            }
                            setOrders((prev) =>
                              prev.map((item) =>
                                item.id === order.id ? { ...item, status: nextStatus } : item
                              )
                            )
                          } catch (error) {
                            setStatus((prev) => ({ ...prev, error: error.message }))
                          }
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      className="button ghost"
                      type="button"
                      onClick={async () => {
                        try {
                          const ok = window.confirm('Remove this order? This cannot be undone.')
                          if (!ok) return
                          const updated = await api.deleteOrder(order.id)
                          setOrders((prev) =>
                            prev.map((item) => (item.id === order.id ? updated : item))
                          )
                        } catch (error) {
                          setStatus((prev) => ({ ...prev, error: error.message }))
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminViewOrders
