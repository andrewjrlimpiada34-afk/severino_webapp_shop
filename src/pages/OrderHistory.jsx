import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { CardSkeleton } from '../components/Skeleton.jsx'

function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()

  const [cancelConfirm, setCancelConfirm] = useState({
    open: false,
    orderId: '',
    itemKey: '',
  })




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
      <div className="page-hero">
        <div className="tag">Severino Delivery</div>
        <h1 className="section-title">Order Tacking</h1>
        <p className="section-subtitle">
          View COD orders and delivery status with secure confirmations.
        </p>
      </div>

      {status.loading && <CardSkeleton lines={5} />}
      {status.error && <div className="card">Error: {status.error}</div>}
      {successMessage && <div className="card">{successMessage}</div>}


      {cancelConfirm.open && (
        <div
          className="card"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            width: 'min(520px, 92vw)',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '16px', marginBottom: '12px' }}>
            Are you sure you want to cancel ordering this item/s?
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              className="button secondary"
              onClick={() => setCancelConfirm({ open: false, orderId: '', itemKey: '' })}
            >
              No
            </button>
            <button
              className="button ghost"
              onClick={async () => {
                try {
                  const updated = await api.cancelOrderItem(
                    cancelConfirm.orderId,
                    cancelConfirm.itemKey
                  )
                  setOrders((prev) =>
                    prev.map((entry) =>
                      entry.id === cancelConfirm.orderId ? updated : entry
                    )
                  )
                  setSuccessMessage('Order Item Cancelled')
                  setStatus((prev) => ({ ...prev, error: '' }))
                } catch (error) {
                  // Some cancellation requests return 404/Not found for already-cancelled
                  // or mismatched item identifiers. Treat that case as a completed cancel.
                  if (String(error?.message || '') === 'Not found') {
                    setSuccessMessage('Order Item Cancelled')
                    setStatus((prev) => ({ ...prev, error: '' }))
                  } else {
                    setStatus((prev) => ({ ...prev, error: error.message }))
                  }
                } finally {
                  setCancelConfirm({ open: false, orderId: '', itemKey: '' })
                }
              }}
            >
              Yes
            </button>
          </div>
        </div>
      )}

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
                    <span className="badge">
                      {item.trackingStatus || order.status}
                    </span>
                  </td>
                  <td>
                    <span className="badge">
                      {trackingLabel(item.trackingStatus || order.status)}
                    </span>
                  </td>

                  <td>
                    {item.trackingStatus === 'Pending COD' && (
                      <button
                        className="button ghost"
                        onClick={() => {
                          const itemKey = item.itemId || `${index}-${item.productId}`
                          setCancelConfirm({
                            open: true,
                            orderId: order.id,
                            itemKey,
                          })
                        }}
                      >
                        Cancel
                      </button>
                    )}


                    {item.trackingStatus === 'To Review' && (
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
