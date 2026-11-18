import { useRef, useState } from 'react'
import Modal from './Modal.jsx'

export default function PaymentDialog({
  order,
  refund = false,
  onSave,
  onClose
}) {
  const [form, setForm] = useState(() => ({
    kind: refund ? 'refund' : 'collection',
    status: 'Paid',
    amount: refund ? order.grossCollected - order.refundedTotal : order.total,
    method: order.paymentMethod || 'COD',
    reference: '',
    reason: '',
    requestKey: crypto.randomUUID(),
    collectionVerified: false
  }))
  const [reviewing, setReviewing] = useState(false)
  const [status, setStatus] = useState({ loading: false, error: '' })
  const pending = useRef(false)
  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setReviewing(false)
  }
  const submit = async (event) => {
    event.preventDefault()
    if (pending.current) return
    if (!reviewing) {
      setReviewing(true)
      return
    }
    pending.current = true
    setStatus({ loading: true, error: '' })
    try {
      await onSave(form)
      onClose()
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    } finally {
      pending.current = false
    }
  }
  return (
    <Modal
      onClick={() => {
        if (!pending.current) onClose()
      }}
    >
      <div
        className="modal-card payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="payment-dialog-title">
          {refund ? 'Record verified refund' : 'Verify payment'}
        </h2>
        <p>{order.reference}</p>
        <form className="form" onSubmit={submit}>
          <fieldset disabled={status.loading || reviewing}>
            {!refund && (
              <div>
                <label className="label" htmlFor="payment-status">
                  Payment status
                </label>
                <select
                  className="input"
                  id="payment-status"
                  value={form.status}
                  onChange={(event) => update('status', event.target.value)}
                >
                  <option>Paid</option>
                  <option>Pending Verification</option>
                  <option>Failed</option>
                </select>
              </div>
            )}
            <div>
              <label className="label" htmlFor="payment-amount">
                Amount (PHP)
              </label>
              <input
                className="input"
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={
                  refund
                    ? order.grossCollected - order.refundedTotal
                    : order.total
                }
                readOnly={!refund}
                required
                value={form.amount}
                onChange={(event) =>
                  update('amount', Number(event.target.value))
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="payment-method">
                {refund ? 'Refund method' : 'Payment method'}
              </label>
              <input
                className="input"
                id="payment-method"
                maxLength="40"
                required
                readOnly={!refund}
                value={form.method}
                onChange={(event) => update('method', event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="payment-reference">
                Collection / transaction reference
              </label>
              <input
                className="input"
                id="payment-reference"
                minLength="3"
                maxLength="150"
                required
                value={form.reference}
                onChange={(event) => update('reference', event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="payment-reason">
                {refund ? 'Refund reason' : 'Verification notes (optional)'}
              </label>
              <textarea
                className="input"
                id="payment-reason"
                maxLength="500"
                required={refund}
                value={form.reason}
                onChange={(event) => update('reason', event.target.value)}
              />
            </div>
            {(refund || form.status === 'Paid') && (
              <label className="terms-check">
                <input
                  type="checkbox"
                  required
                  checked={form.collectionVerified}
                  onChange={(event) =>
                    update('collectionVerified', event.target.checked)
                  }
                />
                <span>
                  {refund
                    ? 'I verified that this refund was actually paid to the customer.'
                    : 'I verified that this COD payment was actually collected.'}
                </span>
              </label>
            )}
          </fieldset>
          {reviewing && (
            <div className="payment-review" role="status">
              <p>
                Confirm {refund ? 'refund' : form.status.toLowerCase()} of ₱
                {Number(form.amount).toLocaleString('en-PH')} using{' '}
                {form.method}.
              </p>
              <p>Reference {form.reference}</p>
              <button
                className="button secondary"
                type="button"
                disabled={status.loading}
                onClick={() => setReviewing(false)}
              >
                Edit details
              </button>
            </div>
          )}
          {status.error && <p role="alert">{status.error}</p>}
          <div className="address-actions">
            <button className="button" disabled={status.loading}>
              {status.loading
                ? 'Saving…'
                : reviewing
                  ? 'Confirm payment action'
                  : 'Review payment action'}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={status.loading}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
