function SkeletonLine({ width = '100%', height = 14, className = '' }) {
  return (
    <span
      className={`skeleton skeleton-line ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

function ProductCardSkeleton() {
  return (
    <article className="product-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-product-image" />
      <div className="skeleton-stack">
        <SkeletonLine width="72%" height={22} />
        <SkeletonLine width="56%" />
      </div>
      <SkeletonLine width="70px" height={34} className="skeleton-pill" />
      <div className="skeleton-row">
        <SkeletonLine width="62px" height={22} />
        <div className="skeleton-actions">
          <span className="skeleton skeleton-circle" />
          <span className="skeleton skeleton-button" />
          <span className="skeleton skeleton-circle" />
        </div>
      </div>
    </article>
  )
}

function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid four shop-product-grid skeleton-grid" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={`product-skeleton-${index}`} />
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <section className="grid" style={{ gap: '24px' }} aria-label="Loading product">
      <div className="grid two">
        <div className="card skeleton-detail-card" aria-hidden="true">
          <div className="skeleton skeleton-detail-image" />
          <div className="skeleton-thumb-row">
            <span className="skeleton skeleton-thumb" />
            <span className="skeleton skeleton-thumb" />
            <span className="skeleton skeleton-thumb" />
          </div>
        </div>
        <div className="card skeleton-detail-card" aria-hidden="true">
          <SkeletonLine width="84px" height={24} className="skeleton-pill" />
          <SkeletonLine width="72%" height={42} />
          <SkeletonLine width="94%" />
          <SkeletonLine width="66%" />
          <SkeletonLine width="92px" height={30} className="skeleton-pill" />
          <div className="skeleton-button-row">
            <span className="skeleton skeleton-wide-button" />
            <span className="skeleton skeleton-wide-button" />
            <span className="skeleton skeleton-circle" />
          </div>
        </div>
      </div>
    </section>
  )
}

function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card skeleton-card" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine
          key={`line-skeleton-${index}`}
          width={index === lines - 1 ? '58%' : '100%'}
          height={index === 0 ? 20 : 14}
        />
      ))}
    </div>
  )
}

export { CardSkeleton, DetailSkeleton, ProductGridSkeleton, SkeletonLine }
