import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

function Cart() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [selected, setSelected] = useState({})
  const navigate = useNavigate()
  const { user } = useAuth()
  const selectionKey = user ? `checkout_selection_${user.id}` : 'checkout_selection_guest'

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (!selected[item.id]) return sum
        return sum + item.price * item.quantity
      }, 0),
    [items, selected]
  )

  const updateQuantity = async (id, delta) => {
    const next = items.map((item) => {
      if (item.id !== id) return item
      const maxQty = Math.min(100, item.stock ?? 100)
      return { ...item, quantity: Math.min(maxQty, Math.max(1, item.quantity + delta)) }
    })
    setItems(next)
    try {
      await api.updateCart(next.map(({ id: productId, quantity }) => ({ productId, quantity })))
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const [products, cart] = await Promise.all([api.products(), api.cart()])
        const merged = cart.items.map((item) => {
          const product = products.find((entry) => entry.id === item.productId)
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
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Cart Page</h1>
        <p className="section-subtitle">Review your selections. Secure COD checkout only.</p>
      </div>

      {status.loading && (
        <div className="card">
          <div className="loader" /> Loading cart...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="grid two">
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
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
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
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button className="button ghost" onClick={() => updateQuantity(item.id, -1)}>
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button className="button ghost" onClick={() => updateQuantity(item.id, 1)}>
                        +
                      </button>
                    </div>
                  </td>
                  <td>₱{(item.price * item.quantity).toLocaleString()}</td>
                  <td>
                    <button
                      className="button ghost"
                      onClick={async () => {
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
                          setStatus((prev) => ({ ...prev, error: error.message }))
                        }
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
          <div style={{ marginTop: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="button"
              type="button"
              onClick={() => {
                const selectedIds = Object.entries(selected)
                  .filter(([, value]) => value)
                  .map(([key]) => key)
                if (selectedIds.length === 0) {
                  setStatus((prev) => ({ ...prev, error: 'Please pick an item to order.' }))
                  return
                }
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
      </div>
    </section>
  )
}

export default Cart
