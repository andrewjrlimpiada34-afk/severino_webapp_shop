import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const steps = ['Shipping', 'Contact', 'Review']

function Checkout() {
  const [stepIndex, setStepIndex] = useState(0)
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })
  const [form, setForm] = useState({
    name: '',
    addressLine: '',
    barangay: '',
    city: '',
    province: '',
    zip: '',
    country: '',
    mobile: '',
    email: '',
    notes: '',
  })
  const [selectedItems, setSelectedItems] = useState([])
  const { user } = useAuth()
  const selectionKey = user ? `checkout_selection_${user.id}` : 'checkout_selection_guest'

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await api.profile()
        setForm((prev) => ({
          ...prev,
          name: profile.name || prev.name,
          addressLine: profile.addressLine || prev.addressLine,
          barangay: profile.barangay || prev.barangay,
          city: profile.city || prev.city,
          province: profile.province || prev.province,
          zip: profile.zip || prev.zip,
          country: profile.country || prev.country,
          mobile: profile.phone || prev.mobile,
          email: profile.email || prev.email,
        }))
      } catch {
        // ignore, user may not have profile yet
      }
    }
    loadProfile()

    const selection = JSON.parse(localStorage.getItem(selectionKey) || '[]')
    setSelectedItems(selection.map(String))
  }, [selectionKey])

  const confirmOrder = async () => {
    if (
      !form.name ||
      !form.barangay ||
      !form.city ||
      !form.province ||
      !form.zip ||
      !form.country ||
      !form.mobile ||
      !form.email
    ) {
      setStatus({ loading: false, error: 'Please complete all required fields.', success: '' })
      return
    }
    try {
      setStatus({ loading: true, error: '', success: '' })
      await api.updateProfile({
        name: form.name,
        email: form.email,
        phone: form.mobile,
        addressLine: form.addressLine,
        barangay: form.barangay,
        city: form.city,
        province: form.province,
        zip: form.zip,
        country: form.country,
      })
      const cart = await api.cart()
      const filtered = cart.items.filter((item) =>
        selectedItems.length ? selectedItems.includes(String(item.productId)) : true
      )
      if (filtered.length === 0) {
        setStatus({ loading: false, error: 'Please pick an item to order.', success: '' })
        return
      }
      const products = await api.products()
      const items = filtered.map((item) => {
        const product = products.find((entry) => entry.id === item.productId)
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product?.price || 0,
          name: product?.name || 'Item',
        }
      })
      if (items.some((item) => item.price <= 0)) {
        setStatus({
          loading: false,
          error: 'Unable to verify selected item pricing. Please refresh and try again.',
          success: '',
        })
        return
      }
      await api.createOrder({
        items,
        address: `${form.addressLine || ''}, ${form.barangay}, ${form.city}, ${form.province}, ${form.zip}, ${form.country}`,
        contactName: form.name,
        phone: form.mobile,
        email: form.email,
        paymentMethod: 'COD',
      })
      if (selectedItems.length) {
        const remaining = cart.items.filter(
          (item) => !selectedItems.includes(String(item.productId))
        )
        await api.updateCart(remaining)
        localStorage.removeItem(selectionKey)
      }
      setStatus({ loading: false, error: '', success: 'Order placed successfully.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Checkout Flow</h1>
        <p className="section-subtitle">
          Secure, COD-only checkout with validation and delivery confirmation.
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {steps.map((step, index) => (
            <span
              key={step}
              className="pill"
              style={{
                background: index === stepIndex ? 'rgba(95, 117, 65, 0.3)' : undefined,
              }}
            >
              {index + 1}. {step}
            </span>
          ))}
        </div>

        <div style={{ marginTop: '24px' }}>
          {stepIndex === 0 && (
            <div className="form">
              <div>
                <div className="label">Full Name</div>
                <input
                  className="input"
                  placeholder="Juan Dela Cruz"
                  required
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </div>
              <div>
                <div className="label">Street Address (Optional)</div>
                <input
                  className="input"
                  placeholder="House no., street"
                  value={form.addressLine}
                  onChange={(event) => updateField('addressLine', event.target.value)}
                />
              </div>
              <div className="grid two">
                <div>
                  <div className="label">Barangay (Required)</div>
                  <input
                    className="input"
                    placeholder="Barangay"
                    required
                    value={form.barangay}
                    onChange={(event) => updateField('barangay', event.target.value)}
                  />
                </div>
                <div>
                  <div className="label">City/Municipality (Required)</div>
                  <input
                    className="input"
                    placeholder="City/Municipality"
                    required
                    value={form.city}
                    onChange={(event) => updateField('city', event.target.value)}
                  />
                </div>
              </div>
              <div className="grid two">
                <div>
                  <div className="label">Province/State (Required)</div>
                  <input
                    className="input"
                    placeholder="Province"
                    required
                    value={form.province}
                    onChange={(event) => updateField('province', event.target.value)}
                  />
                </div>
                <div>
                  <div className="label">ZIP Code (Required)</div>
                  <input
                    className="input"
                    placeholder="Zip code"
                    required
                    value={form.zip}
                    onChange={(event) => updateField('zip', event.target.value)}
                  />
                </div>
              </div>
              <div>
                <div className="label">Country (Required)</div>
                <input
                  className="input"
                  placeholder="Country"
                  required
                  value={form.country}
                  onChange={(event) => updateField('country', event.target.value)}
                />
              </div>
            </div>
          )}
          {stepIndex === 1 && (
            <div className="form">
              <div>
                <div className="label">Mobile Number</div>
                <input
                  className="input"
                  placeholder="+63 9xx xxx xxxx"
                  required
                  value={form.mobile}
                  onChange={(event) => updateField('mobile', event.target.value)}
                />
              </div>
              <div>
                <div className="label">Email</div>
                <input
                  className="input"
                  type="email"
                  placeholder="you@email.com"
                  required
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                />
              </div>
              <div>
                <div className="label">Delivery Notes</div>
                <textarea
                  className="input"
                  rows="3"
                  placeholder="Landmark, gate code, etc."
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                />
              </div>
            </div>
          )}
          {stepIndex === 2 && (
            <div className="grid two">
              <div className="card">
                <div className="tag">Payment</div>
                <h3 className="section-title" style={{ fontSize: '24px' }}>
                  Cash on Delivery
                </h3>
                <p className="section-subtitle">Pay upon arrival. We confirm by SMS.</p>
              </div>
              <div className="card">
                <div className="tag">Security</div>
                <p className="section-subtitle">
                  Order is protected with address verification and one-time delivery PIN.
                </p>
                <div className="pill">Encrypted form data</div>
              </div>
            </div>
          )}
        </div>

        {status.loading && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="loader" />
            Processing order...
          </div>
        )}
        {status.error && <div className="card">Error: {status.error}</div>}
        {status.success && <div className="card">{status.success}</div>}
        <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
          <button
            className="button secondary"
            onClick={() => {
              if (stepIndex === 0) {
                window.location.href = '/cart'
              } else {
                setStepIndex((prev) => Math.max(0, prev - 1))
              }
            }}
          >
            Back
          </button>
          <button
            className="button"
            onClick={() => {
              if (stepIndex === steps.length - 1) {
                confirmOrder()
              } else {
                setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))
              }
            }}
          >
            {stepIndex === steps.length - 1 ? 'Confirm Order' : 'Next'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default Checkout
