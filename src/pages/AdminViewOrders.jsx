import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { groupActiveOrdersByAddress } from '../utils/ordersByAddress.js'
import { getNextOrderStatus, getOrderItemStatus as getItemStatus, orderSteps } from '../../server/shared/orderWorkflow.js'

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('cancelled')) return 'cancelled'
  if (normalized.includes('pending')) return 'pending'
  if (
    normalized === 'approved' || normalized.includes('to ship') ||
    normalized.includes('to review') ||
    normalized.includes('to receive')
  ) {
    return 'active'
  }
  return ''
}

function AdminViewOrders() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [pending, setPending] = useState({})
  const lockedOrders = useRef(new Set())

  const runAction = async (orderId, action, execute) => {
    if (lockedOrders.current.has(orderId)) return
    lockedOrders.current.add(orderId)
    setPending((current) => ({ ...current, [orderId]: action }))
    setStatus((current) => ({ ...current, error: '' }))
    try {
      const updated = await execute()
      setOrders((current) => current.map((order) => order.id === orderId ? updated : order))
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }))
    } finally {
      lockedOrders.current.delete(orderId)
      setPending((current) => { const next = { ...current }; delete next[orderId]; return next })
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

  const byAddress = useMemo(() => groupActiveOrdersByAddress(orders), [orders])

  const orderRows = useMemo(
    () =>
      orders.flatMap((order) =>
        (order.items || []).map((item, itemIndex) => ({
          order,
          item,
          itemIndex,
          itemTotal: (Number(item.price) || 0) * (Number(item.quantity) || 0),
        }))
      ),
    [orders]
  )

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
      {status.error && <div className="card" role="alert">{status.error}</div>}
      <div className="card table-scroll">
        <h2 className="section-title" style={{ fontSize: '22px' }}>
          Orders by Address
        </h2>
        {byAddress.length === 0 && <p className="section-subtitle">No active orders.</p>}
        {byAddress.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Province</th>
                <th>Municipality</th>
                <th>Barangay</th>
                <th>Active Orders</th>
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
              <th>Item Bought</th>
              <th>Customer</th>
              <th>Name</th>
              <th>Contact Number</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orderRows.map(({ order, item, itemIndex, itemTotal }, rowIndex) => (
              <tr
                key={`${order.id}-${item.itemId}-${itemIndex}`}
                className={`admin-order-row admin-order-row--${getStatusTone(
                  getItemStatus(order, item)
                )}`}
                aria-busy={Boolean(pending[order.id])}
              >
                <td>{rowIndex + 1}</td>
                <td>
                  <strong>{item.name || item.productName || item.productId || 'Item'}</strong>
                  <div className="section-subtitle">Qty: {item.quantity || 0}</div>
                </td>
                <td>{order.email || order.userId || 'Customer'}</td>
                <td>{order.contactName || 'Customer'}</td>
                <td>{order.phone || '-'}</td>
                <td>₱{itemTotal.toLocaleString()}</td>
                <td>
                  <span className="badge">{getItemStatus(order, item)}</span>
                </td>
                <td>
                  {getStatusTone(getItemStatus(order, item)) === 'cancelled' ? (
                    <span className="admin-order-readonly">Cancelled by user</span>
                  ) : getItemStatus(order, item) === 'Removed' ? <span className="admin-order-readonly">Removed</span> : (
                    <div className="admin-order-actions">
                      {orderSteps.map((step, index) => {
                        const current = getItemStatus(order, item)
                        const completed = orderSteps.indexOf(current) >= index
                        const isNext = getNextOrderStatus(current) === step
                        return (
                        <button
                          key={step}
                          type="button"
                          className={`button ghost admin-order-step ${completed ? 'is-complete' : ''} ${isNext ? 'is-next' : ''}`}
                          disabled={order.workflowVersion !== 1 || Boolean(pending[order.id]) || !isNext}
                          title={completed ? `${step} completed` : isNext ? `Move item to ${step}` : 'Complete the previous step first'}
                          onClick={() => runAction(order.id, step, () => api.updateOrderItemStatus(order.id, item.itemId || `${itemIndex}-${item.productId}`, step))}
                        >
                          <span className="admin-order-step-number" aria-hidden="true">{completed ? '✓' : index + 1}</span>
                          {pending[order.id] === step ? 'Saving…' : step === 'Approved' && !completed ? 'Approve' : step}
                        </button>
                        )
                      })}
                      <button
                        className="button ghost"
                        type="button"
                        disabled={Boolean(pending[order.id])}
                        onClick={async () => {
                          if (!window.confirm('Remove this order? This cannot be undone.')) return
                          await runAction(order.id, 'Removed', () => api.deleteOrder(order.id))
                        }}
                      >
                        Remove
                      </button>
                      <span className="admin-order-action-hint">{order.workflowVersion !== 1 ? 'Approval controls are temporarily unavailable. Refresh and try again.' : getItemStatus(order, item) === 'Pending COD' ? 'Approval required before shipping' : getNextOrderStatus(getItemStatus(order, item)) ? 'Complete each step in order' : 'Order fulfilled'}</span>
                      {orderSteps.includes(getItemStatus(order, item)) && !item.stockDeductedAt && <span className="admin-order-action-hint">Older record: confirm its stock deduction in inventory.</span>}
                    </div>
                  )}
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
