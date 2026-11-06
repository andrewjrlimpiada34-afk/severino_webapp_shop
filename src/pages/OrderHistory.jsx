import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { CardSkeleton } from '../components/Skeleton.jsx'
import { useActionAnimation } from '../context/useActionAnimation.js'
import { getOrderItemStatus } from '../../server/shared/orderWorkflow.js'
import Modal from '../components/Modal.jsx'

const emptyCancellation = { open: false, orderId: '', itemKey: '', item: null }

function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()
  const { playActionAnimation } = useActionAnimation()

  const [cancelConfirm, setCancelConfirm] = useState(emptyCancellation)
  const [cancelStatus, setCancelStatus] = useState({ loading: false, error: '' })
  const cancelPending = useRef(false)
  const closeCancellation = useCallback(() => {
    if (!cancelPending.current) setCancelConfirm(emptyCancellation)
  }, [])

  useEffect(() => {
    if (!cancelConfirm.open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeCancellation() }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [cancelConfirm.open, closeCancellation])

  const confirmCancellation = async () => {
    if (cancelPending.current) return
    cancelPending.current = true
    setCancelStatus({ loading: true, error: '' })
    try {
      const updated = await api.cancelOrderItem(cancelConfirm.orderId, cancelConfirm.itemKey)
      setOrders((prev) => prev.map((entry) => entry.id === cancelConfirm.orderId ? updated : entry))
      setSuccessMessage('Order item cancelled.')
      setStatus((prev) => ({ ...prev, error: '' }))
      setCancelConfirm(emptyCancellation)
    } catch (error) {
      setCancelStatus({ loading: false, error: error.message || 'We couldn’t cancel this item. Please try again.' })
    } finally {
      cancelPending.current = false
      setCancelStatus((prev) => ({ ...prev, loading: false }))
    }
  }
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
      status === 'Approved' ||
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
        <h1 className="section-title">Order Tracking</h1>
        <p className="section-subtitle">
          View COD orders and delivery status with secure confirmations.
        </p>
      </div>

      {status.loading && <CardSkeleton lines={5} />}
      {status.error && <div className="card">Error: {status.error}</div>}
      {successMessage && <div className="card" role="status">{successMessage}</div>}


      {cancelConfirm.open && (
        <Modal className="order-cancel-backdrop" onClick={closeCancellation}>
          <div className="modal-card order-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="order-cancel-title" aria-describedby="order-cancel-description" aria-busy={cancelStatus.loading} onClick={(event) => event.stopPropagation()}>
            <h2 id="order-cancel-title">Cancel this item?</h2>
            <p id="order-cancel-description">This will cancel the selected item. Other items in your order will stay unchanged.</p>
            <div className="order-cancel-summary">
              <strong>{cancelConfirm.item?.name || 'Selected item'}</strong>
              <span>Quantity: {cancelConfirm.item?.quantity}{' \u00b7 \u20b1'}{((cancelConfirm.item?.price || 0) * (cancelConfirm.item?.quantity || 0)).toLocaleString('en-PH')}</span>
              <span>Order #{cancelConfirm.orderId.slice(-8)}</span>
            </div>
            {cancelStatus.error && <p className="order-cancel-error" role="alert">{cancelStatus.error}</p>}
            <div className="order-cancel-actions">
              <button className="button secondary" type="button" disabled={cancelStatus.loading} onClick={closeCancellation}>Keep item</button>
              <button className="button order-cancel-confirm" type="button" disabled={cancelStatus.loading} onClick={confirmCancellation}>{cancelStatus.loading ? 'Cancelling\u2026' : 'Cancel item'}</button>
            </div>
          </div>
        </Modal>
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
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state orders-empty-state">
                    You have no orders yet.
                  </div>
                </td>
              </tr>
            ) : orders.flatMap((order) =>
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
                    {getOrderItemStatus(order, item) === 'Pending COD' && (
                      <button
                        className="button ghost"
                        onClick={() => {
                          const itemKey = item.itemId || `${index}-${item.productId}`
                          setCancelStatus({ loading: false, error: '' })
                          setCancelConfirm({
                            open: true,
                            orderId: order.id,
                            itemKey,
                            item,
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
                              await playActionAnimation('cart', { duration: 650 })
                              if (order.userId) {
                                localStorage.removeItem(
                                  `severino_direct_checkout_${order.userId}`
                                )
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
