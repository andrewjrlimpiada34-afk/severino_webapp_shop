import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { CardSkeleton } from '../components/Skeleton.jsx'
import useInventoryStock from '../hooks/useInventoryStock.js'
import { withInventoryStock } from '../lib/inventoryStore.js'

function Cart() {
  const [cartItems, setItems] = useState([])
  const stocks = useInventoryStock()
  const items = useMemo(() => cartItems.map((item) => withInventoryStock(item, stocks)), [cartItems, stocks])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [selected, setSelected] = useState({})
  const [updating, setUpdating] = useState(false)
  const updatePending = useRef(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const needsAvailabilityUpdate = items.some((item) => item.stock <= 0 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > Math.min(100, item.stock))
  const invalidSelection = items.some((item) => selected[item.id] && (item.stock <= 0 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > Math.min(100, item.stock)))
  const selectionKey = user ? `checkout_selection_${user.id}` : 'checkout_selection_guest'
  const directPurchaseKey = user
    ? `severino_direct_checkout_${user.id}`
    : 'severino_direct_checkout_guest'

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (!selected[item.id]) return sum
        return sum + item.price * item.quantity
      }, 0),
    [items, selected]
  )

  const updateQuantity = async (id, delta) => {
    if (updatePending.current) return
    if (items.find((item) => item.id === id)?.stock <= 0) {
      setStatus((current) => ({ ...current, error: 'This item is out of stock.' }))
      return
    }
    const next = items.map((item) => {
      if (item.id !== id) return item
      const maxQty = Math.min(100, item.stock ?? 100)
      return { ...item, quantity: Math.min(maxQty, Math.max(1, item.quantity + delta)) }
    })
    const previousItems = cartItems
    updatePending.current = true
    setUpdating(true)
    setItems(next)
    try {
      await api.updateCart(next.map(({ id: productId, quantity }) => ({ productId, quantity })))
    } catch (error) {
      setItems(previousItems)
      setStatus((prev) => ({ ...prev, error: error.message }))
    } finally { updatePending.current = false; setUpdating(false) }
  }

  const updateAvailability = async () => {
    if (updatePending.current) return
    updatePending.current = true
    setUpdating(true)
    try {
      const products = await api.products({ fresh: true })
      const next = items.flatMap((item) => {
        const product = products.find((entry) => entry.id === item.id)
        if (!product || product.active === false || product.stock <= 0) return []
        return [{ ...product, quantity: Math.min(100, product.stock, Math.max(1, Math.floor(Number(item.quantity)) || 1)) }]
      })
      await api.updateCart(next.map(({ id: productId, quantity }) => ({ productId, quantity })))
      const nextSelected = Object.fromEntries(next.map((item) => [item.id, Boolean(selected[item.id])]))
      setItems(next)
      setSelected(nextSelected)
      localStorage.setItem(selectionKey, JSON.stringify(Object.keys(nextSelected).filter((id) => nextSelected[id])))
      setStatus({ loading: false, error: '' })
    } catch (error) { setStatus((previous) => ({ ...previous, error: error.message })) }
    finally { updatePending.current = false; setUpdating(false) }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const [products, cart] = await Promise.all([api.products(), api.cart()])
        const merged = cart.items.map((item) => {
          const product = products.find((entry) => entry.id === item.productId) || { id: item.productId, name: 'Unavailable product', price: 0, stock: 0, active: false }
          return {
            ...product,
            quantity: item.quantity,
          }
        })
        setItems(merged.filter(Boolean))
        const saved = JSON.parse(localStorage.getItem(selectionKey) || '[]')
        setSelected(
          merged.reduce((acc, item) => {
            acc[item.id] = saved.length ? saved.includes(item.id) : true
            return acc
          }, {})
        )
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [selectionKey])

  return (
    <section className="grid cart-page" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Cart Page</h1>
        <p className="section-subtitle">Review your selections. Secure COD checkout only.</p>
      </div>

      {status.loading && <CardSkeleton lines={4} />}
      {status.error && <div className="card">Error: {status.error}</div>}
      {!status.loading && needsAvailabilityUpdate && <div className="card"><p role="status">Stock has changed. Update your cart to reduce quantities to current limits and remove unavailable products.</p><button className="button secondary" type="button" disabled={updating} onClick={updateAvailability}>{updating ? 'Updating…' : 'Update cart availability'}</button></div>}
      {!status.loading && <div className="grid two">
        <div className="card table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state cart-empty-state">
                      Currently, you have no items in your cart.
                    </div>
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={updating}
                      checked={Boolean(selected[item.id])}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = { ...prev, [item.id]: !prev[item.id] }
                          const active = Object.entries(next)
                            .filter(([, value]) => value)
                            .map(([key]) => key)
                          localStorage.setItem(selectionKey, JSON.stringify(active))
                          return next
                        })
                      }}
                    />
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                    <div className="section-subtitle">{item.size}</div>
                    <div className="section-subtitle">{item.stock > 0 ? `${item.stock} available` : 'Out of stock'}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button className="button ghost" aria-label={`Decrease quantity of ${item.name}`} disabled={updating || item.stock <= 0 || item.quantity <= 1} onClick={() => updateQuantity(item.id, -1)}>
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button className="button ghost" aria-label={`Increase quantity of ${item.name}`} disabled={updating || item.stock <= 0 || item.quantity >= Math.min(100, item.stock)} onClick={() => updateQuantity(item.id, 1)}>
                        +
                      </button>
                    </div>
                    {item.quantity >= Math.min(100, item.stock) && <p className="quantity-limit">Maximum available quantity reached.</p>}
                  </td>
                  <td>₱{(item.price * item.quantity).toLocaleString()}</td>
                  <td>
                    <button
                      className="button ghost"
                      disabled={updating}
                      onClick={async () => {
                        if (updatePending.current) return
                        const previousItems = cartItems
                        const previousSelected = selected
                        updatePending.current = true
                        setUpdating(true)
                        const next = items.filter((entry) => entry.id !== item.id)
                        setItems(next)
                        setSelected((prev) => {
                          const updated = { ...prev }
                          delete updated[item.id]
                          const active = Object.entries(updated)
                            .filter(([, value]) => value)
                            .map(([key]) => key)
                          localStorage.setItem(selectionKey, JSON.stringify(active))
                          return updated
                        })
                        try {
                          await api.updateCart(
                            next.map(({ id: productId, quantity }) => ({ productId, quantity }))
                          )
                        } catch (error) {
                          setItems(previousItems)
                          setSelected(previousSelected)
                          localStorage.setItem(selectionKey, JSON.stringify(Object.keys(previousSelected).filter((id) => previousSelected[id])))
                          setStatus((prev) => ({ ...prev, error: error.message }))
                        } finally { updatePending.current = false; setUpdating(false) }
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ fontSize: '28px' }}>
            Order Summary
          </h2>
          <p className="section-subtitle">Estimated total</p>
          <div style={{ fontSize: '32px', fontWeight: 700, margin: '12px 0' }}>
            ₱{total.toLocaleString()}
          </div>
          <div className="pill">COD only · Verified delivery</div>
          {invalidSelection && <p className="section-subtitle" role="status">Stock has changed. Adjust or deselect unavailable quantities before checkout.</p>}
          <div style={{ marginTop: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="button"
              type="button"
              disabled={updating || invalidSelection}
              onClick={() => {
                const selectedIds = Object.entries(selected)
                  .filter(([, value]) => value)
                  .map(([key]) => key)
                if (selectedIds.length === 0) {
                  setStatus((prev) => ({ ...prev, error: 'Please pick an item to order.' }))
                  return
                }
                localStorage.removeItem(directPurchaseKey)
                localStorage.setItem(selectionKey, JSON.stringify(selectedIds))
                navigate('/checkout')
              }}
            >
              Continue to Checkout
            </button>
            <a className="button secondary" href="/shop">
              Add More
            </a>
          </div>
        </div>
      </div>}
    </section>
  )
}

export default Cart
