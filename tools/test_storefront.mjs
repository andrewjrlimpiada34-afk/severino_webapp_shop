import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

// Isolated frontend QA: all account, inventory and catalog requests use test doubles.
// No real accounts, orders, database writes or third-party embeds are used.
const fixture = String.raw`
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import Home from './src/pages/Home.jsx'
import Shop from './src/pages/Shop.jsx'
import Login from './src/pages/Login.jsx'
import Account from './src/pages/Account.jsx'
import NavBar from './src/components/NavBar.jsx'
import Footer from './src/components/Footer.jsx'
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
const calls = { login: [], cart: [], profile: [], theme: [], password: [] }
window.qaAuth = { user: profile, logout: async () => {}, updateUser: () => {}, startLogin: async (...args) => { calls.login.push(args); return { role: 'customer' } } }
window.EventSource = class { addEventListener() {} close() {} }
Object.assign(api, {
  products: async () => { if (window.failCatalog) throw new Error('Collection temporarily unavailable'); return products },
  orders: async () => [], profile: async () => profile,
  updateProfile: async (data) => { calls.profile.push(data); return { ...profile, ...data } },
  updateTheme: async (theme) => { calls.theme.push(theme) },
  updatePassword: async (data) => { calls.password.push(data) },
  cart: async () => ({ items: [] }), updateCart: async (items) => { calls.cart.push(items) },
  banners: async () => [], bannerStories: async () => [], heroImage: async () => ({ image: '' }), featuredBanners: async () => [],
  loginAnnouncement: async () => [],
})
let renderNumber = 0
const root = createRoot(document.getElementById('fixture'))
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
const render = async (page, route = '/' + page) => {
  const Component = { home: Home, shop: Shop, login: Login, account: Account }[page]
  window.qaAuth.user = page === 'login' ? null : profile
  flushSync(() => root.render(<React.StrictMode><MemoryRouter key={++renderNumber} initialEntries={[route]}><ActionAnimationProvider><div className="app-shell storefront-shell"><NavBar /><main className="page"><Component /></main>{page !== 'account' && <Footer />}</div></ActionAnimationProvider></MemoryRouter></React.StrictMode>))
  await waitFor(() => page === 'account' ? document.getElementById('account-name')?.value === profile.name : page === 'login' ? document.getElementById('login-identifier') : page === 'shop' ? document.querySelector('.store-results-row')?.textContent.includes('fragrance') && !document.querySelector('.store-product-skeleton') : document.querySelectorAll('.store-product').length === 4 && !document.querySelector('.store-product-skeleton'))
  await document.fonts.ready
  await Promise.all(Array.from(document.images).map(async (image) => { image.loading = 'eager'; try { await image.decode() } catch { /* Missing optional media is covered by page fallbacks. */ } }))
  await settle()
  window.scrollTo(0, 0)
}
const results = []
const run = async (name, fn) => { try { await fn(); results.push({ name, passed: true }) } catch (error) { results.push({ name, passed: false, error: error.message, stack: error.stack }) } }

const preview = new URLSearchParams(location.search).get('preview')
if (preview) {
  if (preview === 'shop') localStorage.setItem('severino_shop_view', 'grid')
  await render(preview === 'list' ? 'shop' : preview)
  if (preview === 'list') await click(document.querySelector('[aria-label="List view"]'))
  noOverflow()
  window.qaReady = true
} else {
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
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width <= 640 })
    await call('Emulation.setFocusEmulationEnabled', { enabled: true })
    const navigate = async url => {
      await call('Page.navigate', { url })
      const result = await call('Runtime.evaluate', { expression: 'new Promise((resolve, reject) => { const deadline = Date.now() + 25000; const check = () => window.qaReady ? resolve(true) : Date.now() > deadline ? reject(new Error("Fixture timed out")) : setTimeout(check, 50); check() })', awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Fixture failed')
    }
    await navigate(baseUrl)
    const report = JSON.parse((await call('Runtime.evaluate', { expression: 'document.getElementById("qa-results").textContent', returnByValue: true })).result.value)
    console.log(JSON.stringify(report))
    await writeFile(path.join(artifactDir, `results-${width}.json`), JSON.stringify({ ...report, errors }, null, 2))
    if (report.results.some(result => !result.passed) || errors.length) process.exitCode = 1
    if (errors.length) console.log(JSON.stringify({ width, browserErrors: errors }))
    for (const preview of ['login', 'home', 'account', 'shop', 'list']) {
      await navigate(`${baseUrl}/?preview=${preview}`)
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
try { for (const width of [1440, 1024, 768, 390, 320]) await browser(width); console.log(`Screenshots and reports: ${artifactDir}`) }
finally { server.closeAllConnections(); server.close() }
