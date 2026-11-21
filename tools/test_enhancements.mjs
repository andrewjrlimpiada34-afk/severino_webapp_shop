import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

// Browser fixtures render the production components with synthetic customer data.
// Database invariants are tested separately by the PostgreSQL integration suites.
const fixture = String.raw`
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import App from './src/App.jsx'
import { ActionAnimationProvider } from './src/context/ActionAnimationContext.jsx'
import { api } from './src/lib/api.js'
const profile = { id: 'demo-customer', name: 'Alex Cruz', email: 'alex@example.test', phone: '+639171234567', verified: true, role: 'customer', preferredTheme: 'Default', hasPassword: true }
const products = [{ id: 'demo-fragrance', name: 'Cucumber Melon', description: 'A fresh green fragrance with melon, soft florals, and clean musk.', notes: 'Melon, soft florals, clean musk', price: 300, stock: 5, physicalStock: 8, reservedStock: 3, availableStock: 5, size: '100 mL', category: 'Unisex', active: true, imageUrl: '/images/severino-editorial.webp' }]
products.push({...products[0],id:'demo-weekend',name:'Burberry Weekend',description:'A soft floral fragrance with mandarin and warm woods.',notes:'Mandarin, white florals, warm woods',stock:4,physicalStock:4,reservedStock:0,availableStock:4})
const home = { id: 'home-address', label: 'Home', name: profile.name, phone: profile.phone, addressLine: '14 Sample Street', barangay: 'Agot', city: 'Boac', province: 'Marinduque', zip: '4900', country: 'Philippines', isDefault: true }
const work = { ...home, id: 'work-address', label: 'Work', addressLine: '8 Market Road', isDefault: false }
const order = { id: 'internal-order-primary', reference: 'SV-BA72C590A104E68C247D', contactName: profile.name, phone: profile.phone, email: profile.email, address: '14 Sample Street, Agot, Boac, Marinduque, 4900, Philippines', addressSnapshot: { notes: 'Please call on arrival.' }, status: 'Pending COD', paymentStatus: 'Unpaid', grossCollected: 0, refundedTotal: 0, total: 900, createdAt: new Date().toISOString(), paymentMethod: 'COD', items: [{ itemId: 'first-item', productId: 'demo-fragrance', name: 'Cucumber Melon', quantity: 2, price: 300, trackingStatus: 'Pending COD', trackingEvents: [{ status: 'Pending COD', at: new Date().toISOString() }] }, { itemId: 'second-item', productId: 'demo-weekend', name: 'Burberry Weekend', quantity: 1, price: 300, trackingStatus: 'Pending COD', trackingEvents: [] }] }
let addresses = [home, work]
let currentOrder = structuredClone(order)
const deliveredOrder = { ...order, id: 'older-purchase', reference: 'SV-D34068012F258B16287C', createdAt: '2026-11-01T08:00:00Z', status: 'Completed', paymentStatus: 'Paid', total: 300, items: [{ ...order.items[1], trackingStatus: 'To Review' }] }
let cart = { items: [{ productId: 'demo-fragrance', quantity: 3 }] }
const calls = { cart: [], payments: [], registration: [], google: [], speech: [], checkout: [] }
window.EventSource = class { addEventListener() {} close() {} }
window.qaAuth = { user: profile, loading: false, logout: async () => {}, updateUser: () => {}, refresh: async () => profile, sendRegisterOtp: async () => ({ challengeId: 'demo-verified-challenge' }), verifyRegisterOtp: async () => ({}), register: async (data) => { calls.registration.push(data) } }
Object.assign(api, {
  products: async () => structuredClone(products), product: async (id) => structuredClone(products.find(product=>product.id===id) || products[0]), productReviews: async () => [],
  banners: async () => [], bannerStories: async () => [], heroImage: async () => ({ image: '' }), featuredBanners: async () => [], loginPopup: async () => ({ image: '' }), loginAnnouncement: async () => [],
  profile: async () => ({ ...home, ...profile }),
  addresses: async () => structuredClone(addresses).sort((a,b) => Number(b.isDefault)-Number(a.isDefault)),
  saveAddress: async (data, id) => { const saved = { ...data, id: id || 'new-address' }; addresses = addresses.filter(item => item.id !== id).map(item => ({ ...item, isDefault: saved.isDefault ? false : item.isDefault })); addresses.push(saved); return saved },
  deleteAddress: async (id) => { addresses = addresses.filter(item => item.id !== id); if (addresses.length && !addresses.some(item => item.isDefault)) addresses[0].isDefault = true; return { success: true } },
  cart: async () => structuredClone(cart), updateCart: async (items) => { calls.cart.push(items); cart = { items }; return cart },
  orders: async () => [structuredClone(currentOrder)],
  checkDeliveryPhone: async () => ({ registeredToAnotherUser: false }),
  createOrder: async (data) => { calls.checkout.push(data); if(window.loseCheckoutResponse){ window.loseCheckoutResponse=false; throw new Error('Connection interrupted while confirming the order.') } return { ...currentOrder, id: currentOrder.reference } },
  googleOnboarding: async () => ({ name: profile.name, email: profile.email, needsLinkLogin: false }), completeGoogle: async (data) => { calls.google.push(data); return profile },
  recordPayment: async (id, data) => { calls.payments.push(data); if (window.holdPayment) await new Promise(resolve => { window.finishPayment = resolve }); currentOrder = { ...currentOrder, paymentStatus: data.kind === 'refund' ? 'Partially Refunded' : data.status, grossCollected: data.kind === 'collection' ? data.amount : currentOrder.grossCollected, refundedTotal: data.kind === 'refund' ? currentOrder.refundedTotal + data.amount : 0 }; return structuredClone(currentOrder) },
  paymentHistory: async () => [{ id: 'demo-payment', kind: 'collection', status: 'Paid', amount: 900, method: 'COD', reference: 'COD-RECEIPT-021', verifiedBy: 'Store administrator', verifiedAt: new Date().toISOString() }],
  adminInventory: async () => products.map(item => ({ ...item, stock: item.physicalStock })),
  inventoryLogs: async () => [{ id: 'demo-log', created_at: new Date().toISOString(), product_name: 'Cucumber Melon', action: 'reserve', stock_delta: 0, reserved_delta: 3, stock_after: 8, reserved_after: 3, actor_name: 'Alex Cruz' }],
  salesHistory: async () => [{ id: 'collection-1', orderId: order.id, reference: order.reference, kind: 'collection', paymentVerified: true, total: 900, createdAt: new Date().toISOString(), contactName: profile.name, status: 'To Review', items: order.items }, { id: 'refund-1', orderId: order.id, reference: order.reference, kind: 'refund', paymentVerified: true, total: -150, createdAt: new Date().toISOString(), contactName: profile.name, status: 'To Review', items: order.items }],
  faqs: async () => [{ id: 'speech-faq-1', question: 'How can I track my order?', answer: 'Open Order Tracking to see all products in your order and its delivery progress.' }, { id: 'speech-faq-2', question: 'When is my payment confirmed?', answer: 'An administrator confirms a COD payment after collection is verified.' }]
})
const root = createRoot(document.getElementById('fixture'))
const settle = () => new Promise(resolve => setTimeout(resolve, 30))
const assert = (value, message) => { if (!value) throw new Error(message) }
const waitFor = async (predicate) => { const until = Date.now() + 7000; while (!predicate()) { if (Date.now() > until) throw new Error('Timed out waiting for UI'); await settle() } }
const click = async (element) => { assert(element, 'Control exists'); flushSync(() => element.click()); await settle() }
const button = (text, within = document) => Array.from(within.querySelectorAll('button')).find(element => element.textContent.trim() === text)
const input = async (id, value) => { const element = document.getElementById(id); assert(element, 'Field exists ' + id); const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); flushSync(() => element.dispatchEvent(new Event('input', { bubbles: true }))); await settle() }
let renderCount = 0
const ready = { '/cart':'.cart-page table', '/create-account': '.create-account-form', '/google-onboarding': '.google-onboarding form', '/shop': '.store-product:not(.store-product-skeleton)', '/account': '.address-option', '/checkout': '.address-option input:checked', '/orders': '.order-card', '/admin/orders': '.order-card', '/admin/products': '.inventory-log', '/admin/sales': '.sales-summary-card', '/product/demo-fragrance': '.product-detail-page .speech-controls', '/faqs': '.faq-item' }
const render = async (route) => {
  window.qaAuth.user = ['/create-account','/google-onboarding'].includes(route) ? null : { ...profile, role: route.startsWith('/admin') ? 'admin' : 'customer' }
  sessionStorage.setItem('admin_session','demo-session')
  flushSync(() => root.render(<MemoryRouter key={++renderCount} initialEntries={[route]}><ActionAnimationProvider><App /></ActionAnimationProvider></MemoryRouter>))
  await waitFor(() => document.querySelector(ready[route]))
  await document.fonts.ready
  window.scrollTo(0,0)
  await settle()
}
const fits = () => { assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Page fits viewport'); for (const element of document.querySelectorAll('.order-card,.address-option,.google-onboarding,.speech-controls')) { const box = element.getBoundingClientRect(); assert(box.left >= -1 && box.right <= innerWidth+1, 'Content fits viewport ' + element.className) } }
const selectPlace = async (prefix, values) => {
  for (const [field, value] of Object.entries(values)) {
    const select = document.getElementById(prefix + '-' + field)
    await waitFor(() => [...select.options].some(option => option.value === value))
    select.value = value
    flushSync(() => select.dispatchEvent(new Event('change', { bubbles: true })))
  }
}
const demoLocality = { province: 'Marinduque', city: 'Boac', barangay: 'Agot' }
const fillRegistration = async () => {
  await render('/create-account')
  for (const [field,value] of Object.entries({ firstName:'Alex',lastName:'Cruz',email:'alex@example.test',mobile:'09171234567' })) await input('create-'+field,value)
  await click(button('Continue')); await click(button('Send OTP'))
  for (const element of document.querySelectorAll('.create-otp-input')) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,'1'); flushSync(() => element.dispatchEvent(new Event('input',{bubbles:true}))) }
  await click(button('Verify OTP')); await new Promise(resolve => setTimeout(resolve,1200)); await click(button('Continue'))
  await input('create-password','Demo-password-1!'); await input('create-confirmPassword','Demo-password-1!'); await click(button('Continue'))
  await selectPlace('create', demoLocality)
  await input('create-zip','4900')
  await click(button('Continue'))
}
const openPayment = async () => { currentOrder = structuredClone(order); await render('/admin/orders'); await click(button('Verify payment')) }
const preparePayment = async () => { await input('payment-reference','COD-RECEIPT-021'); await input('payment-reason','Cash collection verified against the courier receipt.'); await click(document.querySelector('.payment-dialog input[type=checkbox]')) }
const preview = new URLSearchParams(location.search).get('preview')
const results = []
const run = async (name, execute) => { try { await execute(); fits(); results.push({ name, passed: true }) } catch (error) { results.push({ name, passed:false, error:error.message, stack:error.stack }) } }
if (preview) {
  addresses = [home,work]
  if (preview === 'registration') await render('/create-account')
  if (preview === 'registration-terms') await fillRegistration()
  if (preview === 'google-onboarding') await render('/google-onboarding')
  if (preview === 'shop') await render('/shop')
  if (preview === 'product-detail') await render('/product/demo-fragrance')
  if (preview === 'quantity') { await render('/shop'); await click(document.querySelector('.store-add-button')); await waitFor(() => !document.querySelector('.quantity-stepper input').disabled); await click(document.querySelector('[aria-label="Increase quantity"]')) }
  if (preview === 'saved-addresses') { await render('/account'); document.querySelector('.address-book').scrollIntoView({block:'start'}) }
  if (preview === 'address-editor') {
    await render('/account'); await click(button('Add New Address'))
    await input('saved-name', profile.name); await input('saved-phone', profile.phone)
    await selectPlace('saved', demoLocality); await input('saved-zip', '4900')
  }
  if (preview === 'checkout-saved') await render('/checkout')
  if (preview === 'checkout-review') { await render('/checkout'); await click(button('Next')); document.querySelector('.checkout-card').scrollIntoView({block:'start'}) }
  if (preview === 'order-tracking') {
    api.orders = async () => [order, deliveredOrder]
    await render('/orders')
  }
  if (preview === 'admin-orders') { await render('/admin/orders'); await click(document.querySelector('.address-groups summary')) }
  if (preview === 'accessibility') { await render('/product/demo-fragrance'); await click(document.querySelector('.access-launcher')) }
  if (preview === 'payment-confirmation') { await openPayment(); await preparePayment() }
  if (preview === 'payment-review') { await openPayment(); await preparePayment(); await click(button('Review payment action')); document.querySelector('.payment-dialog').scrollTop=document.querySelector('.payment-dialog').scrollHeight }
  if (preview === 'inventory') {
    await render('/admin/products')
    const log = document.querySelector('.inventory-log')
    await click(log.querySelector('summary'))
    log.scrollIntoView({ block: 'start' })
  }
  if (preview === 'sales') await render('/admin/sales')
  fits()
} else {
  await run('Registration requires explicit consent and Google onboarding provides password-free account creation', async () => {
    await fillRegistration()
    assert(!document.querySelector('a[href*="/api/auth/google"]'), 'Email signup has no duplicate Google action')
    assert(button('Create Account').disabled, 'Registration stays blocked before acceptance')
    assert(!document.querySelector('.registration-acceptance input').checked, 'Consent starts unchecked')
    await click(document.querySelector('.registration-acceptance input'))
    assert(!button('Create Account').disabled, 'Acceptance enables completed registration')
    await render('/google-onboarding')
    assert(!document.querySelector('input[type=password]') && button('Complete account').disabled, 'New Google accounts require consent without a password field')
  })
  await run('Quantity controls include existing cart quantities and disable the increment at available stock', async () => {
    cart = { items: [{ productId:'demo-fragrance',quantity:3 }] }
    await render('/shop'); await click(document.querySelector('.store-add-button'))
    await waitFor(() => !document.querySelector('.quantity-stepper input').disabled)
    assert(document.querySelector('[aria-label="Decrease quantity"]').disabled, 'Minimum quantity is one')
    await click(document.querySelector('[aria-label="Increase quantity"]'))
    assert(document.querySelector('[aria-label="Increase quantity"]').disabled, 'Maximum includes three units already in the cart')
    await click(button('Add to Cart',document.querySelector('.store-cart-modal')))
    assert(calls.cart.at(-1)[0].quantity === 5, 'Cart receives the maximum permitted total')
    assert(document.querySelector('.store-notice[role=status]').textContent.includes('added'), 'Successful addition is announced')
  })
  await run('Older cart entries with insufficient stock or removed products can be repaired together', async () => {
    cart={items:[{productId:'demo-fragrance',quantity:9},{productId:'removed-product',quantity:1}]}
    await render('/cart')
    assert(document.querySelector('.cart-page').textContent.includes('Unavailable product'),'Removed products remain removable without crashing the cart')
    await click(button('Update cart availability'))
    assert(cart.items.length===1 && cart.items[0].quantity===5,'One action removes unavailable entries and applies current limits')
  })
  await run('Saved addresses persist, support editing, and preselect the checkout default without showing its form', async () => {
    await render('/account'); await click(button('Edit address'))
    await waitFor(() => document.getElementById('saved-barangay').value === 'Agot')
    await selectPlace('saved', { province: 'Cebu' })
    assert(!document.getElementById('saved-city').value, 'Changing province clears the city')
    assert(!document.getElementById('saved-barangay').value, 'Changing province clears the barangay')
    assert(button('Save address').disabled, 'The cleared address cannot be submitted')
    await selectPlace('saved', demoLocality)
    await waitFor(() => !button('Save address').disabled)
    await input('saved-addressLine','22 Updated Street'); await click(button('Save address'))
    await waitFor(() => !document.querySelector('.address-editor'))
    assert(addresses.some(item => item.addressLine === '22 Updated Street'), 'Edited address is persisted')
    await render('/checkout')
    assert(document.querySelector('.address-option input:checked') && !document.getElementById('checkout-city'), 'Saved default is selected and its full form stays closed')
    await click(Array.from(document.querySelectorAll('.address-option input'))[1])
    assert(!document.getElementById('checkout-mobile'), 'Selecting a saved address reuses its mobile number')
    await click(button('Next'))
    const delivery = document.querySelector('.checkout-review-block').textContent
    assert(delivery.includes('8 Market Road') && delivery.includes(work.phone), 'Review uses the selected address and its phone')
  })
  await run('Uncertain checkout responses recover the original request after a reload and changed stock', async () => {
    cart = { items: [{ productId:'demo-fragrance', quantity:1 }] }
    await render('/checkout'); await click(button('Next'))
    window.loseCheckoutResponse=true
    await click(button('Confirm Order'))
    await waitFor(() => button('Retry previous order confirmation'))
    const original=calls.checkout.at(-1)
    products[0].stock=0
    await render('/checkout')
    await click(button('Retry previous order confirmation'))
    await waitFor(() => document.querySelector('.order-history'))
    assert(JSON.stringify(calls.checkout.at(-1))===JSON.stringify(original),'Recovery reuses the original payload and idempotency key')
    assert(!sessionStorage.getItem('severino_checkout_attempt_'+profile.id),'A confirmed result clears the pending request')
    products[0].stock=5
  })
  await run('One checkout appears as one order containing named products and independent payment status', async () => {
    await render('/orders')
    assert(document.querySelectorAll('.order-card').length === 1, 'One order is shown')
    const items = [...document.querySelectorAll('.order-item')]
    assert(items.length === 2 && items.every(item => item.getBoundingClientRect().height > 0) && items[0].textContent.includes('Cucumber Melon'), 'Both purchased products are visible before expanding tracking')
    await click(button('Delivered'))
    assert(!document.querySelector('.order-card') && button('Show all orders'), 'An unmatched status shows the filtered empty state')
    await click(button('Show all orders'))
    await input('order-search', 'MELON')
    assert(document.querySelector('.order-card'), 'Search matches product names regardless of case')
    await input('order-search', 'unrelated')
    assert(!document.querySelector('.order-card'), 'Search excludes unrelated purchases')
    await input('order-search', 'BA72C590')
    assert(document.querySelector('.order-card'), 'Search matches part of the order reference')
    assert(!document.body.textContent.includes('internal-order-primary'), 'Internal order identifier is absent from the page')
    await click(document.querySelector('.order-details > summary'))
    assert(document.querySelectorAll('.order-item').length === 2, 'Expanding the order displays both products')
    assert(document.querySelector('.purchase-total').textContent.includes('Unpaid'), 'Payment status is visible')
    assert(document.querySelector('.order-timeline [aria-current="step"]').textContent.includes('Awaiting approval'), 'The timeline identifies the current fulfillment stage')
    assert([...document.querySelectorAll('.order-timeline-label')].filter(label => label.textContent === 'Upcoming').length === 4, 'Future stages are clearly identified as upcoming')
    currentOrder = structuredClone(deliveredOrder)
    await render('/orders')
    await click(button('Delivered'))
    assert(document.querySelector('.purchase-heading .status-badge').textContent === 'Delivered', 'Completed orders use the delivered filter')
    assert(document.querySelector('.purchase-item-actions a').getAttribute('href') === '/product/demo-weekend', 'Reviews open the purchased product')
    await click(button('Buy again'))
    await waitFor(() => document.querySelector('.checkout-card'))
    assert(JSON.parse(localStorage.getItem('severino_direct_checkout_'+profile.id)).productId === 'demo-weekend', 'Buy again checks out the selected item')
    localStorage.removeItem('severino_direct_checkout_'+profile.id)
    currentOrder = structuredClone(order)
  })
  await run('Administrator payment verification requires review and a final confirmation and prevents repeated submission', async () => {
    await openPayment(); await preparePayment()
    await click(button('Review payment action'))
    assert(calls.payments.length === 0 && document.querySelector('.payment-review'), 'Review sends no payment action')
    window.holdPayment = true
    await click(button('Confirm payment action'))
    await waitFor(() => window.finishPayment)
    const pendingButton = button('Saving…',document.querySelector('.payment-dialog'))
    assert(pendingButton.disabled, 'Pending payment submission is disabled')
    await click(pendingButton)
    assert(calls.payments.length === 1, 'One confirmation is submitted')
    window.holdPayment = false; window.finishPayment()
    await waitFor(() => !document.querySelector('.payment-dialog'))
    assert(document.querySelector('.order-statuses').textContent.includes('Paid'), 'Verified payment appears on its order')
  })
  await run('Inventory shows physical, reserved, and available stock and payment reports distinguish gross, refunds, and net', async () => {
    await render('/admin/products')
    assert(document.querySelector('table').textContent.includes('Reserved') && document.querySelector('.inventory-log'), 'Inventory balances and audit history are available')
    await click(document.querySelector('.inventory-log > summary'))
    const log = document.querySelector('.inventory-log')
    assert(log.getBoundingClientRect().right <= innerWidth + 1 && log.scrollWidth <= log.clientWidth + 1, 'The expanded inventory log fits its page')
    if (innerWidth <= 720) {
      const cells = [...log.querySelectorAll('tbody tr:first-child td')]
      assert(cells.length === 8 && cells.every(cell => cell.getBoundingClientRect().right <= innerWidth && cell.querySelector('.inventory-field-label').getClientRects().length), 'Every transaction value has a visible label and fits on mobile')
    }
    await render('/admin/sales')
    assert(document.querySelector('.sales-metrics').textContent.includes('Gross collected') && document.querySelector('.sales-metrics').textContent.includes('Verified refunds'), 'Sales metrics use verified collections and refunds')
  })
  await run('Expanded orders, their address groups and product actions fit the viewport', async () => {
    await render('/admin/orders')
    await click(document.querySelector('.address-groups summary'))
    await click(document.querySelector('.order-details summary'))
    fits()
    const list=document.querySelector(innerWidth<=720 ? '.address-group-list' : '.address-groups table')
    assert(list.getClientRects().length && list.textContent.includes('Boac'), 'Active address groups remain readable')
    for (const el of document.querySelectorAll('.admin-orders details[open], .order-card, .order-admin-actions button')) {
      const rect=el.getBoundingClientRect()
      assert(rect.right<=innerWidth+1 && rect.left>=0 && el.scrollWidth<=el.clientWidth+2, 'Expanded control fits '+el.className)
    }
    await render('/product/demo-fragrance')
    const add=document.querySelector('.product-detail-actions__add')
    const label=add.querySelector('span')
    assert(label.getBoundingClientRect().height < 32 && label.getBoundingClientRect().width > 50, 'Add to Cart label fits on one line')
  })
  await run('Accessibility settings persist, reset and restore keyboard focus', async () => {
    await render('/product/demo-fragrance')
    const trigger=document.querySelector('.access-launcher'); trigger.focus(); await click(trigger)
    const panel=document.querySelector('.access-panel')
    for (const label of ['Keyboard focus','Larger text','Underline links','High contrast','Reduce motion']) await click(button(label,panel))
    assert(document.documentElement.hasAttribute('data-access-focus') && document.documentElement.hasAttribute('data-access-large'), 'Preferences take effect')
    assert(panel.getBoundingClientRect().right<=innerWidth+1 && panel.scrollWidth<=panel.clientWidth+1, 'Settings fit the viewport')
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await settle()
    assert(document.activeElement===trigger, 'Closing settings restores launcher focus')
    await render('/shop'); await click(document.querySelector('.access-launcher'))
    assert(button('High contrast').getAttribute('aria-pressed')==='true','Preferences survive remount')
    await click(button('Reset settings'))
    assert(!document.documentElement.hasAttribute('data-access-contrast'), 'Reset restores store display')
    await click(document.querySelector('.access-close'))
  })
  await run('Read-aloud controls pause, replay, stop overlapping content, and handle unsupported browsers', async () => {
    const synthesis = { speak: utterance => calls.speech.push(utterance), cancel: () => calls.speech.push('stop'), pause: () => calls.speech.push('pause'), resume: () => calls.speech.push('resume') }
    Object.defineProperty(window,'speechSynthesis',{ configurable:true,value:synthesis })
    Object.defineProperty(window,'SpeechSynthesisUtterance',{ configurable:true,value:class { constructor(text) { this.text=text } } })
    await render('/faqs')
    document.querySelectorAll('.faq-item').forEach(element => { element.open=true })
    const controls = document.querySelectorAll('.speech-controls')
    await click(button('Play',controls[0])); await click(button('Pause',controls[0])); await click(button('Resume',controls[0])); await click(button('Play',controls[1]))
    assert(controls[0].textContent.includes('Play') && controls[1].textContent.includes('Reading aloud'), 'Starting another section stops the first')
    await click(button('Replay',controls[1])); await click(button('Stop',controls[1]))
    assert(calls.speech.includes('pause') && calls.speech.includes('resume'), 'Pause and resume reach the speech API')
    Object.defineProperty(window,'SpeechSynthesisUtterance',{ configurable:true,value:undefined })
    await render('/faqs')
    assert(document.querySelector('.speech-fallback'), 'Unsupported browsers receive readable feedback')
  })
  const report=document.createElement('pre'); report.id='qa-results'; report.textContent=JSON.stringify({width:innerWidth,results}); document.body.append(report)
}
window.qaReady=true
`;

const artifactDir = path.resolve("tmp/enhancement-qa");
await mkdir(artifactDir, { recursive: true });
const profileDir = await mkdtemp(path.join(artifactDir, "edge-"));
const bundled = await build({
  stdin: {
    contents: fixture,
    resolveDir: process.cwd(),
    sourcefile: "enhancement-qa.jsx",
    loader: "jsx",
  },
  loader: { ".css": "empty" },
  bundle: true,
  write: false,
  format: "esm",
  jsx: "automatic",
  define: { "import.meta.env": "{}" },
  plugins: [
    {
      name: "fixture-auth",
      setup(builder) {
        builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({
          contents: "export const useAuth = () => window.qaAuth",
          loader: "js",
        }));
      },
    },
  ],
});
const styles = (
  await Promise.all(
    [
      "src/index.css",
      "src/admin.css",
      "src/customer-desktop.css",
      "src/storefront.css",
      "src/enhancements.css",
      "src/accessibility-layout.css",
      "src/sales-report.css",
    ].map((file) => readFile(file, "utf8")),
  )
)
  .join("\n")
  .replace(/^@import[^\r\n]*[\r\n]*/gm, "");
const server = createServer(async (request, response) => {
  if (request.url === "/bundle.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(bundled.outputFiles[0].text);
    return;
  }
  if (
    request.url === "/logo.svg" ||
    request.url === "/images/severino-editorial.webp" ||
    /^\/fonts\/[a-z-]+\.woff2$/.test(request.url)
  ) {
    response.setHeader(
      "Content-Type",
      request.url.endsWith("webp")
        ? "image/webp"
        : request.url.endsWith("woff2")
          ? "font/woff2"
          : "image/svg+xml",
    );
    response.end(await readFile("public" + request.url));
    return;
  }
  response.setHeader("Content-Type", "text/html");
  response.end(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
      styles +
      '</style></head><body><div id="fixture"></div><script type="module" src="/bundle.js"></script></body></html>',
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const previews = [
  "registration",
  "registration-terms",
  "google-onboarding",
  "shop",
  "product-detail",
  "quantity",
  "saved-addresses",
  "address-editor",
  "checkout-saved",
  "checkout-review",
  "order-tracking",
  "admin-orders",
  "accessibility",
  "payment-confirmation",
  "payment-review",
  "inventory",
  "sales",
];
async function checkWidth(width) {
  const userDirectory = path.join(profileDir, String(width));
  const browserProcess = spawn(
    process.env.EDGE_PATH ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      `--user-data-dir=${userDirectory}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let socket;
  const timeout = setTimeout(() => browserProcess.kill(), 150000);
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        port = Number(
          (
            await readFile(
              path.join(userDirectory, "DevToolsActivePort"),
              "utf8",
            )
          ).split("\n")[0],
        );
        break;
      } catch {
        await new Promise((done) => setTimeout(done, 100));
      }
    }
    if (!port) throw new Error("Headless browser did not start");
    const pages = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    socket = new WebSocket(
      pages.find((page) => page.type === "page").webSocketDebuggerUrl,
    );
    await new Promise((done, fail) => {
      socket.addEventListener("open", done, { once: true });
      socket.addEventListener("error", fail, { once: true });
    });
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown")
        errors.push(
          message.params.exceptionDetails.exception?.description ||
            message.params.exceptionDetails.text,
        );
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
      }
    });
    const call = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    await call("Runtime.enable");
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: width <= 640,
    });
    await call("Emulation.setFocusEmulationEnabled", { enabled: true });
    const navigate = async (url) => {
      await call("Page.navigate", { url });
      const result = await call("Runtime.evaluate", {
        expression:
          'new Promise((resolve,reject)=>{const until=Date.now()+35000; const check=()=>window.qaReady?resolve(true):Date.now()>until?reject(new Error("Fixture timed out")):setTimeout(check,50); check()})',
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ||
            "Browser fixture failed",
        );
    };
    if (!process.argv.includes("--previews-only")) {
      await navigate(base);
      const report = JSON.parse(
        (
          await call("Runtime.evaluate", {
            expression: 'document.getElementById("qa-results").textContent',
            returnByValue: true,
          })
        ).result.value,
      );
      console.log(JSON.stringify(report));
      await writeFile(
        path.join(artifactDir, `results-${width}.json`),
        JSON.stringify({ ...report, errors }, null, 2),
      );
      if (errors.length || report.results.some((result) => !result.passed))
        process.exitCode = 1;
    }
    for (const preview of previews) {
      await navigate(`${base}/?preview=${preview}`);
      await call("Runtime.evaluate", {
        expression:
          'Promise.all(Array.from(document.images, image => { image.loading="eager"; return image.decode().catch(()=>{}) }))',
        awaitPromise: true,
      });
      await call("Runtime.evaluate", {
        expression:
          "Promise.all(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))",
        awaitPromise: true,
      });
      const screenshot = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(
        path.join(artifactDir, `${width}-${preview}.png`),
        Buffer.from(screenshot.data, "base64"),
      );
    }
    await call("Browser.close");
  } finally {
    clearTimeout(timeout);
    socket?.close();
    if (browserProcess.exitCode === null) browserProcess.kill();
  }
}
const requested = process.argv
  .find((argument) => argument.startsWith("--width="))
  ?.slice(8);
const widths = requested ? [Number(requested)] : [1440, 768, 390, 320];
if (widths.some((width) => !Number.isInteger(width) || width < 280))
  throw new Error("Use a viewport width of at least 280px.");
try {
  for (const width of widths) await checkWidth(width);
  console.log(`Enhancement screenshots and results saved to ${artifactDir}`);
} finally {
  server.closeAllConnections();
  server.close();
}
