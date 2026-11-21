import { Link } from 'react-router-dom'
import { getOrderItemStatus, getOrderStatusLabel, normalizeOrderStatus, orderSteps } from '../../server/shared/orderWorkflow.js'
import { buildCloudinaryUrl } from '../lib/image.js'
import StatusBadge from './StatusBadge.jsx'
import StoreIcon from './StoreIcon.jsx'

const stages = ['Pending COD', ...orderSteps]
const updates = {
  'Pending COD': 'Waiting for the shop to confirm your order.',
  Approved: 'The shop has confirmed your order.',
  'To Ship': 'Your order is being prepared for shipment.',
  'To Receive': 'Your package is on its way.',
  'To Review': 'Your package has been delivered.',
  Cancelled: 'This order was cancelled.',
  Removed: 'This order was removed.',
}
const shortDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export default function OrderTrackingCard({ order, images, busy, onCancel, onBuyAgain }) {
  const placedAt = order.createdAt ? new Date(order.createdAt) : null
  const status = normalizeOrderStatus(order.status) || order.status
  const stageIndex = stages.indexOf(status)
  const mixedStatuses = order.items.some(item => getOrderItemStatus(order, item) !== status)
  const activeItems = order.items.filter(item => !['Cancelled', 'Removed'].includes(getOrderItemStatus(order, item)))
  const canCancel = activeItems.length > 0 && activeItems.every(item => getOrderItemStatus(order, item) === 'Pending COD')
  const events = Array.from(new Map(order.items.flatMap(item => item.trackingEvents || [])
    .map(event => [`${event.status}:${event.at}`, event])).values())
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))

  return (
    <article className="card order-card purchase-card">
      <header className="purchase-heading">
        <h2>{placedAt && Number.isFinite(placedAt.getTime())
          ? <time dateTime={order.createdAt} title={placedAt.toLocaleString('en-PH')}>Ordered {shortDate.format(placedAt)}</time>
          : 'Your order'}</h2>
        <StatusBadge status={status} />
        {order.reference && <span className="purchase-reference">{order.reference}</span>}
      </header>

      <details className="order-details purchase-tracking">
        <summary>
          <StoreIcon name={status === 'To Receive' || status === 'To Review' ? 'truck' : 'box'} />
          <span>{updates[status] || 'View delivery and tracking details.'}</span>
          <StoreIcon name="chevron" className="purchase-chevron" />
        </summary>
        <div className="purchase-details-body">
          {stageIndex >= 0 && <ol className="order-timeline" aria-label="Order progress">
            {stages.map((stage, index) => (
              <li key={stage} aria-current={index === stageIndex ? 'step' : undefined} className={index <= stageIndex ? 'is-complete' : ''}>
                <span className="tracking-node" aria-hidden="true">{index < stageIndex && <StoreIcon name="check" />}</span>
                <strong className="tracking-name">{getOrderStatusLabel(stage)}</strong>
                <span className="order-timeline-label">{index === stageIndex ? 'Current stage' : index < stageIndex ? 'Reached' : 'Upcoming'}</span>
              </li>
            ))}
          </ol>}
          <section className="order-delivery">
            <h3>Delivery address</h3>
            <p>{order.contactName}<br />{order.address}<br />{order.phone}</p>
            {order.addressSnapshot?.notes && <p>{order.addressSnapshot.notes}</p>}
          </section>
          {events.length > 0 && <details>
            <summary>Tracking events</summary>
            <ol className="order-events">
              {events.map(event => <li key={`${event.status}:${event.at}`}>
                <StatusBadge status={event.status} /> <time dateTime={event.at}>{new Date(event.at).toLocaleString('en-PH')}</time>
              </li>)}
            </ol>
          </details>}
          {canCancel && <button className="button secondary" type="button" disabled={busy} onClick={() => onCancel({ order })}>Cancel order</button>}
        </div>
      </details>

      <div className="purchase-items">
        {order.items.map((item, index) => {
          const key = item.itemId || `${index}-${item.productId}`
          const itemStatus = getOrderItemStatus(order, item)
          const src = item.imageUrl || images.get(String(item.productId))
          return (
            <section className="order-item purchase-item" key={key}>
              <div className="purchase-thumbnail">
                <StoreIcon name="bottle" />
                {src && <img key={src} src={buildCloudinaryUrl(src, { width: 192 })} loading="lazy" alt="" onError={event => { event.currentTarget.hidden = true }} />}
              </div>
              <div className="purchase-item-info">
                <h3>{item.name || item.productName || 'Unavailable product'}</h3>
                <p>{currency.format(item.price)} each</p>
                {mixedStatuses && itemStatus && <StatusBadge status={itemStatus} />}
                {item.returnedQuantity > 0 && <p>{item.returnedQuantity} returned</p>}
              </div>
              <div className="purchase-item-price">
                <strong>{currency.format(item.price * item.quantity)}</strong>
                <span aria-label={`Quantity ${item.quantity}`}>×{item.quantity}</span>
              </div>
              {itemStatus === 'Pending COD' && <div className="purchase-item-actions purchase-cancel">
                <button className="store-text-link" type="button" disabled={busy} onClick={() => onCancel({ order, item: { ...item, itemId: key } })}>Cancel item</button>
              </div>}
              {itemStatus === 'To Review' && <div className="purchase-item-actions">
                <Link className="button secondary" to={`/product/${item.productId}`}>Rate this product</Link>
                <button className="button" type="button" disabled={busy} onClick={() => onBuyAgain(item)}>Buy again</button>
              </div>}
            </section>
          )
        })}
      </div>
      <footer className="purchase-total">
        <span>Payment <StatusBadge status={order.paymentStatus || 'Unpaid'} /></span>
        <span>Order total <strong>{order.total == null ? 'Unavailable' : currency.format(order.total)}</strong></span>
        {order.refundedTotal > 0 && <small>Verified refunds {currency.format(order.refundedTotal)}</small>}
      </footer>
    </article>
  )
}
