import { Link } from 'react-router-dom'
import { buildCloudinarySrcSet } from '../lib/image.js'
import StoreIcon from './StoreIcon.jsx'

export function StoreCatalogSkeleton({ view = 'grid', count = 4 }) {
  return <div className={`store-catalog store-${view}`} role="status" aria-label="Loading fragrances" aria-busy="true">
    {Array.from({ length: count }, (_, index) => <div key={index} className="store-product store-product-skeleton" aria-hidden="true"><div className="store-product-media skeleton" /><div className="store-product-info"><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line" /></div><div className="store-product-purchase"><span className="skeleton skeleton-line" /></div></div>)}
  </div>
}

export default function StoreProductCard({ product, favorite, onFavorite, onAdd, adaptivePick = false, view = 'grid' }) {
  const image = product.imageUrls?.[0] || product.imageUrl
  const path = `/product/${product.id}`
  return (
    <article className={`store-product${onFavorite ? ' has-favorite' : ''}`}>
      <div className="store-product-media">
        <Link className="store-product-image" to={path} aria-label={`View ${product.name}`}>
          {image ? <img src={image} srcSet={buildCloudinarySrcSet(image)} sizes="(max-width: 640px) 46vw, (max-width: 1023px) 30vw, 300px" alt={product.name} loading="lazy" decoding="async" /> : <StoreIcon name="bottle" className="store-product-placeholder" />}
        </Link>
        {adaptivePick && <span className="store-adaptive-badge">Adaptive Pick</span>}
      </div>
      {onFavorite && <button className={`store-favorite ${favorite ? 'is-favorite' : ''}`} type="button" onClick={onFavorite} aria-label={`${favorite ? 'Remove' : 'Save'} ${product.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite}><StoreIcon name="heart" fill={favorite ? 'currentColor' : 'none'} /></button>}
      <div className="store-product-info">
        <h3><Link to={path}>{product.name}</Link></h3>
        <p className="store-product-notes">{product.notes || 'Discover your next signature scent.'}</p>
        <span className="store-product-size">{product.size}{product.stock <= 0 && <span className="store-stock-label"> · Out of stock</span>}</span>
      </div>
      <div className="store-product-purchase">
        <strong className="store-product-price">₱{Number(product.price).toLocaleString('en-PH')}</strong>
        <div className="store-product-actions">
          {onAdd && <button className="button store-add-button" type="button" onClick={onAdd} disabled={product.stock <= 0} aria-label={`Add ${product.name} to cart`}><StoreIcon name="cart" /><span>{product.stock <= 0 ? 'Sold out' : 'Add to Cart'}</span></button>}
          {view !== 'list' && <Link className="store-text-link store-product-details" to={path}>View details<StoreIcon name="arrow" /></Link>}
        </div>
      </div>
    </article>
  )
}
