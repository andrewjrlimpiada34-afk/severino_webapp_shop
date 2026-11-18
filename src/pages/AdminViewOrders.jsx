import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { groupActiveOrdersByAddress } from '../utils/ordersByAddress.js'
import {
  getNextOrderStatus,
  getOrderItemStatus
} from '../../server/shared/orderWorkflow.js'
import StatusBadge from '../components/StatusBadge.jsx'
import PaymentDialog from '../components/PaymentDialog.jsx'
import Modal from '../components/Modal.jsx'

const money = (value) =>
  Number(value || 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP'
  })
const actionLabels = {
  Approved: 'Approve order',
  'To Ship': 'Ready to ship',
  'To Receive': 'Dispatch order',
  'To Review': 'Mark delivered'
}

export default function AdminViewOrders() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [pending, setPending] = useState({})
  const [payment, setPayment] = useState(null)
  const [history, setHistory] = useState(null)
  const [stockAction, setStockAction] = useState(null)
  const locks = useRef(new Set())
  useEffect(() => {
    let active = true
    api
      .orders()
      .then((data) => {
        if (active) {
          setOrders(data)
          setStatus({ loading: false, error: '' })
        }
      })
      .catch((error) => {
        if (active) setStatus({ loading: false, error: error.message })
      })
    return () => {
      active = false
    }
  }, [])
  const run = async (orderId, execute, propagate = false) => {
    if (locks.current.has(orderId)) return
    locks.current.add(orderId)
    setPending((previous) => ({ ...previous, [orderId]: true }))
    try {
      const updated = await execute()
      setOrders((previous) =>
        previous
          .map((order) => (order.id === orderId ? updated : order))
          .filter((order) => !order.archivedAt)
      )
      setStatus((previous) => ({ ...previous, error: '' }))
      return updated
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: error.message }))
      if (propagate) throw error
    } finally {
      locks.current.delete(orderId)
      setPending((previous) => ({ ...previous, [orderId]: false }))
    }
  }
  const byAddress = useMemo(() => groupActiveOrdersByAddress(orders), [orders])
  const viewHistory = async (order) => {
    try {
      setHistory({ order, entries: await api.paymentHistory(order.id) })
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: error.message }))
    }
  }
  const applyStockAction = async (event) => {
    event.preventDefault()
    if (!stockAction.confirmed) return
    const { order, item, mode } = stockAction
    try {
      await run(
        order.id,
        () =>
          mode === 'reconcile'
            ? api.reconcileOrderItem(
                order.id,
                item.itemId,
                stockAction.alreadyDeducted
              )
            : api.returnOrderItem(order.id, item.itemId, {
                quantity: stockAction.quantity,
                requestKey: stockAction.requestKey,
                received: true
              }),
        true
      )
      setStockAction(null)
    } catch {
      /* The action remains open with the server's message. */
    }
  }
  return (
    <section className="grid admin-orders" style={{ gap: 24 }}>
      <div>
        <h1 className="section-title">View Orders</h1>
        <p className="section-subtitle">
          Manage delivery, verify collections, and review payment history.
        </p>
      </div>
      {status.loading && <p role="status">Loading orders…</p>}
      {status.error && (
        <p className="card" role="alert">
          {status.error}
        </p>
      )}
      <details className="card">
        <summary>Orders by Address</summary>
        <div className="table-scroll">
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
              {byAddress.map((address) => (
                <tr
                  key={[
                    address.country,
                    address.province,
                    address.city,
                    address.barangay
                  ].join('-')}
                >
                  <td>{address.country}</td>
                  <td>{address.province}</td>
                  <td>{address.city}</td>
                  <td>{address.barangay}</td>
                  <td>{address.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {!status.loading && !orders.length && (
        <p className="card">No orders to display.</p>
      )}
      {orders.map((order) => {
        const next = getNextOrderStatus(order.status)
        const canCancel =
          order.items.some(
            (item) =>
              !['Cancelled', 'Removed'].includes(
                getOrderItemStatus(order, item)
              )
          ) &&
          order.items.every((item) =>
            [
              'Pending COD',
              'Approved',
              'To Ship',
              'Cancelled',
              'Removed'
            ].includes(getOrderItemStatus(order, item))
          )
        return (
          <article
            className="card order-card"
            key={order.id}
            aria-busy={Boolean(pending[order.id])}
          >
            <header className="order-card-header">
              <div>
                <h2>{order.reference || 'Customer order'}</h2>
                <p>
                  {order.contactName} · {order.email}
                  <br />
                  {order.phone}
                </p>
              </div>
              <strong>{money(order.total)}</strong>
            </header>
            <p className="order-product-names">
              {order.items
                .map((item) => item.name || 'Unavailable product')
                .join(' · ')}
            </p>
            <div className="order-statuses">
              <span>
                Delivery <StatusBadge status={order.status} />
              </span>
              <span>
                Payment <StatusBadge status={order.paymentStatus || 'Unpaid'} />
              </span>
            </div>
            <p>
              Collected {money(order.grossCollected)} · Refunded{' '}
              {money(order.refundedTotal)}
            </p>
            <div className="order-admin-actions">
              {next && (
                <button
                  className="button"
                  type="button"
                  disabled={pending[order.id]}
                  onClick={() =>
                    run(order.id, () => api.updateOrderStatus(order.id, next))
                  }
                >
                  {actionLabels[next]}
                </button>
              )}
              {!(order.grossCollected > 0) &&
                !['Cancelled', 'Removed'].includes(order.status) && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={pending[order.id]}
                    onClick={() => setPayment({ order, refund: false })}
                  >
                    Verify payment
                  </button>
                )}
              {order.grossCollected > order.refundedTotal && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={pending[order.id]}
                  onClick={() => setPayment({ order, refund: true })}
                >
                  Record refund
                </button>
              )}
              <button
                className="button secondary"
                type="button"
                disabled={pending[order.id]}
                onClick={() => viewHistory(order)}
              >
                Payment history
              </button>
              {canCancel && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={pending[order.id]}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Cancel this order and release its stock commitment?'
                      )
                    )
                      run(order.id, () => api.adminCancelOrder(order.id))
                  }}
                >
                  Cancel order
                </button>
              )}
              {['Cancelled', 'To Review'].includes(order.status) &&
                !(
                  order.status === 'Cancelled' &&
                  order.grossCollected > order.refundedTotal
                ) && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={pending[order.id]}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Archive this order from the administrator list?'
                        )
                      )
                        run(order.id, () => api.deleteOrder(order.id))
                    }}
                  >
                    Archive order
                  </button>
                )}
            </div>
            {order.status === 'Cancelled' &&
              order.grossCollected > order.refundedTotal && (
                <p role="status">
                  Refund awaiting confirmation{' '}
                  {money(order.grossCollected - order.refundedTotal)}
                </p>
              )}
            <details className="order-details">
              <summary>Products and delivery details</summary>
              <p>{order.address}</p>
              {order.addressSnapshot?.notes && (
                <p>{order.addressSnapshot.notes}</p>
              )}
              {order.items.map((item, index) => {
                const itemId = item.itemId || `${index}-${item.productId}`
                const current = getOrderItemStatus(order, item)
                const itemNext = getNextOrderStatus(current)
                return (
                  <section className="order-item" key={itemId}>
                    <div>
                      <h3>{item.name || 'Unavailable product'}</h3>
                      <p>
                        Quantity {item.quantity} ·{' '}
                        {money(item.price * item.quantity)}
                      </p>
                      <StatusBadge status={current} />
                      {item.returnedQuantity > 0 && (
                        <p>{item.returnedQuantity} returned</p>
                      )}
                    </div>
                    <div className="order-item-actions">
                      {itemNext && (
                        <button
                          className="button secondary"
                          type="button"
                          disabled={pending[order.id]}
                          onClick={() =>
                            run(order.id, () =>
                              api.updateOrderItemStatus(
                                order.id,
                                itemId,
                                itemNext
                              )
                            )
                          }
                        >
                          Advance item to {itemNext}
                        </button>
                      )}
                      {item.inventoryReviewRequired && (
                        <button
                          className="button secondary"
                          type="button"
                          disabled={pending[order.id]}
                          onClick={() =>
                            setStockAction({
                              mode: 'reconcile',
                              order,
                              item: { ...item, itemId },
                              alreadyDeducted: true,
                              confirmed: false
                            })
                          }
                        >
                          Reconcile legacy stock
                        </button>
                      )}
                      {['To Receive', 'To Review'].includes(current) &&
                        Number(item.returnedQuantity || 0) < item.quantity && (
                          <button
                            className="button secondary"
                            type="button"
                            disabled={pending[order.id]}
                            onClick={() =>
                              setStockAction({
                                mode: 'return',
                                order,
                                item: { ...item, itemId },
                                quantity: 1,
                                requestKey: crypto.randomUUID(),
                                confirmed: false
                              })
                            }
                          >
                            Receive returned goods
                          </button>
                        )}
                    </div>
                  </section>
                )
              })}
            </details>
          </article>
        )
      })}
      {payment && (
        <PaymentDialog
          {...payment}
          onClose={() => setPayment(null)}
          onSave={(data) =>
            run(
              payment.order.id,
              () => api.recordPayment(payment.order.id, data),
              true
            )
          }
        />
      )}
      {history && (
        <Modal onClick={() => setHistory(null)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="payment-history-title">Payment history</h2>
            <p>{history.order.reference}</p>
            {history.entries.length ? (
              <ol className="payment-history">
                {history.entries.map((entry) => (
                  <li key={entry.id}>
                    <strong>
                      {entry.kind === 'refund' ? 'Refund' : 'Collection'}{' '}
                      {money(entry.amount)}
                    </strong>
                    <StatusBadge status={entry.status} />
                    <p>
                      {entry.method} · {entry.reference}
                      <br />
                      {entry.verifiedBy}
                      {entry.verifiedAt &&
                        ` · ${new Date(entry.verifiedAt).toLocaleString('en-PH')}`}
                    </p>
                    {entry.reason && <p>{entry.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No payment actions recorded.</p>
            )}
            <button
              className="button secondary"
              type="button"
              onClick={() => setHistory(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
      {stockAction && (
        <Modal
          onClick={() => {
            if (!pending[stockAction.order.id]) setStockAction(null)
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-action-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="stock-action-title">
              {stockAction.mode === 'return'
                ? 'Receive returned goods'
                : 'Reconcile legacy stock'}
            </h2>
            <p>{stockAction.item.name}</p>
            <form className="form" onSubmit={applyStockAction}>
              <fieldset disabled={pending[stockAction.order.id]}>
                {stockAction.mode === 'return' ? (
                  <>
                    <label className="label" htmlFor="returned-quantity">
                      Received quantity
                    </label>
                    <input
                      id="returned-quantity"
                      className="input"
                      type="number"
                      min="1"
                      max={
                        stockAction.item.quantity -
                        Number(stockAction.item.returnedQuantity || 0)
                      }
                      required
                      value={stockAction.quantity}
                      onChange={(event) =>
                        setStockAction((previous) => ({
                          ...previous,
                          quantity: Number(event.target.value)
                        }))
                      }
                    />
                  </>
                ) : (
                  <>
                    <label className="label" htmlFor="reconcile-choice">
                      Verified stock history
                    </label>
                    <select
                      className="input"
                      id="reconcile-choice"
                      value={String(stockAction.alreadyDeducted)}
                      onChange={(event) =>
                        setStockAction((previous) => ({
                          ...previous,
                          alreadyDeducted: event.target.value === 'true'
                        }))
                      }
                    >
                      <option value="true">Stock was already deducted</option>
                      <option value="false">
                        Stock was never deducted, reserve it now
                      </option>
                    </select>
                  </>
                )}
                <label className="terms-check">
                  <input
                    type="checkbox"
                    required
                    checked={stockAction.confirmed}
                    onChange={(event) =>
                      setStockAction((previous) => ({
                        ...previous,
                        confirmed: event.target.checked
                      }))
                    }
                  />
                  {stockAction.mode === 'return'
                    ? 'I inspected and accepted these returned goods.'
                    : 'I checked the order against actual inventory records.'}
                </label>
              </fieldset>
              {status.error && <p role="alert">{status.error}</p>}
              <div className="address-actions">
                <button
                  className="button"
                  disabled={pending[stockAction.order.id]}
                >
                  Confirm inventory action
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={pending[stockAction.order.id]}
                  onClick={() => setStockAction(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </section>
  )
}
