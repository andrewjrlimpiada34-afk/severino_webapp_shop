import { useRef } from 'react'
import AdminIcon from './AdminIcon.jsx'
import { addSalesDays, formatSalesCurrency, formatSalesDate, formatSalesMonth, salesCalendarDays, salesDateKey, shiftSalesMonth } from '../utils/adminSales.js'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SalesCalendar({ selectedDate, dailySales, onSelectDate, onMonthChange }) {
  const month = selectedDate.slice(0, 7)
  const days = salesCalendarDays(month)
  const today = salesDateKey()
  const activeDayRef = useRef(null)

  const handleDayKey = (event, key) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (!(event.key in offsets)) return
    event.preventDefault()
    onSelectDate(addSalesDays(key, offsets[event.key]))
    window.requestAnimationFrame(() => activeDayRef.current?.focus())
  }

  return (
    <div className="sales-calendar">
      <div className="sales-calendar-heading">
        <div><span className="sales-eyebrow">Sales calendar</span><h3>{formatSalesMonth(month)}</h3></div>
        <div className="sales-calendar-arrows">
          <button className="sales-icon-button" type="button" aria-label="Previous month" onClick={() => onMonthChange(shiftSalesMonth(month, -1))}><AdminIcon name="left" /></button>
          <button className="sales-icon-button" type="button" aria-label="Next month" onClick={() => onMonthChange(shiftSalesMonth(month, 1))}><AdminIcon name="right" /></button>
        </div>
      </div>
      <label className="sales-calendar-picker"><AdminIcon name="calendar" /><span className="sr-only">Choose sales month</span><input type="month" value={month} onChange={(event) => event.target.value && onMonthChange(event.target.value)} /></label>
      <table className="sales-calendar-table">
        <caption className="sr-only">Select a date to view its orders. Dots indicate days with sales.</caption>
        <thead><tr>{weekdays.map((day) => <th scope="col" key={day}><abbr title={day}>{day.slice(0, 1)}</abbr></th>)}</tr></thead>
        <tbody>{Array.from({ length: 6 }, (_, row) => (
          <tr key={row}>{days.slice(row * 7, row * 7 + 7).map((day) => {
            const sales = dailySales.get(day.key)
            return (
              <td key={day.key}>
                <button type="button" className={`sales-calendar-day ${day.inMonth ? '' : 'is-outside'}`} ref={day.key === selectedDate ? activeDayRef : null} tabIndex={day.key === selectedDate ? 0 : -1} aria-pressed={day.key === selectedDate} aria-current={day.key === today ? 'date' : undefined} aria-label={`${formatSalesDate(day.key)}, ${sales?.count || 0} orders, ${formatSalesCurrency(sales?.revenue || 0)}`} title={`${formatSalesDate(day.key)} · ${formatSalesCurrency(sales?.revenue || 0)}`} onClick={() => onSelectDate(day.key)} onKeyDown={(event) => handleDayKey(event, day.key)}>
                  <span>{day.day}</span><span className={`sales-calendar-dot ${sales?.count ? 'has-sales' : ''}`} aria-hidden="true" />
                </button>
              </td>
            )
          })}</tr>
        ))}</tbody>
      </table>
      <div className="sales-calendar-legend"><span><i aria-hidden="true" />Sales recorded</span><button type="button" onClick={() => onSelectDate(today)}>Today</button></div>
    </div>
  )
}
