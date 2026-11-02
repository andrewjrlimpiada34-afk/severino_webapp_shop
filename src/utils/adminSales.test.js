import test from 'node:test'
import assert from 'node:assert/strict'
import { addSalesDays, buildSalesAnalytics, rankSalesProducts, salesCalendarDays, salesDateKey, shiftSalesMonth, summarizeSales } from './adminSales.js'

const item = (productId, quantity, price, extra = {}) => ({ productId, name: `Scent ${productId}`, quantity, price, ...extra })
const order = (id, createdAt, items, extra = {}) => ({
  id, createdAt, items, status: 'To Ship', total: items.reduce((total, product) => total + product.quantity * product.price, 0), ...extra,
})

test('sales dates use Philippine midnight boundaries regardless of the browser timezone', () => {
  assert.equal(salesDateKey('2026-11-02T15:59:59Z'), '2026-11-02')
  assert.equal(salesDateKey('2026-11-02T16:00:00Z'), '2026-11-03')
  assert.equal(salesDateKey('2025-12-31T17:00:00Z'), '2026-01-01')
  assert.equal(salesDateKey('invalid'), '')
  assert.equal(salesDateKey(null), '')
})

test('calendar navigation handles year boundaries and leap days with six complete weeks', () => {
  assert.equal(shiftSalesMonth('2026-01', -1), '2025-12')
  assert.equal(shiftSalesMonth('2026-12', 1), '2027-01')
  assert.equal(addSalesDays('2024-02-28', 1), '2024-02-29')
  assert.equal(addSalesDays('2024-02-29', 1), '2024-03-01')
  const days = salesCalendarDays('2024-02')
  assert.equal(days.length, 42)
  assert.equal(days.filter((day) => day.inMonth).length, 29)
  assert.equal(new Date(`${days[0].key}T00:00:00Z`).getUTCDay(), 0)
  assert.equal(new Set(days.map((day) => day.key)).size, 42)
})

test('sales history preserves order totals, excludes cancelled orders, and separates months and years', () => {
  const original = [
    order('today', '2026-11-02T17:00:00Z', [item('A', 2, 500)]),
    order('yesterday', '2026-11-01T17:00:00Z', [item('B', 1, 250)]),
    order('previous-month', '2026-10-01T00:00:00Z', [item('C', 1, 600)]),
    order('previous-year', '2025-01-01T00:00:00Z', [item('D', 1, 300)]),
    order('cancelled', '2026-11-03T00:00:00Z', [item('A', 9, 500)], { status: 'Cancelled' }),
    order('removed', '2026-11-03T00:00:00Z', [item('A', 9, 500)], { status: 'Removed' }),
  ]
  const before = structuredClone(original)
  const data = buildSalesAnalytics(original, '2026-11-03')
  assert.deepEqual(data.summary, { count: 4, revenue: 2150, units: 5 })
  assert.equal(data.week.length, 7)
  assert.equal(data.weeklyTotal, 1250)
  assert.equal(data.week.at(-1).total, 1000)
  assert.equal(data.daily.get('2026-11-03').count, 1)
  assert.deepEqual(summarizeSales(data.orders.filter((entry) => entry.dateKey.startsWith('2026-11'))), { count: 2, revenue: 1250, units: 3 })
  assert.equal(rankSalesProducts(data.orders.filter((entry) => entry.dateKey.startsWith('2026')))[0].id, 'A')
  assert.deepEqual(original, before)
})

test('yearly product rankings group product IDs, exclude cancelled items, and break quantity ties by revenue', () => {
  const data = buildSalesAnalytics([
    order('first', '2026-01-02T00:00:00Z', [item('A', 2, 100), item('B', 3, 200), item('C', 100, 900, { trackingStatus: 'Cancelled' })]),
    order('later', '2026-11-02T00:00:00Z', [item('A', 1, 100, { name: 'Renamed scent' }), item('D', 50, 900, { trackingStatus: 'Removed' })]),
  ], '2026-11-03')
  const ranking = rankSalesProducts(data.orders)
  assert.deepEqual(ranking.map((product) => product.id), ['B', 'A'])
  assert.equal(ranking[1].sold, 3)
  assert.equal(ranking[1].name, 'Renamed scent')
  assert.equal(ranking[0].revenue, 600)
  assert.equal(data.summary.units, 6)
})

test('empty history, legacy items, invalid dates, and non-finite totals do not create false daily sales', () => {
  const empty = buildSalesAnalytics([], '2026-11-03')
  assert.equal(empty.week.every((day) => day.total === 0), true)
  assert.deepEqual(empty.summary, { count: 0, revenue: 0, units: 0 })
  assert.equal(empty.mostSoldProduct, undefined)
  const data = buildSalesAnalytics([
    { id: 'legacy', total: 100, createdAt: '2026-11-01T00:00:00Z' },
    { id: 'undated', total: 300 },
    { id: 'invalid-total', total: Infinity, createdAt: '2026-11-01T00:00:00Z' },
  ], '2026-11-03')
  assert.equal(data.weeklyTotal, 100)
  assert.equal(data.daily.has('2026-11-03'), false)
  assert.equal(data.daily.has(''), false)
  assert.deepEqual(rankSalesProducts(data.orders), [])
})
