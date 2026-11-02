import { getOrderItemStatus } from '../../server/shared/orderWorkflow.js'

const activeStatuses = new Set(['Pending COD', 'Approved', 'To Ship', 'To Receive'])

export function hasActiveOrderItems(order) {
  if (!Array.isArray(order?.items)) return false
  return order.items.some((item) => item && activeStatuses.has(getOrderItemStatus(order, item)))
}

function parseAddress(address) {
  const parts = String(address || '').split(',').map((part) => part.trim()).filter(Boolean)
  return {
    country: parts.at(-1) || '',
    province: parts.at(-3) || '',
    city: parts.at(-4) || '',
    barangay: parts.at(-5) || '',
  }
}

export function groupActiveOrdersByAddress(orders) {
  const groups = new Map()
  orders.filter(hasActiveOrderItems).forEach((order) => {
    const address = parseAddress(order.address)
    const key = JSON.stringify([address.country, address.province, address.city, address.barangay])
    const current = groups.get(key) || { ...address, count: 0 }
    groups.set(key, { ...current, count: current.count + 1 })
  })
  return Array.from(groups.values()).sort((a, b) =>
    a.country.localeCompare(b.country) ||
    a.province.localeCompare(b.province) ||
    a.city.localeCompare(b.city) ||
    a.barangay.localeCompare(b.barangay)
  )
}
