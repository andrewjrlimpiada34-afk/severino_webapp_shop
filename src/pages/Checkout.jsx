import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useActionAnimation } from '../context/useActionAnimation.js'
import { checkoutErrors, checkoutStepFields, firstInvalidCheckoutStep, normalizeCheckout } from '../lib/checkoutValidation.js'
import Modal from '../components/Modal.jsx'

const steps = ['Shipping', 'Contact', 'Review']

function Checkout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { playActionAnimation } = useActionAnimation()
  const selectionKey = user ? `checkout_selection_${user.id}` : 'checkout_selection_guest'
  const directPurchaseKey = user
    ? `severino_direct_checkout_${user.id}`
    : 'severino_direct_checkout_guest'
  const selectedItems = useMemo(() => {
    try {
      const selection = JSON.parse(localStorage.getItem(selectionKey) || '[]')
      return Array.isArray(selection) ? selection.map(String) : []
    } catch { return [] }
  }, [selectionKey])
  const directPurchase = useMemo(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(directPurchaseKey) || 'null')
      if (!parsed?.productId || Number(parsed.quantity) < 1) return null
      return {
        productId: String(parsed.productId),
        quantity: Math.min(100, Math.max(1, Number(parsed.quantity) || 1)),
      }
    } catch {
      return null
    }
  }, [directPurchaseKey])
  const [stepIndex, setStepIndex] = useState(0)
  const [touched, setTouched] = useState({})
  const formRef = useRef(null)
  const headingRef = useRef(null)
  const submittingRef = useRef(false)
  const orderPlacedRef = useRef(false)
  const editedFields = useRef(new Set())
  const [directProduct, setDirectProduct] = useState(null)
  const [phoneConfirmation, setPhoneConfirmation] = useState('')
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

  const updateField = (key, value) => {
    editedFields.current.add(key)
    setForm((prev) => ({ ...prev, [key]: value }))
    setStatus((prev) => ({ ...prev, error: '' }))
  }

  const errors = checkoutErrors(form)
  const busy = status.loading || Boolean(status.success) || Boolean(phoneConfirmation)
  const declinePhoneConfirmation = useCallback(() => {
    setPhoneConfirmation('')
    setStepIndex(1)
    window.requestAnimationFrame(() => {
      const target = formRef.current?.elements.namedItem('mobile')
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    })
  }, [])

  useEffect(() => {
    if (!phoneConfirmation) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); declinePhoneConfirmation() }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [phoneConfirmation, declinePhoneConfirmation])
  const changeStep = (next, invalidField) => {
    setStepIndex(next)
    window.requestAnimationFrame(() => {
      const target = invalidField ? formRef.current?.elements.namedItem(invalidField) : headingRef.current
      target?.focus({ preventScroll: true })
      if (invalidField) target?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    })
  }
  const validateStep = (index) => {
    const fields = checkoutStepFields[index]
    setTouched((prev) => ({ ...prev, ...Object.fromEntries(fields.map((field) => [field, true])) }))
    const invalidField = fields.find((field) => errors[field])
    if (invalidField) {
      setStatus({ loading: false, error: 'Check the highlighted fields before continuing.', success: '' })
      changeStep(index, invalidField)
      return false
    }
    return true
  }
  const field = (name, label, { required = true, ...props } = {}) => (
    <div className="checkout-field">
      <label className="label" htmlFor={`checkout-${name}`}>{label}{required && <span className="checkout-required" aria-hidden="true"> *</span>}</label>
      <input className="input" id={`checkout-${name}`} name={name} value={form[name]} required={required} disabled={busy} onChange={(event) => updateField(name, event.target.value)} onBlur={() => setTouched((prev) => ({ ...prev, [name]: true }))} aria-invalid={Boolean(touched[name] && errors[name])} aria-describedby={touched[name] && errors[name] ? `checkout-${name}-error` : undefined} {...props} />
      {touched[name] && errors[name] && <p className="checkout-field-error" id={`checkout-${name}-error`}>{errors[name]}</p>}
    </div>
  )

  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      try {
        const profile = await api.profile()
        if (!active) return
        setForm((prev) => {
          const saved = { ...profile, mobile: profile.phone }
          return Object.fromEntries(Object.entries(prev).map(([key, value]) => [key, editedFields.current.has(key) ? value : saved[key] || value]))
        })
      } catch {
        // ignore, user may not have profile yet
      }
    }
    loadProfile()
    return () => { active = false }
  }, [selectionKey])

  useEffect(() => {
    if (!directPurchase?.productId) return undefined
    let active = true
    api
      .product(directPurchase.productId)
      .then((item) => {
        if (active) setDirectProduct(item)
      })
      .catch(() => {
        if (active) setDirectProduct(null)
      })
    return () => {
      active = false
    }
  }, [directPurchase])

  const confirmOrder = async (confirmedPhone = '') => {
    if (submittingRef.current || orderPlacedRef.current) return
    const invalidStep = firstInvalidCheckoutStep(form)
    if (invalidStep !== -1) {
      validateStep(invalidStep)
      return
    }
    submittingRef.current = true
    const clean = normalizeCheckout(form)
    try {
      setStatus({ loading: true, error: '', success: '' })
      if (confirmedPhone !== clean.mobile) {
        const result = await api.checkDeliveryPhone(clean.mobile)
        if (typeof result?.registeredToAnotherUser !== 'boolean') {
          throw new Error('Unable to check this mobile number. Please try again.')
        }
        if (result.registeredToAnotherUser) {
          setPhoneConfirmation(clean.mobile)
          setStatus({ loading: false, error: '', success: '' })
          return
        }
      }
      // Delivery details belong to this order; checkout never changes account login identifiers.
      const products = await api.products({ fresh: true })
      let cart = null
      let items = []

      if (directPurchase) {
        const product = products.find(
          (entry) => String(entry.id) === String(directPurchase.productId)
        )
        if (!product || product.stock < directPurchase.quantity) {
          setStatus({
            loading: false,
            error: product ? 'Selected quantity exceeds available stock.' : 'Product not found.',
            success: '',
          })
          return
        }
        items = [
          {
            productId: product.id,
            quantity: directPurchase.quantity,
            price: product.price || 0,
            name: product.name || 'Item',
          },
        ]
      } else {
        cart = await api.cart()
        const filtered = cart.items.filter((item) =>
          selectedItems.length ? selectedItems.includes(String(item.productId)) : true
        )
        if (filtered.length === 0) {
          setStatus({ loading: false, error: 'Please pick an item to order.', success: '' })
          return
        }
        if (filtered.some((item) => {
          const product = products.find((entry) => entry.id === item.productId)
          return !product || product.stock < item.quantity
        })) {
          setStatus({ loading: false, error: 'Stock has changed. Review your cart quantities before placing this order.', success: '' })
          return
        }
        items = filtered.map((item) => {
          const product = products.find((entry) => entry.id === item.productId)
          return {
            productId: item.productId,
            quantity: item.quantity,
            price: product?.price || 0,
            name: product?.name || 'Item',
          }
        })
      }
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
        address: [clean.addressLine, clean.barangay, clean.city, clean.province, clean.zip, clean.country].filter(Boolean).join(', '),
        contactName: clean.name,
        phone: clean.mobile,
        email: clean.email,
        paymentMethod: 'COD',
      })
      orderPlacedRef.current = true
      if (directPurchase) {
        localStorage.removeItem(directPurchaseKey)
      } else if (selectedItems.length) {
        const remaining = cart.items.filter(
          (item) => !selectedItems.includes(String(item.productId))
        )
        await api.updateCart(remaining).catch(() => {})
        localStorage.removeItem(selectionKey)
      }
      setStatus({ loading: false, error: '', success: 'Order placed successfully.' })
      await playActionAnimation('checkout', { duration: 650 })
      navigate('/orders')
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <section className="grid checkout-page" style={{ gap: '24px' }}>
      {phoneConfirmation && (
        <Modal className="checkout-phone-backdrop" onClick={declinePhoneConfirmation}>
          <div className="modal-card checkout-phone-modal" role="alertdialog" aria-modal="true" aria-labelledby="checkout-phone-title" aria-describedby="checkout-phone-description" onClick={(event) => event.stopPropagation()}>
            <h2 id="checkout-phone-title">Use this delivery number?</h2>
            <p className="checkout-phone-number">{phoneConfirmation}</p>
            <p id="checkout-phone-description">This number is already registered to another user. Continue using it for this delivery?</p>
            <p className="checkout-phone-help">It will be used only as the contact number for this order.</p>
            <div className="checkout-phone-actions">
              <button className="button secondary" type="button" onClick={declinePhoneConfirmation}>No</button>
              <button className="button" type="button" onClick={() => {
                const phone = phoneConfirmation
                setPhoneConfirmation('')
                void confirmOrder(phone)
              }}>Yes</button>
            </div>
          </div>
        </Modal>
      )}
      <div>
        <h1 className="section-title">Checkout</h1>
        <p className="section-subtitle">Your delivery details, then a final review. Payment is cash on delivery.</p>
      </div>

      <form className="card checkout-card" ref={formRef} noValidate onSubmit={(event) => {
        event.preventDefault()
        if (submittingRef.current || busy || orderPlacedRef.current) return
        if (stepIndex === steps.length - 1) confirmOrder()
        else if (validateStep(stepIndex)) {
          setStatus({ loading: false, error: '', success: '' })
          changeStep(stepIndex + 1)
        }
      }}>
        <ol className="checkout-progress" aria-label="Checkout progress">
          {steps.map((step, index) => <li key={step}><span className={`pill ${index === stepIndex ? 'is-current' : ''} ${index < stepIndex ? 'is-complete' : ''}`} aria-current={index === stepIndex ? 'step' : undefined}>{index + 1}. {step}</span></li>)}
        </ol>

        <div className="checkout-step-content" key={stepIndex} role="group" aria-labelledby="checkout-step-title">
          <h2 id="checkout-step-title" className="section-title checkout-step-title" ref={headingRef} tabIndex={-1}>{['Shipping details', 'Contact details', 'Review your order'][stepIndex]}</h2>
          {stepIndex < 2 && <p className="checkout-field-help">Fields marked * are required.</p>}
          {stepIndex === 0 && <div className="form">
            {field('name', 'Full name', { placeholder: 'Juan Dela Cruz', autoComplete: 'shipping name' })}
            {field('addressLine', 'Street address (optional)', { required: false, placeholder: 'House no., street', autoComplete: 'shipping street-address' })}
            <div className="grid two">
              {field('barangay', 'Barangay', { placeholder: 'Barangay', autoComplete: 'shipping address-line2' })}
              {field('city', 'City / Municipality', { placeholder: 'City / Municipality', autoComplete: 'shipping address-level2' })}
            </div>
            <div className="grid two">
              {field('province', 'Province / State', { placeholder: 'Province', autoComplete: 'shipping address-level1' })}
              {field('zip', 'ZIP code', { placeholder: 'ZIP code', autoComplete: 'shipping postal-code' })}
            </div>
            {field('country', 'Country', { placeholder: 'Country', autoComplete: 'shipping country-name' })}
          </div>}
          {stepIndex === 1 && <div className="form">
            {field('mobile', 'Mobile number', { type: 'tel', inputMode: 'tel', placeholder: '09XX XXX XXXX or +63 9XX XXX XXXX', autoComplete: 'shipping tel' })}
            {field('email', 'Email', { type: 'email', placeholder: 'you@email.com', autoComplete: 'shipping email' })}
            <div className="checkout-field">
              <label className="label" htmlFor="checkout-notes">Delivery notes (optional)</label>
              <textarea className="input" id="checkout-notes" name="notes" rows="3" placeholder="Landmark, gate code, etc." disabled={busy} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
            </div>
          </div>}
          {stepIndex === 2 && <div className="checkout-review">
            <section className="checkout-review-block">
              <h3>Delivery and contact</h3>
              <p>{form.name.trim()}</p>
              <p>{[form.addressLine, form.barangay, form.city, form.province, form.zip, form.country].map((value) => value.trim()).filter(Boolean).join(', ')}</p>
              <p>{form.mobile.trim()}<br />{form.email.trim()}</p>
            </section>
            {directPurchase && <section className="checkout-review-block">
              <h3>{directProduct?.name || 'Selected product'}</h3>
              <p>Quantity: {directPurchase.quantity}</p>
              {directProduct && <p>Subtotal: {'\u20b1'}{(directProduct.price * directPurchase.quantity).toLocaleString('en-PH')}</p>}
            </section>}
            <section className="checkout-review-block">
              <h3>Cash on delivery</h3>
              <p>Pay upon arrival. Check your delivery and contact details before confirming.</p>
            </section>
          </div>}
        </div>

        {status.loading && <div className="checkout-notice" role="status"><span className="checkout-processing" aria-hidden="true" />{'Processing your order\u2026'}</div>}
        {status.error && <div className="checkout-notice is-error" role="alert">{status.error}</div>}
        {status.success && <div className="checkout-notice" role="status">{status.success}</div>}
        <div className="checkout-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={() => {
            if (stepIndex === 0) {
              if (directPurchase) {
                localStorage.removeItem(directPurchaseKey)
                navigate(`/product/${directPurchase.productId}`)
              } else navigate('/cart')
            } else {
              setStatus({ loading: false, error: '', success: '' })
              changeStep(stepIndex - 1)
            }
          }}>Back</button>
          <button className="button" type="submit" disabled={busy}>{status.loading ? 'Placing order\u2026' : stepIndex === steps.length - 1 ? 'Confirm Order' : 'Next'}</button>
        </div>
      </form>
    </section>
  )
}

export default Checkout
