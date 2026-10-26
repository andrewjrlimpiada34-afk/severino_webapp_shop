import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

// Isolated browser tests: authentication calls are replaced only in this test bundle.
const fixture = String.raw`
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import Modal from './src/components/Modal.jsx'
import BrandIntro from './src/components/BrandIntro.jsx'
import CreateAccount from './src/pages/CreateAccount.jsx'
import Login from './src/pages/Login.jsx'

window.fetch = async () => ({ ok: true, json: async () => [] })
let sent = 0
let submitted = []
let verificationAccepted = false
let holdRegistration = false
let finishRegistration
window.qaAuth = {
  sendRegisterOtp: async () => ({ challengeId: 'challenge-' + ++sent, message: 'OTP sent to email' }),
  verifyRegisterOtp: async () => {
    if (!verificationAccepted) throw new Error('Invalid or expired OTP')
    return { message: 'Email OTP verified' }
  },
  register: async (payload) => {
    submitted.push(payload)
    if (holdRegistration) await new Promise(resolve => { finishRegistration = resolve })
  },
}
const root = createRoot(document.getElementById('fixture'))
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const waitFor = async predicate => {
  const deadline = Date.now() + 5000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for frontend state')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const render = async element => { flushSync(() => root.render(<React.StrictMode>{element}</React.StrictMode>)); await settle() }
const input = (element, value) => {
  assert(element instanceof HTMLInputElement, 'Input element is present')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value)
  flushSync(() => element.dispatchEvent(new Event('input', { bubbles: true })))
}
const fill = (name, value) => {
  const element = document.getElementById('create-' + name)
  assert(element, 'Field is present: ' + name)
  input(element, value)
}
const button = text => Array.from(document.querySelectorAll('button')).find(element => element.textContent.trim() === text)
const click = async element => { assert(element, 'Button exists'); flushSync(() => element.click()); await settle() }
const wheel = (target, deltaY, deltaX = 0) => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, deltaX })
  target.dispatchEvent(event)
  return event.defaultPrevented
}
const touch = (target, name, y) => {
  const event = new Event(name, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: [{ clientX: 30, clientY: y }] })
  target.dispatchEvent(event)
  return event.defaultPrevented
}
const key = (target, name, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event.defaultPrevented
}
const demo = count => <>
  <div id="background" style={{ height: 2400 }}>
    <header id="sticky" style={{ position: 'sticky', top: 0 }}>Background header</header>
    <button id="trigger">Background button</button>
  </div>
  {(Array.isArray(count) ? count : Array.from({ length: count }, (_, index) => index)).map(index => <Modal key={index}>
    <div className="modal-card" role="dialog" aria-modal="true" style={{ height: 200 }}>
      <button className="first">First</button>
      <div className="nested" style={{ overflow: 'auto', height: 60 }}><div style={{ height: 250 }}>Nested content</div></div>
      <div className="horizontal" style={{ overflow: 'auto', width: 100 }}><div style={{ width: 400 }}>Horizontal content</div></div>
      <textarea aria-label="Notes" />
      <div style={{ height: 800 }}>Long modal content</div>
      <button className="last">Last</button>
    </div>
  </Modal>)}
</>

const results = []
const run = async (name, work) => {
  try { await work(); results.push({ name, passed: true }) }
  catch (error) { results.push({ name, passed: false, error: error.message, stack: error.stack }) }
}

if (location.search.includes('preview=registration')) {
  await render(<MemoryRouter><CreateAccount /></MemoryRouter>)
} else if (location.search.includes('preview=terms')) {
  await render(<MemoryRouter><Login /></MemoryRouter>)
  await click(button('Read More'))
} else if (location.search.includes('preview=intro')) {
  await render(<BrandIntro />)
  await waitFor(() => document.querySelector('.brand-intro__logo'))
  const frame = Number(new URLSearchParams(location.search).get('frame')) || 2600
  const intro = document.querySelector('.brand-intro')
  for (const animation of intro.getAnimations({ subtree: true })) {
    animation.pause()
    animation.currentTime = frame
  }
  const svg = intro.querySelector('svg')
  svg.pauseAnimations()
  svg.setCurrentTime(frame / 1000)
} else {
  await run('Logo intro reveals, dismisses automatically, skips, and cleans up on an image error', async () => {
    const opening = label => <><BrandIntro key={label} /><div style={{ height: 2400 }}>App content</div></>
    await render(opening('automatic'))
    await waitFor(() => document.querySelector('.brand-intro__logo'))
    assert(document.documentElement.style.overflow === 'hidden', 'Intro locks background')
    assert(document.querySelector('.brand-intro image').getAttribute('href') === '/iconintro.png', 'Provided PNG is used as the logo mask')
    assert(getComputedStyle(document.querySelector('.brand-intro__trace--main')).animationName === 'brandIntroTrace', 'S follows an animated reveal path')
    assert(getComputedStyle(document.querySelector('.brand-intro__word')).animationDelay === '1.95s', 'Word fades in after the S trace')
    await waitFor(() => !document.querySelector('.brand-intro'))
    assert(!document.documentElement.style.overflow, 'Automatic dismissal restores scrolling')
    await render(opening('automatic'))
    assert(!document.querySelector('.brand-intro'), 'Intro does not replay on an app rerender')
    await render(opening('skip'))
    await click(button('Skip intro'))
    await waitFor(() => !document.querySelector('.brand-intro'))
    assert(!document.documentElement.style.overflow, 'Skip restores scrolling')
    await render(opening('error'))
    flushSync(() => document.querySelector('.brand-intro__preload').dispatchEvent(new Event('error')))
    assert(!document.querySelector('.brand-intro') && !document.documentElement.style.overflow, 'Missing image never traps the app behind an intro')
  })

  await run('Background lock, nested scrolling, keyboard, touch, stacking, and exact restoration', async () => {
    document.body.style.paddingRight = '7px'
    document.body.style.overflowX = 'clip'
    document.documentElement.style.scrollBehavior = 'smooth'
    await render(demo(0))
    window.scrollTo({ top: 350, behavior: 'instant' })
    document.getElementById('trigger').focus({ preventScroll: true })
    const scrollY = window.scrollY
    const before = document.getElementById('background').getBoundingClientRect()
    const stickyTop = document.getElementById('sticky').getBoundingClientRect().top
    await render(demo(1))
    assert(document.documentElement.style.overflow === 'hidden' && document.body.style.overflow === 'clip', 'Page is locked immediately')
    assert(Math.abs(document.getElementById('background').getBoundingClientRect().top - before.top) < 1, 'Background position is stable')
    assert(Math.abs(document.getElementById('background').getBoundingClientRect().width - before.width) < 1, 'No horizontal layout shift')
    assert(Math.abs(document.getElementById('sticky').getBoundingClientRect().top - stickyTop) < 1, 'Sticky background header stays in place')
    const backdrop = document.querySelector('.modal-backdrop')
    const card = backdrop.querySelector('.modal-card')
    assert(wheel(backdrop, 100), 'Wheel on backdrop is blocked')
    assert(!wheel(card, 100), 'Modal can scroll down')
    card.scrollTop = card.scrollHeight
    assert(wheel(card, 100), 'Bottom boundary cannot chain to background')
    const nested = card.querySelector('.nested')
    nested.scrollTop = 10
    assert(!wheel(nested, 30), 'Nested scrollable content still works')
    assert(!wheel(card.querySelector('.horizontal'), 0, 30), 'Horizontal modal scrolling still works')
    card.scrollTop = 0
    assert(wheel(card, -100), 'Top boundary cannot chain to background')
    touch(backdrop, 'touchstart', 100)
    assert(touch(backdrop, 'touchmove', 60), 'Backdrop touch is blocked')
    touch(card, 'touchstart', 100)
    assert(!touch(card, 'touchmove', 60), 'Touch scroll inside modal is allowed')
    card.focus({ preventScroll: true })
    assert(key(card, 'PageDown') && card.scrollTop > 0, 'Keyboard scroll targets the modal')
    assert(!key(card.querySelector('textarea'), 'ArrowDown'), 'Text editing keys keep native behavior')
    card.querySelector('.last').focus({ preventScroll: true })
    assert(key(card.querySelector('.last'), 'Tab') && document.activeElement === card.querySelector('.first'), 'Tab remains in active modal')
    document.getElementById('trigger').focus()
    assert(card.contains(document.activeElement), 'Background cannot take keyboard focus')
    await render(demo(2))
    await render(demo(1))
    assert(document.documentElement.style.overflow === 'hidden', 'Closing upper modal leaves remaining lock active')
    await render(demo(0))
    assert(window.scrollY === scrollY, 'Exact page scroll position is restored')
    assert(document.body.style.paddingRight === '7px' && document.body.style.overflowX === 'clip' && !document.body.style.overflowY, 'Original body styles are restored')
    assert(document.documentElement.style.scrollBehavior === 'smooth', 'Original smooth scrolling style is restored')
    assert(document.activeElement.id === 'trigger', 'Focus returns to the opening control')
    await render(demo(2))
    await render(demo([1]))
    assert(document.documentElement.style.overflow === 'hidden', 'Removing lower modal preserves the upper lock')
    await render(demo(0))
    assert(window.scrollY === scrollY && document.activeElement.id === 'trigger', 'Out-of-order close restores page and original focus')
    document.body.style.paddingRight = ''
    document.body.style.overflowX = ''
    document.documentElement.style.scrollBehavior = ''
  })

  await run('Terms retain content, remove illustrations, and scroll independently', async () => {
    await render(<MemoryRouter><Login /></MemoryRouter>)
    await click(button('Read More'))
    const terms = document.querySelector('.terms-modal')
    assert(terms && terms.scrollHeight > terms.clientHeight, 'Agreement has a scrollable viewport')
    assert(getComputedStyle(terms).overscrollBehaviorY === 'contain', 'Agreement prevents scroll chaining')
    assert(terms.clientHeight <= window.innerHeight * 0.9 + 1, 'Agreement fits in viewport')
    assert(!terms.querySelector('svg, .terms-document-art, .terms-leaf'), 'All agreement illustrations are removed')
    assert(terms.querySelectorAll('.terms-law-card').length === 5, 'All agreement sections remain')
    const number = terms.querySelector('.terms-card-number')
    assert(number.textContent === '1.' && getComputedStyle(number).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(number).borderRadius === '0px', 'Agreement uses formal plain numbers without circles')
    terms.scrollTop = terms.scrollHeight
    assert(terms.scrollTop > 0 && terms.textContent.includes('By using this platform'), 'End of agreement remains accessible')
    await click(terms.querySelector('.modal-close'))
    assert(!document.body.style.overflowY, 'Closing agreement cleans up lock')
    assert(document.querySelector('input[type="checkbox"]')?.checked === false, 'Opening agreement does not accept terms')
  })

  await run('Registration guards real OTP responses, preserves edits, and prevents duplicate submissions', async () => {
    await render(<MemoryRouter><CreateAccount /></MemoryRouter>)
    assert(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Registration fits viewport without horizontal overflow')
    assert(button('Continue').disabled, 'Empty profile cannot advance')
    fill('firstName', 'Ana'); fill('lastName', 'Cruz'); fill('email', 'invalid'); fill('mobile', '123')
    assert(button('Continue').disabled, 'Invalid profile cannot advance')
    fill('email', 'ana@example.com'); fill('mobile', '09164352483')
    await click(button('Continue'))
    assert(document.querySelector('#create-step-heading').textContent === 'Email Verification', 'Only next step is shown')
    const sendButton = button('Send OTP')
    if (window.innerWidth > 640) assert(sendButton.getBoundingClientRect().width < 200, 'Desktop OTP button remains compact')
    await click(sendButton)
    document.querySelectorAll('.create-otp-input').forEach(element => input(element, '1'))
    assert(button('Continue').disabled, 'Entering six digits does not imply verification')
    await click(button('Verify OTP'))
    assert(button('Continue').disabled && document.querySelector('[role="alert"]').textContent.includes('expired'), 'Rejected or expired OTP blocks progression')
    verificationAccepted = true
    await click(button('Verify OTP'))
    await new Promise(resolve => setTimeout(resolve, 1200))
    await click(button('Continue'))
    fill('password', 'test-password'); fill('confirmPassword', 'different')
    assert(button('Continue').disabled, 'Mismatched passwords block progression')
    fill('confirmPassword', 'test-password')
    await click(button('Continue'))
    for (const [name, value] of Object.entries({ barangay: 'Poblacion', city: 'Manila', province: 'Metro Manila', zip: '1000' })) fill(name, value)
    await click(button('Continue'))
    assert(!document.querySelector('.create-review').textContent.includes('test-password'), 'Review does not expose passwords')
    await click(button('Edit profile'))
    assert(document.getElementById('create-firstName').value === 'Ana', 'Back navigation preserves entered values')
    fill('email', 'new@example.com')
    assert(Array.from(document.querySelectorAll('.create-progress button')).slice(2).every(element => element.disabled), 'Changed email invalidates verification and future steps')
    await click(button('Continue'))
    await click(button('Send OTP'))
    document.querySelectorAll('.create-otp-input').forEach(element => input(element, '1'))
    await click(button('Verify OTP'))
    await new Promise(resolve => setTimeout(resolve, 1200))
    await click(button('Continue'))
    fill('password', 'test-password'); fill('confirmPassword', 'test-password')
    await click(button('Continue'))
    assert(document.getElementById('create-city').value === 'Manila', 'Delivery address is preserved during edits')
    await click(button('Continue'))
    holdRegistration = true
    const create = button('Create Account')
    await click(create); await click(create)
    assert(submitted.length === 1 && create.disabled, 'Duplicate registration is prevented')
    assert(submitted[0].email === 'new@example.com' && submitted[0].phone === '+639164352483' && submitted[0].verificationId === 'challenge-2', 'Existing registration payload and latest challenge are preserved')
    finishRegistration({}); await settle()
    assert(document.querySelector('#create-success-title'), 'Existing success popup is shown')
    flushSync(() => root.unmount())
    assert(!document.body.style.overflowY, 'Unmounting active popup cleans up lock')
  })
  const report = document.createElement('pre')
  report.id = 'qa-results'
  report.textContent = JSON.stringify({ width: innerWidth, results })
  document.body.append(report)
}
`

await mkdir('node_modules/.cache/frontend-qa', { recursive: true })
const outputDir = await mkdtemp(path.resolve('node_modules/.cache/frontend-qa/run-'))
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'frontend-qa.jsx', loader: 'jsx' },
  bundle: true, write: false, format: 'esm', jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'test-auth', setup(build) {
    build.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ contents: 'export const useAuth = () => window.qaAuth', loader: 'js' }))
  } }],
})
const css = (await readFile('src/index.css', 'utf8')).replace(/^@import[^\r\n]*[\r\n]*/gm, '')
const logo = await readFile('public/logo.svg')
const introImage = await readFile('public/iconintro.png')
const server = createServer((req, res) => {
  if (req.url === '/iconintro.png') {
    res.setHeader('Content-Type', 'image/png')
    res.end(introImage)
    return
  }
  if (req.url === '/logo.svg') {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.end(logo)
    return
  }
  res.setHeader('Content-Type', req.url === '/bundle.js' ? 'text/javascript' : 'text/html')
  res.end(req.url === '/bundle.js' ? bundle.outputFiles[0].text : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="fixture"></div><script type="module" src="/bundle.js"></script>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}`
const edge = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
async function browser(args, profile) {
  const profilePath = path.join(outputDir, profile)
  const [width, height] = args.find(arg => arg.startsWith('--window-size=')).split('=')[1].split(',').map(Number)
  const screenshotPath = args.find(arg => arg.startsWith('--screenshot='))?.slice('--screenshot='.length)
  const pageUrl = args.at(-1)
  const child = spawn(edge, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', `--user-data-dir=${profilePath}`, '--remote-debugging-port=0', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let socket
  let processError
  child.on('error', error => { processError = error })
  const timeout = setTimeout(() => child.kill(), 45000)
  try {
    let port
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (processError) throw processError
      try { port = Number((await readFile(path.join(profilePath, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { /* Browser is starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!port) throw new Error('Headless browser did not start')
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let nextId = 0
    const pending = new Map()
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      const promise = pending.get(message.id)
      if (!promise) return
      pending.delete(message.id)
      if (message.error) promise.reject(new Error(message.error.message))
      else promise.resolve(message.result)
    })
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 640 })
    await call('Emulation.setTouchEmulationEnabled', { enabled: width < 640 })
    await call('Emulation.setFocusEmulationEnabled', { enabled: true })
    await call('Page.navigate', { url: pageUrl })
    const selector = screenshotPath
      ? pageUrl.includes('preview=terms') ? '.terms-modal' : pageUrl.includes('preview=intro') ? '.brand-intro__logo' : '.create-account-page'
      : '#qa-results'
    const ready = await call('Runtime.evaluate', {
      expression: `new Promise((resolve, reject) => { const deadline = Date.now() + 20000; const check = () => document.querySelector(${JSON.stringify(selector)}) ? resolve(true) : Date.now() > deadline ? reject(new Error('Fixture did not finish')) : setTimeout(check, 50); check(); })`,
      awaitPromise: true, returnByValue: true,
    })
    if (ready.exceptionDetails) throw new Error(ready.exceptionDetails.exception?.description || 'Browser fixture failed')
    let html = ''
    if (screenshotPath) {
      await call('Runtime.evaluate', { expression: 'new Promise(resolve => setTimeout(resolve, 350))', awaitPromise: true })
      const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
    } else {
      html = (await call('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true })).result.value
    }
    await call('Browser.close')
    return html
  } finally {
    clearTimeout(timeout)
    socket?.close()
    if (child.exitCode === null) child.kill()
  }
}
try {
  for (const width of [1440, 390]) {
    const html = await browser([`--window-size=${width},1000`, '--virtual-time-budget=10000', '--dump-dom', url], `tests-${width}`)
    const match = html.match(/<pre id="qa-results">([\s\S]*?)<\/pre>/)
    if (!match) throw new Error('No browser QA results returned')
    const report = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    console.log(JSON.stringify(report))
    if (report.results.some(result => !result.passed)) process.exitCode = 1
  }
  for (const [name, width, preview] of [
    ['intro-start', 1440, 'intro&frame=600'], ['intro-trace', 1440, 'intro&frame=1500'],
    ['intro-complete', 1440, 'intro&frame=2600'], ['intro-mobile', 390, 'intro&frame=2600'],
    ['terms-desktop', 1440, 'terms'],
  ]) {
    await browser([`--window-size=${width},1000`, '--virtual-time-budget=1500', `--screenshot=${path.join(outputDir, name + '.png')}`, `${url}/?preview=${preview}`], name)
  }
  console.log(`Screenshots: ${outputDir}`)
} finally {
  server.closeAllConnections()
  server.close()
}
