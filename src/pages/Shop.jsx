import Modal from '../components/Modal.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import QuantityControl from '../components/QuantityControl.jsx'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getFavorites, toggleFavorite } from '../lib/favorites.js'
import StoreProductCard, { StoreCatalogSkeleton } from '../components/StoreProductCard.jsx'
import StoreIcon from '../components/StoreIcon.jsx'
import AdaptiveScentFloating from '../components/AdaptiveScentFloating.jsx'
import useAdaptiveScent from '../hooks/useAdaptiveScent.js'
import { useActionAnimation } from '../context/useActionAnimation.js'
import useInventoryStock from '../hooks/useInventoryStock.js'
import { withInventoryStock } from '../lib/inventoryStore.js'

function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const categoryParam = searchParams.get('category')
  const category = ['Men', 'Women', 'Unisex'].includes(categoryParam) ? categoryParam : 'all'
  const [sort, setSort] = useState('default')
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('severino_shop_view') === 'list' ? 'list' : 'grid' }
    catch { return 'grid' }
  })
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [catalog, setItems] = useState([])
  const stocks = useInventoryStock()
  const items = useMemo(() => catalog.map((item) => withInventoryStock(item, stocks)), [catalog, stocks])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])
  const adaptive = useAdaptiveScent(items)
  const { playActionAnimation } = useActionAnimation()

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const base = normalizedQuery
      ? items.filter((product) => `${product.name} ${product.notes || ''}`.toLowerCase().includes(normalizedQuery))
      : items

    const categoryFiltered =
      category === 'all'
        ? base
        : base.filter((product) => (product.category || 'Unisex') === category)

    const minValue = minPrice === '' ? null : Number(minPrice)
    const maxValue = maxPrice === '' ? null : Number(maxPrice)
    const resolvedMin = Number.isFinite(minValue) ? minValue : Number.NEGATIVE_INFINITY
    const resolvedMax = Number.isFinite(maxValue) ? maxValue : Number.POSITIVE_INFINITY
    const priceFiltered = categoryFiltered.filter(
      (product) => product.price >= resolvedMin && product.price <= resolvedMax
    )

    if (sort === 'price-low') {
      return [...priceFiltered].sort((a, b) => a.price - b.price)
    }
    if (sort === 'price-high') {
      return [...priceFiltered].sort((a, b) => b.price - a.price)
    }
    if (sort === 'popularity') {
      return [...priceFiltered].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    }
    return priceFiltered
  }, [items, query, sort, maxPrice, minPrice, category])

  const loadProducts = async () => {
    try {
      setStatus({ loading: true, error: '' })
      const data = await api.products()
      setItems(data)
      setStatus({ loading: false, error: '' })
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    }
  }

  const [cartModal, setCartModal] = useState({ open: false, product: null, quantity: 1 })
  const [cartQuantity, setCartQuantity] = useState(0)
  const [cartBusy, setCartBusy] = useState(false)
  const cartPending = useRef(false)
  const modalProduct = withInventoryStock(cartModal.product, stocks)

  const openAddToCartModal = async (productId) => {
    if (cartPending.current) return
    const product = items.find((item) => item.id === productId)
    if (!product || product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      return
    }
    setStatus((prev) => ({ ...prev, error: '' }))
    setCartModal({
      open: true,
      product,
      quantity: 1,
    })
    cartPending.current = true
    setCartBusy(true)
    try {
      const cart = user ? await api.cart() : { items: [] }
      setCartQuantity(cart.items.filter((item) => item.productId === product.id || item.productId === product.legacyId).reduce((sum, item) => sum + item.quantity, 0))
    } catch (error) { setStatus((previous) => ({ ...previous, error: error.message })); setCartModal({ open: false, product: null, quantity: 1 }) }
    finally { cartPending.current = false; setCartBusy(false) }
  }

  const closeAddToCartModal = () => {
    if (cartPending.current) return
    setCartModal({ open: false, product: null, quantity: 1 })
  }

  const addToCartWithQuantity = async () => {
    if (cartPending.current) return
    if (!user) {
      navigate('/login')
      return
    }
    const product = modalProduct
    if (!product || product.stock <= 0) {
      setStatus((prev) => ({ ...prev, error: 'Out of stock.' }))
      closeAddToCartModal()
      return
    }

    const desiredQty = Number(cartModal.quantity) || 1
    const qtyToAdd = Math.max(1, Math.min(Math.max(0, Math.min(100, product.stock) - cartQuantity), desiredQty))

    cartPending.current = true
    setCartBusy(true)
    try {
      const cart = await api.cart()
      const existing = cart.items.find((item) => item.productId === product.id)
      const remaining = Math.min(100, product.stock) - (existing?.quantity || 0)
      setCartQuantity(existing?.quantity || 0)
      if (qtyToAdd > remaining || remaining < 1) throw new Error('Maximum stock reached. Review the quantity already in your cart.')
      const nextItems = existing
        ? cart.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.min(100, Math.min(product.stock, item.quantity + qtyToAdd)) }
              : item
          )
        : [...cart.items, { productId: product.id, quantity: qtyToAdd }]

      await api.updateCart(nextItems)
      setCartModal({ open: false, product: null, quantity: 1 })
      setStatus((previous) => ({ ...previous, success: `${product.name} added to your cart.` }))
      playActionAnimation('cart')
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message }))
    } finally { cartPending.current = false; setCartBusy(false) }
  }


  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    setFavorites(getFavorites(user?.id))
  }, [user])

  const maxQty = modalProduct ? Math.max(0, Math.min(100, modalProduct.stock) - cartQuantity) : 0

  const updateSearchParam = (key, value) => setSearchParams((previous) => {
    const next = new URLSearchParams(previous)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    return next
  }, { replace: true })

  const changeView = (next) => {
    setView(next)
    try { localStorage.setItem('severino_shop_view', next) } catch { /* The view still works when storage is unavailable. */ }
  }

  const clearFilters = () => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('q')
      next.delete('category')
      return next
    }, { replace: true })
    setMinPrice('')
    setMaxPrice('')
  }
  const hasFilters = Boolean(query || category !== 'all' || minPrice !== '' || maxPrice !== '')

  return (
    <section className="boutique-page boutique-shop">
      <header className="store-page-heading">
        <span className="store-eyebrow">The Severino collection</span>
        <h1>Shop the collection</h1>
        <p>Your next signature scent is waiting to be discovered.</p>
      </header>

      <AdaptiveScentFloating adaptive={adaptive} onViewProduct={(productId) => navigate(`/product/${productId}`)} />

      <div className="store-shop-controls">
        <div className="store-shop-toolbar">
          <label className="store-search-field" htmlFor="shop-search">
            <StoreIcon name="search" />
            <input className="input" id="shop-search" type="search" placeholder="Search scents or notes..." aria-label="Search scents or notes" value={query} onChange={(event) => updateSearchParam('q', event.target.value)} />
          </label>
          <button className={`button secondary store-filter-toggle ${filtersOpen ? 'is-active' : ''}`} type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="shop-filter-options"><StoreIcon name="filter" />Filters{(category !== 'all' || minPrice !== '' || maxPrice !== '') && <span className="store-filter-indicator" />}</button>
          <label className="store-sort-field" htmlFor="shop-sort"><span>Sort:</span><select className="input" id="shop-sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">Featured</option><option value="popularity">Popularity</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option></select></label>
          <div className="store-view-toggle" role="group" aria-label="Product view">
            <button type="button" onClick={() => changeView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view"><StoreIcon name="grid" /><span>Grid</span></button>
            <button type="button" onClick={() => changeView('list')} aria-pressed={view === 'list'} aria-label="List view"><StoreIcon name="list" /><span>List</span></button>
          </div>
        </div>
        {filtersOpen && <div className="store-filter-options" id="shop-filter-options">
          <div className="store-field"><label htmlFor="shop-category">Category</label><select className="input" id="shop-category" value={category} onChange={(event) => updateSearchParam('category', event.target.value)}><option value="all">All scents</option><option value="Men">Men</option><option value="Women">Women</option><option value="Unisex">Unisex</option></select></div>
          <div className="store-field"><label htmlFor="shop-min-price">Minimum price</label><input className="input" id="shop-min-price" type="number" min="0" placeholder="₱ 0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></div>
          <div className="store-field"><label htmlFor="shop-max-price">Maximum price</label><input className="input" id="shop-max-price" type="number" min="0" placeholder="No maximum" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></div>
        </div>}
        <div className="store-results-row">
          <span role="status" aria-live="polite">{status.loading ? 'Discovering scents...' : `${filtered.length} ${filtered.length === 1 ? 'fragrance' : 'fragrances'}`}</span>
          {category !== 'all' && <button className="store-filter-chip" type="button" onClick={() => updateSearchParam('category', '')} aria-label={`Remove ${category} category filter`}>{category}<StoreIcon name="close" /></button>}
          {query && <button className="store-filter-chip" type="button" onClick={() => updateSearchParam('q', '')} aria-label="Clear search">{query}<StoreIcon name="close" /></button>}
          {minPrice !== '' && <button className="store-filter-chip" type="button" onClick={() => setMinPrice('')} aria-label="Remove minimum price">From ₱{Number(minPrice).toLocaleString('en-PH')}<StoreIcon name="close" /></button>}
          {maxPrice !== '' && <button className="store-filter-chip" type="button" onClick={() => setMaxPrice('')} aria-label="Remove maximum price">Up to ₱{Number(maxPrice).toLocaleString('en-PH')}<StoreIcon name="close" /></button>}
          {hasFilters && <button className="store-clear-filters" type="button" onClick={clearFilters}>Clear all</button>}
        </div>
      </div>

      {status.loading && <StoreCatalogSkeleton view={view} count={8} />}
      {status.error && <div className="store-notice" role="alert"><span>{status.error}</span><button className="store-text-link" type="button" onClick={loadProducts}>Try again</button></div>}
      {status.success && <div className="store-notice" role="status">{status.success}</div>}
      {!status.loading && filtered.length > 0 && <div className={`store-catalog store-${view}`}>
        {filtered.map((product) => <StoreProductCard key={product.id} product={product} view={view} favorite={favorites.includes(product.id)} adaptivePick={adaptive.enabled && adaptive.adaptiveData.recommendationIds.has(product.id)} onAdd={() => openAddToCartModal(product.id)} onFavorite={() => {
          if (!user) { navigate('/login'); return }
          const wasFavorite = favorites.includes(product.id)
          const next = toggleFavorite(product.id, user.id)
          setFavorites(next)
          if (!wasFavorite && next.includes(product.id)) playActionAnimation('favorite')
        }} />)}
      </div>}
      {!status.loading && !status.error && filtered.length === 0 && <div className="store-empty-state"><StoreIcon name="search" /><h2>{hasFilters ? 'No scents found' : 'A new scent story is on its way'}</h2><p>{hasFilters ? 'Try another name or adjust your filters to find your next favorite.' : 'Our collection will be here soon. Check back for something special.'}</p>{hasFilters && <button className="button secondary" type="button" onClick={clearFilters}>Clear filters</button>}</div>}

      {cartModal.open && cartModal.product && (
        <Modal>
          <div className="modal-card store-cart-modal" role="dialog" aria-modal="true" aria-labelledby="shop-cart-title">
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={closeAddToCartModal}
            >
              X
            </button>

            <div className="tag">Add to Cart</div>
            <h2 id="shop-cart-title" className="section-title" style={{ fontSize: '28px', marginTop: '10px' }}>
              {cartModal.product.name}
            </h2>
            <p className="section-subtitle">{maxQty > 0 ? 'Select quantity' : 'This item is now out of stock.'}</p>

            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
              <QuantityControl value={cartModal.quantity} maximum={maxQty} disabled={cartBusy} onChange={(quantity) => setCartModal((previous) => ({ ...previous, quantity }))} />
              {cartQuantity > 0 && <p>{cartQuantity} already in your cart.</p>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="button secondary" type="button" onClick={closeAddToCartModal}>
                  Cancel
                </button>
                <button className="button" type="button" disabled={cartBusy || maxQty <= 0} onClick={addToCartWithQuantity}>
                  {cartBusy ? 'Please wait…' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}


export default Shop
