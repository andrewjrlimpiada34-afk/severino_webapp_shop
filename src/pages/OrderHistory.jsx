import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'

function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const navigate = useNavigate()

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

  const trackingLabel = (status) => {
    if (status === 'To Review') return 'To review'
    if (status === 'To Receive') return 'To receive'
    if (
      status === 'To Ship' ||
      status === 'Pending' ||
      status === 'Pending COD' ||
      status === 'Verified'
    )
      return 'To ship'
    if (status === 'Removed') return 'Removed'
    if (status === 'Cancelled') return 'Cancelled'
    return 'Processing'
  }

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Order History</h1>
        <p className="section-subtitle">
          View COD orders and delivery status with secure confirmations.
        </p>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading orders...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="card table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Item ID</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Tracking</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.flatMap((order) =>
              (order.items || []).map((item, index) => (
                <tr key={`${order.id}-${item.productId}-${index}`}>
                  <td>{order.id}</td>
                  <td>{item.productId}</td>
                  <td>{item.quantity}</td>
                  <td>₱{item.price.toLocaleString()}</td>
                  <td>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
                  <td>₱{(item.price * item.quantity).toLocaleString()}</td>
                  <td>
                    <span className="badge">{order.status}</span>
                  </td>
                  <td>
                    <span className="badge">{trackingLabel(order.status)}</span>
                  </td>
                  <td>
                    {order.status === 'Pending COD' && (
                      <button
                        className="button ghost"
                        onClick={async () => {
                          try {
                            const updated = await api.cancelOrder(order.id)
                            setOrders((prev) =>
                              prev.map((entry) => (entry.id === order.id ? updated : entry))
                            )
                          } catch (error) {
                            setStatus((prev) => ({ ...prev, error: error.message }))
                          }
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    {order.status === 'To Review' && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          className="button ghost"
                          onClick={async () => {
                            try {
                              const product = await api.product(item.productId)
                              if (product.stock <= 0) {
                                setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
                                return
                              }
                              const cart = await api.cart()
                              const existing = cart.items.find(
                                (entry) => entry.productId === item.productId
                              )
                              const nextItems = existing
                                ? cart.items.map((entry) =>
                                    entry.productId === item.productId
                                      ? {
                                        ...entry,
                                        quantity: Math.min(
                                          100,
                                          Math.min(product.stock, entry.quantity + 1)
                                        ),
                                      }
                                      : entry
                                  )
                                : [...cart.items, { productId: item.productId, quantity: 1 }]
                              await api.updateCart(nextItems)
                              if (order.userId) {
                                localStorage.setItem(
                                  `checkout_selection_${order.userId}`,
                                  JSON.stringify([item.productId])
                                )
                              }
                              navigate('/checkout')
                            } catch (error) {
                              setStatus((prev) => ({ ...prev, error: error.message }))
                            }
                          }}
                        >
                          Buy Again
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => navigate(`/product/${item.productId}`)}
                        >
                          Rate this Product
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default OrderHistory
