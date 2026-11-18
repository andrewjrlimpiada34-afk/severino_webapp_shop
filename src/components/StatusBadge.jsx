import {
  getOrderStatusLabel,
  normalizeOrderStatus
} from '../../server/shared/orderWorkflow.js'
const tones = {
  'Pending COD': 'pending',
  'Pending Verification': 'pending',
  Unpaid: 'pending',
  Approved: 'processing',
  'To Ship': 'processing',
  'To Receive': 'processing',
  'To Review': 'success',
  Paid: 'success',
  Delivered: 'success',
  Completed: 'success',
  Cancelled: 'danger',
  Canceled: 'danger',
  Failed: 'danger',
  Refunded: 'neutral',
  'Partially Refunded': 'pending',
  Removed: 'neutral'
}
export default function StatusBadge({ status }) {
  const normalized = normalizeOrderStatus(status) || status
  return (
    <span
      className={`badge status-badge status-${tones[normalized] || 'neutral'}`}
    >
      {getOrderStatusLabel(status)}
    </span>
  )
}
