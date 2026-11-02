// One stock stream is shared by every mounted catalog/cart component.
export function createInventoryStore({ loadProducts, createSource, eventTarget, documentTarget }) {
  let stocks = new Map()
  let generation = 0
  let source
  let closeTimer
  let refreshing
  let refreshAgain = false
  const subscribers = new Set()
  const emit = () => subscribers.forEach((subscriber) => subscriber())

  const apply = (products) => {
    const next = new Map(stocks)
    products.forEach((product) => {
      if (!product?.id || !Number.isInteger(product.stock) || product.stock < 0) return
      next.set(String(product.id), product.stock)
      if (product.legacyId) next.set(String(product.legacyId), product.stock)
    })
    stocks = next
    emit()
  }

  const refresh = () => {
    if (refreshing) return refreshing
    const version = generation
    refreshing = Promise.resolve().then(loadProducts).then((products) => {
      if (version === generation && subscribers.size && Array.isArray(products)) apply(products)
    }).catch(() => {
      // Preserve the last known stock; reconnect/focus will try again.
    }).finally(() => {
      refreshing = undefined
      if (refreshAgain && subscribers.size) { refreshAgain = false; refresh() }
    })
    return refreshing
  }

  const focus = () => { if (!documentTarget || documentTarget.visibilityState === 'visible') refresh() }
  const connect = () => {
    source = createSource()
    source.onopen = () => { if (refreshing) refreshAgain = true; else refresh() }
    source.addEventListener('stock', (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (!Array.isArray(payload.products)) return
        generation += 1
        // Re-read committed stock instead of trusting event arrival order.
        // A burst of events shares one request plus at most one follow-up.
        if (refreshing) refreshAgain = true
        else refresh()
      } catch { /* Ignore malformed stock messages. */ }
    })
    eventTarget?.addEventListener('focus', focus)
    documentTarget?.addEventListener('visibilitychange', focus)
  }

  const subscribe = (subscriber) => {
    clearTimeout(closeTimer)
    subscribers.add(subscriber)
    if (!source) connect()
    return () => {
      subscribers.delete(subscriber)
      if (!subscribers.size) {
        closeTimer = setTimeout(() => {
          if (subscribers.size) return
          generation += 1
          stocks = new Map()
          refreshAgain = false
          source?.close()
          source = undefined
          eventTarget?.removeEventListener('focus', focus)
          documentTarget?.removeEventListener('visibilitychange', focus)
        }, 0)
      }
    }
  }

  return { subscribe, getSnapshot: () => stocks, refresh }
}

export function withInventoryStock(product, stocks) {
  if (!product) return product
  const stock = stocks.get(String(product.id)) ?? stocks.get(String(product.legacyId))
  return stock === undefined || stock === product.stock ? product : { ...product, stock }
}
