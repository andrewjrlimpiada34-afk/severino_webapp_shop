const modals = []
let restorePage
let pageFocus
let touchPosition

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function activeModal() {
  return modals.reduce((top, modal) => {
    if (!top) return modal
    return Number(getComputedStyle(modal.element).zIndex) >= Number(getComputedStyle(top.element).zIndex)
      ? modal
      : top
  }, null)
}

function focusableElements(modal) {
  return Array.from(modal.element.querySelectorAll(focusableSelector)).filter(
    (element) => element.getClientRects().length && !element.closest('[inert]')
  )
}

function focusModal(modal) {
  const target = focusableElements(modal)[0] || modal.card
  target.focus({ preventScroll: true })
}

function scrollContainer(target, deltaX, deltaY) {
  const modal = activeModal()
  if (!modal || !(target instanceof Element) || target === modal.element || !modal.element.contains(target)) return null
  const horizontal = Math.abs(deltaX) > Math.abs(deltaY)
  const delta = horizontal ? deltaX : deltaY
  let element = target

  while (element && element !== modal.element) {
    const style = getComputedStyle(element)
    const overflow = horizontal ? style.overflowX : style.overflowY
    const position = horizontal ? element.scrollLeft : element.scrollTop
    const remaining = horizontal
      ? element.scrollWidth - element.clientWidth - position
      : element.scrollHeight - element.clientHeight - position
    if (/(auto|scroll)/.test(overflow) && (delta < 0 ? position > 0 : remaining > 1)) return element
    element = element.parentElement
  }
  return null
}

function handleWheel(event) {
  if (event.ctrlKey || event.defaultPrevented) return
  const modal = activeModal()
  if (modal?.element.contains(event.target) && event.target.closest('select, input[type="number"]')) return
  if (!scrollContainer(event.target, event.deltaX, event.deltaY)) event.preventDefault()
}

function handleTouchStart(event) {
  touchPosition = event.touches.length === 1 ? event.touches[0] : null
}

function handleTouchMove(event) {
  if (!touchPosition || event.touches.length !== 1 || event.defaultPrevented) return
  const touch = event.touches[0]
  const deltaX = touchPosition.clientX - touch.clientX
  const deltaY = touchPosition.clientY - touch.clientY
  touchPosition = touch
  const modal = activeModal()
  if (modal?.element.contains(event.target) && event.target.closest('input[type="range"], [role="slider"]')) return
  if (!scrollContainer(event.target, deltaX, deltaY)) event.preventDefault()
}

function handleFocus(event) {
  const modal = activeModal()
  if (modal && !modal.element.contains(event.target)) focusModal(modal)
}

function handleKeyDown(event) {
  const modal = activeModal()
  if (!modal || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target instanceof Element ? event.target : document.activeElement
  if (event.key === 'Tab') {
    const elements = focusableElements(modal)
    const index = elements.indexOf(document.activeElement)
    if (!elements.length || (event.shiftKey ? index <= 0 : index === elements.length - 1 || index < 0)) {
      event.preventDefault()
      const nextFocus = (event.shiftKey ? elements.at(-1) : elements[0]) || modal.card
      nextFocus.focus({ preventScroll: true })
    }
    return
  }
  if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]')) return
  if (event.key === ' ' && target.closest('button, [role="button"]')) return
  const directions = { ArrowUp: -1, ArrowDown: 1, PageUp: -1, PageDown: 1, Home: -1, End: 1, ' ': event.shiftKey ? -1 : 1 }
  const direction = directions[event.key]
  if (!direction) return
  event.preventDefault()
  const container = scrollContainer(target === modal.element ? modal.card : target, 0, direction)
  if (container) {
    const distance = event.key.startsWith('Arrow') ? 40
      : event.key === 'Home' || event.key === 'End' ? container.scrollHeight
        : container.clientHeight * 0.9
    container.scrollTop += direction * distance
  }
}

function preserveStyles(element, properties) {
  const styles = properties.map((property) => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)])
  return () => styles.forEach(([property, value, priority]) => {
    if (value) element.style.setProperty(property, value, priority)
    else element.style.removeProperty(property)
  })
}

function lockPage() {
  const body = document.body
  const root = document.documentElement
  const { scrollX, scrollY } = window
  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)
  const paddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0
  const restoreBody = preserveStyles(body, ['overflow', 'overflow-x', 'overflow-y', 'padding-right'])
  const restoreRoot = preserveStyles(root, ['overflow', 'overflow-x', 'overflow-y'])
  const restoreScrollBehavior = preserveStyles(root, ['scroll-behavior'])

  root.style.scrollBehavior = 'auto'
  root.style.overflow = 'hidden'
  // Keep the document in place so sticky headers retain their viewport position.
  // Non-passive touch guards also block Safari's background scroll and rubber banding.
  Object.assign(body.style, {
    overflow: CSS.supports('overflow', 'clip') ? 'clip' : 'hidden',
    paddingRight: `${paddingRight + scrollbarWidth}px`,
  })
  document.addEventListener('wheel', handleWheel, { passive: false, capture: true })
  document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true })
  document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('focusin', handleFocus, true)

  return () => {
    document.removeEventListener('wheel', handleWheel, true)
    document.removeEventListener('touchstart', handleTouchStart, true)
    document.removeEventListener('touchmove', handleTouchMove, true)
    document.removeEventListener('keydown', handleKeyDown, true)
    document.removeEventListener('focusin', handleFocus, true)
    touchPosition = null
    restoreBody()
    restoreRoot()
    window.scrollTo(scrollX, scrollY)
    restoreScrollBehavior()
  }
}

// Each mounted overlay owns a lock, so closing one cannot unlock another.
export function lockModalScroll(element) {
  const card = element.querySelector('.modal-card') || element
  const previousTabIndex = card.getAttribute('tabindex')
  const modal = { element, card, previousFocus: document.activeElement }
  if (previousTabIndex === null) card.setAttribute('tabindex', '-1')
  if (!modals.length) {
    pageFocus = document.activeElement
    restorePage = lockPage()
  }
  modals.push(modal)
  if (activeModal() === modal) focusModal(modal)
  let released = false

  return () => {
    if (released) return
    released = true
    const wasActive = activeModal() === modal
    modals.splice(modals.indexOf(modal), 1)
    if (previousTabIndex === null) card.removeAttribute('tabindex')
    if (!modals.length) {
      restorePage()
      restorePage = null
    }
    if (wasActive) {
      const next = activeModal()
      const previousFocus = next ? modal.previousFocus : pageFocus
      if (previousFocus?.isConnected && !previousFocus.matches(':disabled') && (!next || next.element.contains(previousFocus))) {
        previousFocus.focus({ preventScroll: true })
      } else if (next) focusModal(next)
      else {
        const fallback = previousFocus?.closest('form')?.querySelector(focusableSelector)
        fallback?.focus({ preventScroll: true })
      }
    }
    if (!modals.length) pageFocus = null
  }
}
