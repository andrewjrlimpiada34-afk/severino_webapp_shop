import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

// Isolated frontend QA: all account, inventory and catalog requests use test doubles.
// No real accounts, orders, database writes or third-party embeds are used.
const fixture = String.raw`
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Home from './src/pages/Home.jsx'
import Shop from './src/pages/Shop.jsx'
import Login from './src/pages/Login.jsx'
import Account from './src/pages/Account.jsx'
import Checkout from './src/pages/Checkout.jsx'
import OrderHistory from './src/pages/OrderHistory.jsx'
import NavBar from './src/components/NavBar.jsx'
import Footer from './src/components/Footer.jsx'
import Notifications from './src/pages/Notifications.jsx'
import WelcomeOfferModal from './src/components/WelcomeOfferModal.jsx'
import ShopSearchRedirect from './src/components/ShopSearchRedirect.jsx'
import { applyFontPreference, readFontPreference } from './src/lib/fontPreference.js'
import { ActionAnimationProvider } from './src/context/ActionAnimationContext.jsx'
import { api } from './src/lib/api.js'

const imageUrl = '/images/severino-editorial.webp'
const products = [
  { id: 'cucumber-melon', name: 'Cucumber Melon', notes: 'Cool green, melon rind, clean musk', size: '100 mL', price: 1690, category: 'Unisex', stock: 6, imageUrl },
  { id: 'cloudy-scent', name: 'Cloudy Scent', notes: 'Misty citrus, white tea, soft woods', size: '80 mL', price: 1490, category: 'Women', stock: 0, imageUrl },
  { id: 'bacc540', name: 'Bacc540', notes: 'Amber resin, saffron, cedar', size: '70 mL', price: 2990, category: 'Men', stock: 10, imageUrl },
  { id: 'weekend', name: 'Burberry Weekend Eau de Parfum', notes: 'Peach, nectarine blossom, honeyed musk with a particularly long scent description', size: '90 mL', price: 2490, category: 'Unisex', stock: 4, imageUrl },
]
const profile = { id: 'storefront-fixture-user', name: 'Alex Cruz', email: 'alex@example.test', phone: '+639171234567', addressLine: 'Example Street', backupAddress: 'Example backup address', barangay: 'Poblacion', city: 'Boac', province: 'Marinduque', zip: '4900', country: 'Philippines', profileImage: '', hasPassword: true, preferredTheme: 'Default' }
const calls = { login: [], cart: [], profile: [], theme: [], password: [], orders: [], cancellations: [], phones: [] }
window.qaAuth = { user: profile, logout: async () => {}, updateUser: () => {}, startLogin: async (...args) => { calls.login.push(args); return { role: 'customer' } } }
window.EventSource = class { addEventListener() {} close() {} }
Object.assign(api, {
  products: async () => { if (window.failCatalog) throw new Error('Collection temporarily unavailable'); return products },
  orders: async () => window.qaOrders || [], profile: async () => window.qaProfile || profile,
  product: async (id) => products.find(item => item.id === id),
  checkDeliveryPhone: async (phone) => {
    calls.phones.push(phone)
    if (window.failPhoneCheck) throw new Error('Unable to check this mobile number. Please try again.')
    return { registeredToAnotherUser: Boolean(window.registeredDeliveryPhone) }
  },
  createOrder: async (data) => { calls.orders.push(data); if (window.holdOrder) await new Promise(resolve => { window.finishOrder = resolve }); return { ...data, id: 'new-fixture-order' } },
  cancelOrderItem: async (orderId, itemKey) => {
    calls.cancellations.push({ orderId, itemKey })
    if (window.failCancellation) throw new Error('Cancellation is temporarily unavailable. Please try again.')
    if (window.holdCancellation) await new Promise(resolve => { window.finishCancellation = resolve })
    const order = window.qaOrders.find(item => item.id === orderId)
    return { ...order, items: order.items.map((item, index) => (item.itemId || index + '-' + item.productId) === itemKey ? { ...item, trackingStatus: 'Cancelled' } : item) }
  },
  updateProfile: async (data) => { calls.profile.push(data); if (window.rejectProfileWrite) throw new Error('This mobile number is already registered to another user.'); return { ...profile, ...data } },
  updateTheme: async (theme) => { calls.theme.push(theme) },
  updatePassword: async (data) => { calls.password.push(data) },
  cart: async () => window.qaCart || { items: [] }, updateCart: async (items) => { calls.cart.push(items) },
  banners: async () => [], bannerStories: async () => [], heroImage: async () => ({ image: '' }), featuredBanners: async () => [],
  loginAnnouncement: async () => [],
})
let renderNumber = 0
const root = createRoot(document.getElementById('fixture'))
function OfferPreview() {
  const [open, setOpen] = useState(true)
  return <><Home />{open && <WelcomeOfferModal image={window.qaOfferImage || '/qa-portrait.svg'} onClose={() => setOpen(false)} />}</>
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20))
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const waitFor = async (predicate) => {
  const deadline = Date.now() + 6000
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out waiting for UI'); await settle() }
}
const click = async (element) => { assert(element, 'Control exists'); flushSync(() => element.click()); await settle() }
const input = async (id, value) => {
  const element = document.getElementById(id)
  assert(element, 'Field exists: ' + id)
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value)
  flushSync(() => element.dispatchEvent(new Event('input', { bubbles: true })))
  await settle()
}
const select = async (id, value) => {
  const element = document.getElementById(id)
  element.value = value
  flushSync(() => element.dispatchEvent(new Event('change', { bubbles: true })))
  await settle()
}
const button = text => Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === text)
const cardNames = () => Array.from(document.querySelectorAll('.store-product-info h3')).map(item => item.textContent)
const noOverflow = () => {
  assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Document fits viewport')
  for (const element of document.querySelectorAll('.store-catalog, .store-shop-toolbar, .store-account-identity, .store-account-fields, .store-login-panel, .store-home-hero, .store-product, .store-product-actions')) {
    const rect = element.getBoundingClientRect()
    assert(rect.left >= -1 && rect.right <= innerWidth + 1, 'Visible content fits viewport: ' + element.className)
    assert(element.scrollWidth <= element.clientWidth + 2, 'Content does not overflow internally: ' + element.className)
  }
}
const render = async (page, route = page === 'home' ? '/' : '/' + page) => {
  window.qaAuth.user = page === 'login' ? null : profile
  flushSync(() => root.render(<React.StrictMode><MemoryRouter key={++renderNumber} initialEntries={[route]}><ActionAnimationProvider><div className="app-shell storefront-shell"><NavBar /><main className="page"><Routes><Route path="/" element={<Home />} /><Route path="/shop" element={<Shop />} /><Route path="/search" element={<ShopSearchRedirect />} /><Route path="/login" element={<Login />} /><Route path="/account" element={<Account />} /><Route path="/checkout" element={<Checkout />} /><Route path="/orders" element={<OrderHistory />} /><Route path="/notifications" element={<Notifications />} /><Route path="/popup" element={<OfferPreview />} /></Routes></main>{!['account', 'notifications', 'checkout', 'orders'].includes(page) && <Footer />}</div></ActionAnimationProvider></MemoryRouter></React.StrictMode>))
  await waitFor(() => page === 'checkout' ? document.getElementById('checkout-name') : page === 'orders' ? document.querySelector('.orders-empty-state, .table tbody .badge') : page === 'account' ? document.getElementById('account-name')?.value === profile.name : page === 'login' ? document.getElementById('login-identifier') : page === 'notifications' ? document.querySelector('.notif-list') : page === 'shop' ? document.querySelector('.store-results-row')?.textContent.includes('fragrance') && !document.querySelector('.store-product-skeleton') : page === 'popup' ? document.querySelector('.welcome-offer img')?.naturalWidth > 0 : document.querySelectorAll('.store-product').length === 4 && !document.querySelector('.store-product-skeleton'))
  await document.fonts.ready
  await Promise.all(Array.from(document.images).map(async (image) => { image.loading = 'eager'; try { await image.decode() } catch { /* Missing optional media is covered by page fallbacks. */ } }))
  await settle()
  window.scrollTo(0, 0)
}
const results = []
const run = async (name, fn) => { try { await fn(); results.push({ name, passed: true }) } catch (error) { results.push({ name, passed: false, error: error.message, stack: error.stack }) } }

const preview = new URLSearchParams(location.search).get('preview')
const sampleOrder = { id: 'order-fixture-12345678', userId: profile.id, status: 'Pending COD', createdAt: '2026-11-06T04:00:00Z', items: [{ itemId: 'first-item', productId: 'cucumber-melon', name: 'Cucumber Melon', quantity: 2, price: 1690, trackingStatus: 'Pending COD' }, { itemId: 'second-item', productId: 'weekend', name: 'Burberry Weekend', quantity: 1, price: 2490, trackingStatus: 'Pending COD' }] }
const fillShipping = async () => {
  for (const [field, value] of Object.entries({ name: ' Ana Cruz ', barangay: 'Poblacion', city: 'Boac', province: 'Marinduque', zip: '4900', country: 'Philippines' })) await input('checkout-' + field, value)
}

if (preview) {
  if (preview === 'shop') localStorage.setItem('severino_shop_view', 'grid')
  const policyPreview = ['terms', 'privacy', 'cookies', 'terms-fashion'].includes(preview)
  if (preview.startsWith('checkout')) window.qaProfile = {}
  if (preview === 'checkout-phone') {
    window.qaProfile = profile
    window.qaCart = { items: [{ productId: 'cucumber-melon', quantity: 1 }] }
    window.registeredDeliveryPhone = true
  }
  if (preview === 'cancel-order') window.qaOrders = [sampleOrder]
  if (preview === 'adaptive-intro') sessionStorage.removeItem('severino_adaptive_scent_intro_seen')
  await render(preview.startsWith('checkout') ? 'checkout' : preview === 'cancel-order' ? 'orders' : preview === 'adaptive-intro' ? 'home' : policyPreview ? 'login' : preview === 'quick-actions' ? 'home' : ['list', 'search-open'].includes(preview) ? 'shop' : preview === 'font-fashion' ? 'account' : preview)
  if (preview === 'checkout-errors') await click(button('Next'))
  if (preview === 'checkout-contact') { await fillShipping(); await click(button('Next')) }
  if (preview === 'checkout-phone') { await click(button('Next')); await click(button('Next')); await click(button('Confirm Order')) }
  if (preview === 'cancel-order') await click(button('Cancel'))
  if (preview === 'list') await click(document.querySelector('[aria-label="List view"]'))
  if (preview === 'search-open') await click(document.querySelector('.header-search-trigger'))
  if (preview === 'font-fashion') { await select('account-font', 'fashion'); await document.fonts.ready }
  if (policyPreview) {
    if (preview === 'terms-fashion') { applyFontPreference('fashion'); await document.fonts.ready }
    await click(document.querySelector('.terms-link'))
    if (preview === 'cookies' || preview === 'privacy') await click(Array.from(document.querySelectorAll('.policy-selector button')).find(item => item.textContent === (preview === 'cookies' ? 'Cookie Policy' : 'Privacy Policy')))
  }
  if (preview === 'quick-actions' && innerWidth <= 640) await click(document.querySelector('[aria-label="Toggle quick actions"]'))
  noOverflow()
  window.qaReady = true
} else {
  await run('Adaptive Scent introduction stays on screen, dismisses per tab, and opens from keyboard', async () => {
    sessionStorage.removeItem('severino_adaptive_scent_intro_seen')
    sessionStorage.removeItem('severino_adaptive_scent_enabled')
    sessionStorage.setItem('severino_adaptive_scent_position', JSON.stringify({ x: 12, y: 90 }))
    await render('home')
    let tip = document.querySelector('.adaptive-scent-hint')
    assert(tip?.textContent.includes('Try this Adaptive Scent Feature'), 'The feature introduction explains the floating button')
    let rect = tip.getBoundingClientRect()
    assert(rect.left >= 0 && rect.right <= document.documentElement.clientWidth && rect.top >= 0 && rect.bottom <= innerHeight, 'Tip fits at the left edge')
    await click(document.querySelector('[aria-label="Dismiss Adaptive Scent tip"]'))
    await render('home')
    assert(!document.querySelector('.adaptive-scent-hint'), 'Dismissal is remembered across pages in this tab')
    const floating = document.querySelector('[aria-label="Open Adaptive Scent"]')
    floating.setPointerCapture = () => {}
    floating.hasPointerCapture = () => false
    const origin = floating.getBoundingClientRect()
    flushSync(() => {
      floating.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: origin.left + 20, clientY: origin.top + 20 }))
      floating.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: origin.left + 50, clientY: origin.top + 50 }))
      floating.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))
      floating.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    await settle()
    assert(!document.querySelector('.adaptive-modal-card'), 'Dragging does not accidentally open the feature')
    floating.focus()
    await click(floating)
    assert(document.querySelector('.adaptive-modal-card'), 'Keyboard-style activation opens the feature after dragging')
    await click(document.querySelector('[aria-label="Close Adaptive Scent"]'))
    sessionStorage.removeItem('severino_adaptive_scent_intro_seen')
    sessionStorage.setItem('severino_adaptive_scent_position', JSON.stringify({ x: innerWidth - 10, y: innerHeight - 10 }))
    await render('home')
    tip = document.querySelector('.adaptive-scent-hint')
    rect = tip.getBoundingClientRect()
    assert(rect.left >= 0 && rect.right <= document.documentElement.clientWidth && rect.top >= 0 && rect.bottom <= innerHeight, 'Tip fits at the bottom-right edge without covering the scrollbar')
    await click(document.querySelector('.adaptive-scent-hint__message'))
    assert(document.querySelector('.adaptive-modal-card') && !document.querySelector('.adaptive-scent-hint'), 'The thought bubble also opens and dismisses the introduction')
    await click(document.querySelector('[aria-label="Close Adaptive Scent"]'))
  })
  await run('Checkout validates each step, preserves edits, and prevents duplicate or out-of-stock orders', async () => {
    window.rejectProfileWrite = true
    const initialProfileCount = calls.profile.length
    window.qaProfile = {}
    window.qaCart = { items: [{ productId: 'cucumber-melon', quantity: 1 }] }
    const initialOrderCount = calls.orders.length
    await render('checkout')
    await click(button('Next'))
    assert(document.getElementById('checkout-step-title').textContent === 'Shipping details', 'Missing shipping details cannot advance')
    await waitFor(() => document.activeElement.id === 'checkout-name')
    assert(document.querySelectorAll('.checkout-field-error').length === 6 && calls.orders.length === initialOrderCount, 'Required fields are identified before any order request')
    await fillShipping()
    await click(button('Next'))
    assert(document.getElementById('checkout-step-title').textContent === 'Contact details', 'Valid shipping advances without an optional street address')
    const step = document.querySelector('.checkout-step-content')
    assert(step.getAnimations().length > 0 || matchMedia('(prefers-reduced-motion: reduce)').matches, 'Step transition is animated when motion is allowed')
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) assert(step.getAnimations().length === 0, 'Step motion respects reduced motion')
    await input('checkout-mobile', '123')
    await input('checkout-email', 'invalid')
    await click(button('Next'))
    assert(document.getElementById('checkout-step-title').textContent === 'Contact details' && document.querySelectorAll('.checkout-field-error').length === 2, 'Invalid contact details cannot advance')
    await input('checkout-mobile', '0917 123 4567')
    await input('checkout-email', ' ANA@EXAMPLE.COM ')
    await click(button('Next'))
    assert(document.getElementById('checkout-step-title').textContent === 'Review your order', 'Valid contact advances without optional notes')
    await click(button('Back'))
    assert(document.getElementById('checkout-mobile').value === '0917 123 4567', 'Contact edits are preserved on Back')
    await click(button('Back'))
    await input('checkout-zip', ' ')
    await click(button('Next'))
    assert(document.getElementById('checkout-step-title').textContent === 'Shipping details' && document.getElementById('checkout-zip').getAttribute('aria-invalid') === 'true', 'Previously completed fields must remain valid after editing')
    await input('checkout-zip', '4900')
    await click(button('Next'))
    await click(button('Next'))
    window.holdOrder = true
    await click(button('Confirm Order'))
    await waitFor(() => window.finishOrder)
    const checkoutForm = document.querySelector('.checkout-card')
    flushSync(() => { checkoutForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); checkoutForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    assert(calls.orders.length === initialOrderCount + 1 && button('Back').disabled, 'Submitting disables navigation and prevents duplicate requests')
    assert(calls.profile.length === initialProfileCount, 'Checkout saves delivery details on the order without updating account login identifiers')
    const payload = calls.orders.at(-1)
    assert(payload.contactName === 'Ana Cruz' && payload.email === 'ana@example.com' && payload.phone === '+639171234567' && !payload.address.startsWith(','), 'Final order data is trimmed and normalized')
    window.holdOrder = false
    window.finishOrder()
    await waitFor(() => !document.querySelector('.checkout-card') && document.querySelector('h1')?.textContent === 'Order Tracking')
    window.finishOrder = null
    window.qaProfile = profile
    window.qaCart = { items: [{ productId: 'cloudy-scent', quantity: 1 }] }
    await render('checkout')
    await click(button('Next'))
    await click(button('Next'))
    await click(button('Confirm Order'))
    await waitFor(() => document.querySelector('.checkout-notice.is-error'))
    assert(calls.orders.length === initialOrderCount + 1 && document.querySelector('.checkout-notice.is-error').textContent.includes('Stock has changed'), 'Stock is checked again before an order is created')
    delete window.qaProfile
    delete window.qaCart
  })
  delete window.rejectProfileWrite
  await run('Registered delivery phone asks Yes or No and permits one order only after consent', async () => {
    window.rejectProfileWrite = true
    window.registeredDeliveryPhone = true
    window.qaProfile = profile
    const directKey = 'severino_direct_checkout_' + profile.id
    localStorage.setItem(directKey, JSON.stringify({ productId: 'cucumber-melon', quantity: 1 }))
    const initialOrderCount = calls.orders.length
    const initialProfileCount = calls.profile.length
    await render('checkout')
    await click(button('Next'))
    await input('checkout-mobile', '0928 765 4321')
    await click(button('Next'))
    await click(button('Confirm Order'))
    await waitFor(() => document.querySelector('.checkout-phone-modal'))
    const modal = document.querySelector('.checkout-phone-modal')
    assert(modal.textContent.includes('already registered to another user') && modal.textContent.includes('+639287654321'), 'The dialog identifies the shared number and asks before continuing')
    assert(document.activeElement.textContent === 'No', 'No is the focused default')
    const rect = modal.getBoundingClientRect()
    assert(rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, 'Confirmation fits the viewport')
    assert(parseInt(getComputedStyle(modal.parentElement).zIndex) > 20000, 'Confirmation appears above floating actions')
    assert(calls.orders.length === initialOrderCount && calls.profile.length === initialProfileCount, 'A warning never places an order or modifies either account')
    await click(button('No'))
    await waitFor(() => document.activeElement.id === 'checkout-mobile')
    assert(!document.querySelector('.checkout-phone-modal') && document.getElementById('checkout-mobile').value === '0928 765 4321', 'No returns to the contact field and preserves the entry')
    await click(button('Next'))
    await click(button('Confirm Order'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await waitFor(() => document.getElementById('checkout-mobile') && !document.querySelector('.checkout-phone-modal'))
    assert(calls.orders.length === initialOrderCount, 'Escape dismisses without ordering')
    await input('checkout-mobile', '0999 888 7777')
    await click(button('Next'))
    await click(button('Confirm Order'))
    assert(document.querySelector('.checkout-phone-modal').textContent.includes('+639998887777'), 'A changed number gets a new confirmation')
    const checksBeforeYes = calls.phones.length
    window.holdOrder = true
    const yes = button('Yes')
    flushSync(() => { yes.click(); yes.click() })
    await waitFor(() => window.finishOrder)
    assert(calls.orders.length === initialOrderCount + 1 && calls.phones.length === checksBeforeYes, 'Yes resumes the approved number once without repeating the popup')
    assert(calls.orders.at(-1).phone === '+639998887777' && calls.profile.length === initialProfileCount, 'Approved delivery contact is stored only on the order')
    window.holdOrder = false
    window.finishOrder()
    await waitFor(() => !document.querySelector('.checkout-card'))
    assert(localStorage.getItem(directKey) === null, 'A successful direct purchase clears its selection')
    window.finishOrder = null
    delete window.registeredDeliveryPhone
    delete window.qaProfile
  })
  delete window.rejectProfileWrite
  await run('Delivery phone lookup failures stop checkout and a retry checks again', async () => {
    window.qaProfile = profile
    window.qaCart = { items: [{ productId: 'cucumber-melon', quantity: 1 }] }
    const initialOrderCount = calls.orders.length
    await render('checkout')
    await click(button('Next'))
    await click(button('Next'))
    window.failPhoneCheck = true
    await click(button('Confirm Order'))
    assert(document.querySelector('.checkout-notice.is-error')?.textContent.includes('Unable to check') && calls.orders.length === initialOrderCount, 'Failed checks do not silently place an order')
    window.failPhoneCheck = false
    await click(button('Confirm Order'))
    await waitFor(() => !document.querySelector('.checkout-card'))
    assert(calls.orders.length === initialOrderCount + 1 && !document.querySelector('.checkout-phone-modal'), 'An unregistered or own number continues without a popup')
    delete window.qaProfile
    delete window.qaCart
  })
  await run('Cancellation identifies one item, handles failures, and submits once with a safe default', async () => {
    window.qaOrders = [sampleOrder]
    await render('orders')
    const originalFont = document.documentElement.dataset.font || 'editorial'
    applyFontPreference('fashion')
    await document.fonts.ready
    const initialCount = calls.cancellations.length
    await click(button('Cancel'))
    let modal = document.querySelector('.order-cancel-modal')
    assert(modal?.textContent.includes('Cucumber Melon') && modal.textContent.includes('Other items') && modal.textContent.includes('\u20b1'), 'Confirmation names the item, displays its price, and explains its scope')
    assert(document.activeElement.textContent === 'Keep item' && document.documentElement.style.overflow === 'hidden', 'Safe action receives focus and the page is locked')
    assert(document.elementFromPoint(innerWidth / 2, 10)?.closest('.order-cancel-backdrop'), 'Confirmation covers the sticky header')
    assert(getComputedStyle(modal.querySelector('h2')).fontFamily.includes('Bodoni Moda'), 'Cancellation follows the chosen font')
    await click(button('Keep item'))
    assert(!document.querySelector('.order-cancel-modal') && calls.cancellations.length === initialCount, 'Keeping an item makes no cancellation request')
    await click(button('Cancel'))
    window.failCancellation = true
    await click(button('Cancel item'))
    await waitFor(() => document.querySelector('.order-cancel-error'))
    assert(document.querySelector('.order-cancel-modal'), 'Failed cancellation remains open with an actionable error')
    window.failCancellation = false
    window.holdCancellation = true
    await click(button('Cancel item'))
    await waitFor(() => window.finishCancellation)
    const pendingCount = calls.cancellations.length
    await click(button('Cancelling…'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    assert(calls.cancellations.length === pendingCount && document.querySelector('.order-cancel-modal') && button('Keep item').disabled, 'Pending cancellation cannot be duplicated or dismissed')
    window.holdCancellation = false
    window.finishCancellation()
    await waitFor(() => !document.querySelector('.order-cancel-modal'))
    assert(calls.cancellations.at(-1).orderId === sampleOrder.id && calls.cancellations.at(-1).itemKey === 'first-item', 'Only the intended order item is sent to the API')
    const rows = document.querySelectorAll('.table tbody tr')
    assert(rows[0].textContent.includes('Cancelled') && rows[1].textContent.includes('Pending COD'), 'The other order item remains active')
    window.finishCancellation = null
    window.qaOrders = []
    applyFontPreference(originalFont)
  })
  await run('Policy documents open independently, inherit fonts, and preserve agreement choice', async () => {
    await render('login')
    const originalFont = document.documentElement.dataset.font || 'editorial'
    await click(document.querySelector('.terms-link'))
    const dialog = document.querySelector('.terms-modal')
    assert(document.elementFromPoint(innerWidth / 2, 10)?.closest('.policy-backdrop'), 'Policy backdrop covers the sticky header')
    const policyButtons = () => Array.from(document.querySelectorAll('.policy-selector button'))
    assert(policyButtons().length === 3, 'All three policies are reachable')
    await click(policyButtons().find(item => item.textContent === 'Cookie Policy'))
    assert(document.getElementById('terms-title').textContent === 'Cookie Policy', 'Cookie policy is selected')
    assert(dialog.textContent.includes('oauth_state') && dialog.textContent.includes('local storage'), 'Actual cookies and similar storage are disclosed')
    assert(dialog.scrollHeight > dialog.clientHeight, 'Long cookie policy scrolls inside the dialog')
    assert(dialog.getBoundingClientRect().left >= 0 && dialog.getBoundingClientRect().right <= innerWidth, 'Policy fits viewport')
    assert(!document.querySelector('.terms-check input').checked, 'Viewing policies does not accept the agreement')
    applyFontPreference('fashion')
    await document.fonts.ready
    assert(getComputedStyle(document.getElementById('terms-title')).fontFamily.includes('Bodoni Moda') && getComputedStyle(dialog).fontFamily.includes('Jost'), 'Policy headings and body follow the chosen fonts')
    await click(policyButtons().find(item => item.textContent === 'Privacy Policy'))
    assert(document.getElementById('terms-title').textContent === 'Privacy Policy', 'Privacy policy is separate')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    assert(!document.querySelector('.terms-modal') && !document.documentElement.style.overflow, 'Escape closes and restores scrolling')
    const footerCookieLink = Array.from(document.querySelectorAll('.footer-policy-links button')).find(item => item.textContent === 'Cookie Policy')
    footerCookieLink.focus()
    await click(footerCookieLink)
    assert(document.getElementById('terms-title').textContent === 'Cookie Policy', 'Footer opens the requested policy directly')
    await click(document.querySelector('.terms-modal .modal-close'))
    assert(document.activeElement === footerCookieLink, 'Closing restores focus to the policy link')
    applyFontPreference(originalFont)
  })
  await run('Desktop navigation is centered; mobile quick actions open smoothly and hide accessibly', async () => {
    for (const page of ['login', 'shop']) {
      await render(page)
      if (innerWidth > 900) {
        const nav = document.querySelector('.nav').getBoundingClientRect()
        const links = document.querySelector('.nav-links').getBoundingClientRect()
        const logo = document.querySelector('.nav-logo-link').getBoundingClientRect()
        const actions = document.querySelector('.nav-actions').getBoundingClientRect()
        assert(Math.abs((links.left + links.right) / 2 - (nav.left + nav.right) / 2) <= 1, 'Navigation is centered for ' + page)
        assert(logo.right <= links.left && links.right <= actions.left, 'Logo and actions do not overlap centered links')
      }
    }
    if (innerWidth <= 640) {
      const toggle = document.querySelector('[aria-label="Toggle quick actions"]')
      const panel = document.getElementById('mobile-quick-actions')
      const favorite = panel.querySelector('[aria-label="Favorites"]')
      assert(panel.hasAttribute('inert') && toggle.getAttribute('aria-expanded') === 'false', 'Collapsed quick actions are inaccessible')
      await click(toggle)
      assert(toggle.getAttribute('aria-expanded') === 'true' && !panel.hasAttribute('inert'), 'Opening exposes quick actions')
      assert(panel.getAnimations().length > 0 || matchMedia('(prefers-reduced-motion: reduce)').matches, 'Quick actions animate when motion is allowed')
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) assert(panel.getAnimations({ subtree: true }).length === 0, 'Reduced motion disables panel and button transitions')
      await Promise.all(panel.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
      assert(getComputedStyle(favorite).opacity === '1' && panel.getBoundingClientRect().height > 40, 'Expanded actions settle visibly')
      await click(toggle)
      assert(panel.hasAttribute('inert') && panel.getAttribute('aria-hidden') === 'true', 'Closing immediately prevents keyboard access')
      await Promise.all(panel.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
      assert(getComputedStyle(panel).visibility === 'hidden', 'Closed actions are hidden after the exit transition')
    }
  })
  await run('Grid/list keeps products, sorting and filters; preference survives remount', async () => {
    localStorage.removeItem('severino_shop_view')
    await render('shop')
    noOverflow()
    const before = cardNames().join('|')
    await click(document.querySelector('[aria-label="List view"]'))
    assert(cardNames().join('|') === before && document.querySelector('.store-list'), 'Same catalog in list view')
    assert(document.querySelector('[aria-label="List view"]').getAttribute('aria-pressed') === 'true', 'Selection exposed to assistive technology')
    noOverflow()
    await input('shop-search', 'Cucumber')
    assert(cardNames().length === 1 && cardNames()[0] === 'Cucumber Melon', 'Search filters products')
    await click(document.querySelector('[aria-label="Grid view"]'))
    assert(document.getElementById('shop-search').value === 'Cucumber' && cardNames().length === 1, 'Switch preserves search')
    await click(button('Clear all'))
    await click(button('Filters'))
    await select('shop-category', 'Unisex')
    await input('shop-min-price', '2000')
    assert(cardNames().length === 1 && cardNames()[0].includes('Weekend'), 'Category and price combine')
    await click(button('Clear all'))
    await select('shop-sort', 'price-high')
    assert(cardNames()[0] === 'Bacc540', 'Price sorting works')
    await click(document.querySelector('[aria-label="List view"]'))
    assert(cardNames()[0] === 'Bacc540', 'Switch preserves sorting')
    await render('shop')
    assert(document.querySelector('.store-list'), 'Saved list preference survives remount')
    await render('shop', '/shop?category=Men')
    assert(cardNames().join('|') === 'Bacc540', 'Homepage category deep link works')
    await input('shop-search', 'nonexistent')
    assert(document.querySelector('.store-empty-state')?.textContent.includes('No scents found'), 'Empty results provide recovery')
    await click(button('Clear filters'))
    assert(cardNames().length === 4, 'Empty result can be cleared')
  })
  await run('Both views keep favorites, quantity selection and stock protection', async () => {
    await render('shop')
    for (const mode of ['grid', 'list']) {
      await click(document.querySelector('[aria-label="' + (mode === 'grid' ? 'Grid' : 'List') + ' view"]'))
      const favorite = document.querySelector('.store-favorite')
      const previous = favorite.getAttribute('aria-pressed')
      await click(favorite)
      assert(favorite.getAttribute('aria-pressed') !== previous, 'Favorite toggles in ' + mode)
      const sold = Array.from(document.querySelectorAll('.store-product')).find(item => item.textContent.includes('Cloudy Scent'))
      assert(sold.querySelector('.store-add-button').disabled, 'Out-of-stock items cannot be added')
      assert(document.querySelector('.store-add-button:not(:disabled)').textContent === 'Add to Cart', 'Purchase label says Add to Cart')
      assert(document.querySelector('.store-add-button circle'), 'Purchase action uses the cart with wheels')
      await click(document.querySelector('.store-add-button:not(:disabled)'))
      const quantity = document.querySelector('.store-cart-modal select')
      quantity.value = '2'
      flushSync(() => quantity.dispatchEvent(new Event('change', { bubbles: true })))
      await click(button('Add'))
      await waitFor(() => !document.querySelector('.store-cart-modal'))
      assert(calls.cart.at(-1)[0].quantity === 2, 'Quantity is preserved in cart payload')
    }
  })
  await run('Login keeps validation, password visibility and required terms', async () => {
    await render('login')
    noOverflow()
    await click(document.querySelector('.terms-link'))
    assert(document.querySelectorAll('.terms-law-card').length === 5, 'Full terms remain available')
    await click(document.querySelector('.terms-modal .modal-close'))
    await input('login-identifier', 'invalid')
    await click(button('Sign In'))
    assert(document.querySelector('[aria-invalid="true"]'), 'Invalid input remains identified')
    await input('login-identifier', 'alex@example.test')
    await input('login-password', 'Test123!abcd')
    await click(document.querySelector('[aria-label="Show password"]'))
    assert(document.getElementById('login-password').type === 'text', 'Password visibility works')
    const count = calls.login.length
    await click(button('Sign In'))
    assert(calls.login.length === count && document.querySelector('[role="alert"]').textContent.includes('terms'), 'Consent remains required')
    await click(document.querySelector('.terms-check input'))
    await click(button('Sign In'))
    assert(calls.login.length === count + 1, 'Existing login receives accepted form')
  })
  await run('Account keeps all profile fields, theme choices and password manager', async () => {
    await render('account')
    noOverflow()
    assert(document.getElementById('account-backup').value === profile.backupAddress && document.getElementById('account-country').value === 'Philippines', 'Address fields are retained')
    await input('account-name', 'Alex Cruz Updated')
    await click(button('Save changes'))
    await waitFor(() => document.querySelector('.account-success-modal'))
    assert(calls.profile.at(-1).name === 'Alex Cruz Updated' && calls.profile.at(-1).backupAddress === profile.backupAddress, 'Existing profile payload is preserved')
    await click(button('Done'))
    await select('account-theme', 'Shadow Dark Mode')
    assert(document.documentElement.dataset.theme === 'Shadow Dark Mode' && calls.theme.at(-1) === 'Shadow Dark Mode', 'Theme applies and uses existing API')
    noOverflow()
    await select('account-theme', 'Default')
    await click(button('Change password'))
    assert(document.getElementById('account-password-form'), 'Existing password form expands')
    await input('account-current-password', 'ExistingTest123!')
    await input('account-new-password', 'NewTest123!abcd')
    await input('account-confirm-password', 'mismatch')
    const passwordCount = calls.password.length
    await click(button('Update Password'))
    assert(calls.password.length === passwordCount, 'Mismatched password confirmation is blocked')
    await input('account-confirm-password', 'NewTest123!abcd')
    await click(button('Update Password'))
    assert(calls.password.length === passwordCount + 1 && calls.password.at(-1).currentPassword === 'ExistingTest123!', 'Existing password endpoint receives the same payload')
    for (const mode of ['Daylight', 'Pink Splush', 'Blazing Maroon', 'Forest Brown', 'Beach Blue', 'Luxurious Gold', 'Shadow Dark Mode', 'Default']) { await select('account-theme', mode); noOverflow() }
  })
  await run('Catalog request failures have a working retry', async () => {
    window.failCatalog = true
    await render('shop')
    assert(document.querySelector('[role="alert"]')?.textContent.includes('temporarily unavailable'), 'Server explanation remains visible')
    window.failCatalog = false
    await click(button('Try again'))
    await waitFor(() => cardNames().length === 4)
    assert(!document.querySelector('[role="alert"]'), 'Retry recovers the catalog')
  })
  await run('Font selection is loaded locally, independent of every theme, and remembered', async () => {
    await render('account')
    for (const [font, heading, body] of [['editorial', 'Cormorant Garamond', 'Manrope'], ['fashion', 'Bodoni Moda', 'Jost']]) {
      await select('account-font', font)
      for (const theme of ['Default', 'Daylight', 'Pink Splush', 'Blazing Maroon', 'Forest Brown', 'Beach Blue', 'Luxurious Gold', 'Shadow Dark Mode']) {
        await select('account-theme', theme)
        await document.fonts.ready
        assert(getComputedStyle(document.querySelector('h1')).fontFamily.includes(heading), 'Heading font survives ' + theme)
        assert(getComputedStyle(document.getElementById('account-name')).fontFamily.includes(body), 'UI font survives ' + theme)
        assert(document.fonts.check('16px "' + heading + '"') && document.fonts.check('16px "' + body + '"'), 'Selected font files load')
        noOverflow()
      }
    }
    await render('account')
    assert(document.getElementById('account-font').value === 'fashion', 'Font preference survives remount')
    assert(readFontPreference('another-fixture-user') === 'editorial', 'Preference is scoped per account')
    await select('account-theme', 'Default')
    await select('account-font', 'editorial')
  })
  await run('One header magnifier expands, focuses, searches the shop and closes with Escape', async () => {
    await render('home', '/')
    const trigger = document.querySelector('.header-search-trigger')
    assert(trigger && !document.querySelector('.header-search-form'), 'Search starts collapsed')
    assert(!document.querySelector('a[href="/search"], .store-nav-search'), 'Separate search navigation is removed')
    await click(trigger)
    const field = document.querySelector('.header-search-form input')
    assert(document.activeElement === field && trigger.getAttribute('aria-expanded') === 'true', 'Expanding search focuses the field')
    const rect = document.querySelector('.header-search-form').getBoundingClientRect()
    assert(rect.left >= 0 && rect.right <= innerWidth, 'Expanded search fits the viewport')
    await input(field.id, 'saffron')
    await click(document.querySelector('[aria-label="Find scents"]'))
    await waitFor(() => document.getElementById('shop-search')?.value === 'saffron')
    assert(cardNames().join('|') === 'Bacc540', 'Header searches actual product notes in Shop')
    assert(!document.querySelector('.header-search-form'), 'Submitting collapses the field')
    await click(document.querySelector('.header-search-trigger'))
    flushSync(() => document.querySelector('.header-search-form input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert(!document.querySelector('.header-search-form') && document.activeElement.classList.contains('header-search-trigger'), 'Escape closes and restores focus')
    await render('shop', '/search?q=melon')
    assert(document.getElementById('shop-search').value === 'melon' && cardNames().join('|') === 'Cucumber Melon', 'Old search URLs redirect into Shop')
  })
  await run('Notification categories show labels, counts and working filtering', async () => {
    localStorage.removeItem('severino_notif_opened_' + profile.id)
    localStorage.removeItem('severino_notif_deleted_' + profile.id)
    window.qaOrders = [{ id: 'qa-order-1', status: 'Pending' }, { id: 'qa-order-2', status: 'Delivered' }]
    await render('notifications')
    assert(Array.from(document.querySelectorAll('.notif-filter-label')).map(item => item.textContent).join('|') === 'All|Unread|Opened', 'Every category has a visible name')
    await click(document.getElementById('notif-tab-unread'))
    assert(document.querySelectorAll('.notif-row').length === 2, 'Unread category retains filtering')
    await click(document.querySelector('.notif-row__content'))
    await click(document.getElementById('notif-tab-opened'))
    assert(document.querySelectorAll('.notif-row').length === 1, 'Opened category tracks read items')
    for (const label of document.querySelectorAll('.notif-filter-label')) assert(label.getBoundingClientRect().width > 0, 'Labels remain visible on phone')
    noOverflow()
    window.qaOrders = []
  })
  await run('Welcome artwork fits portrait, landscape and square images with unobstructed close', async () => {
    for (const image of ['/qa-portrait.svg', '/qa-landscape.svg', '/qa-square.svg']) {
      window.qaOfferImage = image
      await render('popup')
      const modal = document.querySelector('.welcome-offer')
      const artwork = modal.querySelector('img')
      const frame = modal.getBoundingClientRect()
      const media = artwork.getBoundingClientRect()
      const close = modal.querySelector('.welcome-offer-close').getBoundingClientRect()
      assert(frame.left >= 0 && frame.right <= innerWidth && frame.top >= 0 && frame.bottom <= innerHeight, 'Image dialog fits the viewport')
      assert(media.left >= frame.left && media.right <= frame.right && media.bottom <= frame.bottom, 'Image is inside its container')
      assert(Math.abs(media.width / media.height - artwork.naturalWidth / artwork.naturalHeight) < .02, 'Complete image keeps its natural aspect ratio')
      assert(close.bottom <= media.top + 1, 'Close control does not cover the image')
      await click(modal.querySelector('.welcome-offer-close'))
      assert(!document.querySelector('.welcome-offer') && !document.documentElement.style.overflow, 'Close restores page scrolling')
    }
    window.qaOfferImage = undefined
  })
  await run('Home uses actual catalog links and keeps responsive composition', async () => {
    await render('home', '/')
    noOverflow()
    assert(cardNames().length === 4, 'Featured products load from existing catalog')
    assert(document.querySelector('.store-product-image').getAttribute('href') === '/product/cucumber-melon', 'Products link to real detail routes')
    assert(document.querySelector('.store-category-links a[href="/shop?category=Women"]'), 'Category shortcuts use shop filters')
    if (innerWidth <= 900) {
      assert(getComputedStyle(document.querySelector('.nav-toggle')).display !== 'none', 'Menu control is visible on phone and tablet')
      await click(document.querySelector('.nav-toggle'))
      assert(document.querySelector('.nav-links.open'), 'Existing mobile navigation opens')
    }
  })
  document.documentElement.removeAttribute('data-theme')
  applyFontPreference('editorial')
  const report = document.createElement('pre')
  report.id = 'qa-results'
  report.textContent = JSON.stringify({ width: innerWidth, results })
  document.body.append(report)
  window.qaReady = true
}
`

const artifactDir = path.resolve('tmp/storefront-qa')
await mkdir(artifactDir, { recursive: true })
await mkdir('node_modules/.cache/storefront-qa', { recursive: true })
const profileDir = await mkdtemp(path.resolve('node_modules/.cache/storefront-qa/run-'))
const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'storefront-qa.jsx', loader: 'jsx' }, bundle: true, write: false, format: 'esm', jsx: 'automatic', define: { 'import.meta.env': '{}' }, plugins: [{ name: 'fixture-auth', setup(build) { build.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ contents: 'export const useAuth = () => window.qaAuth', loader: 'js' })) } }] })
const css = (await Promise.all(['src/index.css', 'src/admin.css', 'src/customer-desktop.css', 'src/storefront.css'].map(file => readFile(file, 'utf8')))).join('\n').replace(/^@import[^\r\n]*[\r\n]*/gm, '')
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', "frame-src 'none'; connect-src 'self'")
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); return }
  if (req.url === '/logo.svg' || req.url === '/images/severino-editorial.webp') { res.setHeader('Content-Type', req.url.endsWith('webp') ? 'image/webp' : 'image/svg+xml'); res.end(await readFile('public' + req.url)); return }
  if (/^\/fonts\/[a-z-]+\.woff2$/.test(req.url)) { res.setHeader('Content-Type', 'font/woff2'); res.end(await readFile('public' + req.url)); return }
  if (/^\/qa-(portrait|landscape|square)\.svg$/.test(req.url)) {
    const [width, height] = req.url.includes('portrait') ? [700, 1100] : req.url.includes('landscape') ? [1400, 700] : [900, 900]
    res.setHeader('Content-Type', 'image/svg+xml')
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#2b3422"/><rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="#d8cdb7" stroke-width="8"/><text x="50%" y="50%" text-anchor="middle" fill="#f6f3ea" font-size="44">SEVERINO</text></svg>`)
    return
  }
  res.setHeader('Content-Type', 'text/html')
  res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><div id="fixture"></div><script type="module" src="/bundle.js"></script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`
const edge = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

async function browser(width) {
  const userDir = path.join(profileDir, String(width))
  const child = spawn(edge, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', `--user-data-dir=${userDir}`, '--remote-debugging-port=0', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let socket
  const timeout = setTimeout(() => child.kill(), 90000)
  let processError
  child.on('error', error => { processError = error })
  try {
    let port
    for (let attempt = 0; attempt < 100; attempt++) {
      if (processError) throw processError
      try { port = Number((await readFile(path.join(userDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { /* Await browser startup. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!port) throw new Error('Headless browser did not start')
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let nextId = 0
    const pending = new Map()
    const errors = []
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
      const request = pending.get(message.id)
      if (!request) return
      pending.delete(message.id)
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result)
    })
    const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
    await call('Runtime.enable')
    if (process.argv.includes('--reduced-motion')) await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width <= 640 })
    await call('Emulation.setFocusEmulationEnabled', { enabled: true })
    const navigate = async url => {
      await call('Page.navigate', { url })
      const result = await call('Runtime.evaluate', { expression: 'new Promise((resolve, reject) => { const deadline = Date.now() + 25000; const check = () => window.qaReady ? resolve(true) : Date.now() > deadline ? reject(new Error("Fixture timed out")) : setTimeout(check, 50); check() })', awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Fixture failed')
    }
    if (!process.argv.includes('--previews-only')) {
      await navigate(baseUrl)
      const report = JSON.parse((await call('Runtime.evaluate', { expression: 'document.getElementById("qa-results").textContent', returnByValue: true })).result.value)
      console.log(JSON.stringify(report))
      await writeFile(path.join(artifactDir, `results-${width}.json`), JSON.stringify({ ...report, errors }, null, 2))
      if (report.results.some(result => !result.passed) || errors.length) process.exitCode = 1
      if (errors.length) console.log(JSON.stringify({ width, browserErrors: errors }))
    }
    for (const preview of ['login', 'home', 'account', 'shop', 'list', 'notifications', 'popup', 'search-open', 'font-fashion', 'terms', 'privacy', 'cookies', 'terms-fashion', 'quick-actions', 'adaptive-intro', 'checkout-errors', 'checkout-contact', 'checkout-phone', 'cancel-order']) {
      await navigate(`${baseUrl}/?preview=${preview}`)
      // Inspect the settled UI, rather than a partially transparent entrance animation.
      await call('Runtime.evaluate', { expression: 'Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))', awaitPromise: true })
      const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      await writeFile(path.join(artifactDir, `${width}-${preview}.png`), Buffer.from(shot.data, 'base64'))
    }
    await call('Browser.close')
  } finally {
    clearTimeout(timeout)
    socket?.close()
    if (child.exitCode === null) child.kill()
  }
}
const requestedWidth = process.argv.find((arg) => arg.startsWith('--width='))?.slice(8)
const widths = requestedWidth ? [Number(requestedWidth)] : [1440, 1024, 768, 390, 320]
if (widths.some((width) => !Number.isInteger(width) || width < 280)) throw new Error('Use a valid viewport width of at least 280px')
try { for (const width of widths) await browser(width); console.log(`Screenshots and reports: ${artifactDir}`) }
finally { server.closeAllConnections(); server.close() }
