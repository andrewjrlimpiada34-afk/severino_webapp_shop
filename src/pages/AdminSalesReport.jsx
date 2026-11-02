import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import AdminIcon from '../components/AdminIcon.jsx'
import SalesCalendar from '../components/SalesCalendar.jsx'
import { printSalesReportPdf } from '../utils/salesReportPdf.js'
import { buildSalesAnalytics, formatSalesCurrency, formatSalesDate, formatSalesMonth, rankSalesProducts, salesDateKey, summarizeSales } from '../utils/adminSales.js'
import '../sales-report.css'

const pageSize = 6
const compactAmount = (value) => `₱${new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`

function SalesWeekChart({ data }) {
  const max = Math.max(...data.map((day) => day.total), 100)
  const points = data.map((day, index) => ({ ...day, x: 14 + index / 6 * 572, y: 174 - day.total / max * 142 }))
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <div className="sales-chart-card">
      <div className="sales-chart-heading"><span className="sales-eyebrow">Sales per day</span><span>Last 7 days</span></div>
      <svg className="sales-week-chart" viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="Order value over the last seven days">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <line key={ratio} x1="14" x2="586" y1={174 - ratio * 142} y2={174 - ratio * 142} className="sales-chart-gridline" />)}
        <polygon points={`14,174 ${line} 586,174`} className="sales-chart-area" />
        <polyline points={line} className="sales-chart-line" />
        {points.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="4" className="sales-chart-point"><title>{formatSalesDate(point.key)}: {formatSalesCurrency(point.total)}</title></circle>)}
      </svg>
      <div className="sales-chart-labels">{data.map((day) => (
        <div key={day.key} title={`${formatSalesDate(day.key)} · ${formatSalesCurrency(day.total)}`}><span>{day.label}</span><strong aria-label={formatSalesCurrency(day.total)}>{compactAmount(day.total)}</strong></div>
      ))}</div>
    </div>
  )
}

function SalesMetric({ label, value, icon }) {
  return <div className="sales-metric"><span className="sales-metric-icon"><AdminIcon name={icon} /></span><div><span className="sales-eyebrow">{label}</span><strong>{value}</strong></div></div>
}

function AdminSalesReport() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [reload, setReload] = useState(0)
  const [selectedDate, setSelectedDate] = useState(salesDateKey)
  const [historyScope, setHistoryScope] = useState('month')
  const [page, setPage] = useState(0)
  const month = selectedDate.slice(0, 7)
  const year = selectedDate.slice(0, 4)
  const analytics = useMemo(() => buildSalesAnalytics(orders), [orders])
  const monthOrders = useMemo(() => analytics.orders.filter((order) => order.dateKey.startsWith(month)), [analytics.orders, month])
  const history = useMemo(() => historyScope === 'day' ? monthOrders.filter((order) => order.dateKey === selectedDate) : monthOrders, [monthOrders, historyScope, selectedDate])
  const historySummary = useMemo(() => summarizeSales(history), [history])
  const monthSummary = useMemo(() => summarizeSales(monthOrders), [monthOrders])
  const yearOrders = useMemo(() => analytics.orders.filter((order) => order.dateKey.startsWith(year)), [analytics.orders, year])
  const yearlyProducts = useMemo(() => rankSalesProducts(yearOrders), [yearOrders])
  const yearSummary = useMemo(() => summarizeSales(yearOrders), [yearOrders])
  const winner = yearlyProducts[0]
  const years = [...new Set([salesDateKey().slice(0, 4), year, ...analytics.orders.filter((order) => order.dateKey).map((order) => order.dateKey.slice(0, 4))])].sort().reverse()
  const pageCount = Math.ceil(history.length / pageSize)
  const visibleOrders = history.slice(page * pageSize, (page + 1) * pageSize)

  useEffect(() => {
    let active = true
    const load = async () => {
      setStatus({ loading: true, error: '' })
      try {
        const data = await api.orders()
        if (!active) return
        setOrders(Array.isArray(data) ? data : [])
        setStatus({ loading: false, error: '' })
      } catch (error) {
        if (active) setStatus({ loading: false, error: error.message })
      }
    }
    load()
    return () => { active = false }
  }, [reload])

  const selectDate = (date) => {
    setSelectedDate(date)
    setHistoryScope('day')
    setPage(0)
  }
  const selectMonth = (nextMonth) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(nextMonth)) return
    setSelectedDate(`${nextMonth}-01`)
    setHistoryScope('month')
    setPage(0)
  }

  return (
    <section className="sales-report">
      <header className="sales-page-heading"><div><span className="sales-eyebrow">Admin studio / Analytics</span><h1 className="section-title">Sales Report</h1><p className="section-subtitle">A closer look at your sales, one day at a time.</p></div><span className="sales-heading-mark" aria-hidden="true"><AdminIcon name="sales" /></span></header>

      {status.loading && <div className="card sales-loading" role="status"><div className="loader" />Loading your sales report…</div>}
      {status.error && <div className="card sales-error" role="alert"><p>{status.error}</p><button type="button" className="button secondary" onClick={() => setReload((value) => value + 1)}>Try again</button></div>}

      {!status.loading && !status.error && <>
        <section className="card sales-summary-card" aria-labelledby="sales-summary-title">
          <div className="sales-section-heading"><div><span className="sales-eyebrow">The big picture</span><h2 id="sales-summary-title">Sales Summary</h2></div><button className="button secondary sales-print-button" type="button" onClick={() => printSalesReportPdf({ summary: analytics.summary, chartData: analytics.week, weeklyTotal: analytics.weeklyTotal, averageDaily: analytics.averageDaily, mostSoldProduct: analytics.mostSoldProduct })}><AdminIcon name="print" /><span>Print PDF</span></button></div>
          <div className="sales-summary-layout">
            <SalesWeekChart data={analytics.week} />
            <div className="sales-metrics">
              <SalesMetric label="Total orders · all time" value={analytics.summary.count.toLocaleString()} icon="orders" />
              <SalesMetric label="Revenue · all time" value={formatSalesCurrency(analytics.summary.revenue)} icon="sales" />
              <SalesMetric label="Sales · last 7 days" value={formatSalesCurrency(analytics.weeklyTotal)} icon="calendar" />
              <SalesMetric label="Average per day" value={formatSalesCurrency(analytics.averageDaily)} icon="overview" />
            </div>
          </div>
        </section>

        <section className="sales-history-section" aria-labelledby="sales-history-title">
          <div className="sales-section-heading"><div><span className="sales-eyebrow">Explore the archive</span><h2 id="sales-history-title">Sales history</h2></div><span className="sales-period-pill"><AdminIcon name="calendar" />{formatSalesMonth(month)}</span></div>
          <div className="sales-history-layout">
            <div className="card sales-calendar-card">
              <SalesCalendar selectedDate={selectedDate} dailySales={analytics.daily} onSelectDate={selectDate} onMonthChange={selectMonth} />
              <div className="sales-month-total"><span>This month</span><strong>{formatSalesCurrency(monthSummary.revenue)}</strong><small>{monthSummary.count} {monthSummary.count === 1 ? 'order' : 'orders'}</small></div>
            </div>
            <div className="card sales-history-card">
              <div className="sales-history-heading"><div><h3>{historyScope === 'day' ? formatSalesDate(selectedDate, { month: 'long', day: 'numeric' }) : 'Monthly orders'}</h3><p>{historyScope === 'day' ? 'Orders for the selected date' : 'All orders in the selected month'}</p></div><div className="sales-scope-switch" role="group" aria-label="Sales history period">{['month', 'day'].map((scope) => <button key={scope} type="button" aria-pressed={historyScope === scope} onClick={() => { setHistoryScope(scope); setPage(0) }}>{scope === 'month' ? 'Month' : 'Day'}</button>)}</div></div>
              <div className="sales-history-totals" aria-live="polite"><div><span className="sales-eyebrow">Order value</span><strong>{formatSalesCurrency(historySummary.revenue)}</strong></div><div><span className="sales-eyebrow">Orders</span><strong>{historySummary.count}</strong></div><div><span className="sales-eyebrow">Units</span><strong>{historySummary.units}</strong></div></div>
              {history.length === 0 ? <div className="sales-empty"><AdminIcon name="orders" /><h4>No orders for this {historyScope === 'day' ? 'date' : 'month'}</h4><p>Choose another date to explore your sales.</p></div> : <>
                <ol className="sales-order-list">{visibleOrders.map((order) => <li key={order.id} className="sales-order-row"><span className="sales-order-symbol" aria-hidden="true"><AdminIcon name="orders" /></span><div className="sales-order-info"><strong>{order.contactName || 'Customer order'}</strong><span>{formatSalesDate(order.dateKey, { month: 'short', day: 'numeric' })}<i aria-hidden="true">·</i>{order.units} {order.units === 1 ? 'unit' : 'units'}</span><small title={String(order.id)}>#{String(order.id).slice(-8).toUpperCase()}</small></div><div className="sales-order-amount"><strong>{formatSalesCurrency(order.revenue)}</strong><span>{order.status || 'Recorded'}</span></div></li>)}</ol>
                <div className="sales-history-pagination"><span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, history.length)} of {history.length} orders</span><div><button type="button" className="sales-icon-button" aria-label="Previous sales history page" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><AdminIcon name="left" /></button><button type="button" className="sales-icon-button" aria-label="Next sales history page" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}><AdminIcon name="right" /></button></div></div>
              </>}
              <p className="sales-data-note">Order totals exclude cancelled and removed orders. Dates use Philippine time.</p>
            </div>
          </div>
        </section>

        <section className="card sales-year-card" aria-labelledby="sales-year-title">
          <div className="sales-section-heading"><div><span className="sales-eyebrow">The annual favourite</span><h2 id="sales-year-title">Product of the year</h2></div><label className="sales-year-picker"><AdminIcon name="calendar" /><span className="sr-only">Product of the year</span><select value={year} onChange={(event) => selectMonth(`${event.target.value}-${month.slice(5)}`)}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
          {winner ? <>
            <div className="sales-year-layout">
              <div className="sales-winner">
                <span className="sales-winner-badge"><AdminIcon name="trophy" />{year} best seller</span>
                <h3>{winner.name}</h3>
                <p>{winner.sold.toLocaleString()} units sold across the year</p>
              </div>
              <div className="sales-winner-stats">
                <div><span className="sales-eyebrow">Product revenue</span><strong>{formatSalesCurrency(winner.revenue)}</strong></div>
                <div><span className="sales-eyebrow">Share of units sold</span><strong>{yearSummary.units ? Math.round(winner.sold / yearSummary.units * 100) : 0}%</strong></div>
              </div>
            </div>
            {yearlyProducts.length > 1 && <div className="sales-runner-ups">{yearlyProducts.slice(1, 4).map((product, index) => <div key={product.id}><span className="sales-product-rank">{String(index + 2).padStart(2, '0')}</span><div><strong>{product.name}</strong><span>{product.sold.toLocaleString()} units · {formatSalesCurrency(product.revenue)}</span></div></div>)}</div>}
            <p className="sales-data-note">Ranked by units sold in {year}; product revenue breaks ties. Cancelled and removed items are excluded.</p>
          </> : <div className="sales-empty sales-year-empty"><AdminIcon name="trophy" /><h4>No product sales recorded for {year}</h4><p>Choose a different year to view its best seller.</p></div>}
        </section>
      </>}
    </section>
  )
}

export default AdminSalesReport
