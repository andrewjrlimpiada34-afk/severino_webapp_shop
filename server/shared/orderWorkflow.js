export const orderSteps = ['Approved', 'To Ship', 'To Receive', 'To Review']
const aliases = {
  pending: 'Pending COD', 'pending cod': 'Pending COD', approved: 'Approved', verified: 'Approved',
  'to ship': 'To Ship', 'to receive': 'To Receive', 'to review': 'To Review',
  completed: 'To Review', delivered: 'To Review', cancelled: 'Cancelled', canceled: 'Cancelled', removed: 'Removed',
}

export const normalizeOrderStatus = (value) => aliases[String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')] || ''

export function getOrderItemStatus(order, item) {
  const parent = normalizeOrderStatus(order?.status)
  if (parent === 'Cancelled' || parent === 'Removed') return parent
  const own = String(item?.trackingStatus || '').trim()
  return own ? normalizeOrderStatus(own) || own : parent
}

export function getNextOrderStatus(status) {
  const current = normalizeOrderStatus(status)
  if (current === 'Pending COD') return 'Approved'
  const index = orderSteps.indexOf(current)
  return index >= 0 ? orderSteps[index + 1] || null : null
}

export function summarizeOrderStatus(items, fallback = 'Pending COD') {
  const statuses = items.map((item) => normalizeOrderStatus(item.trackingStatus) || normalizeOrderStatus(fallback))
  const remaining = statuses.filter((status) => status !== 'Cancelled' && status !== 'Removed')
  if (!remaining.length) return statuses.length && statuses.every((status) => status === 'Removed') ? 'Removed' : 'Cancelled'
  if (remaining.includes('Pending COD')) return 'Pending COD'
  return orderSteps.find((status) => remaining.includes(status)) || normalizeOrderStatus(fallback) || 'Pending COD'
}
