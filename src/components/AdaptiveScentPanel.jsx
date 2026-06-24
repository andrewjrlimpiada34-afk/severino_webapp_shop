import { SkeletonLine } from './Skeleton.jsx'
import ScentForecastCard from './ScentForecastCard.jsx'
import WeatherMoodCard from './WeatherMoodCard.jsx'

function AdaptivePanelSkeleton() {
  return (
    <div className="adaptive-panel card mood-loading">
      <div className="adaptive-panel__header">
        <div>
          <SkeletonLine width="160px" height={16} />
          <SkeletonLine width="260px" height={34} />
        </div>
        <SkeletonLine width="110px" height={34} className="skeleton-pill" />
      </div>
      <div className="adaptive-forecast-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={`adaptive-skeleton-${index}`} className="scent-forecast-card">
            <SkeletonLine width="70%" height={18} />
            <SkeletonLine width="90%" />
            <SkeletonLine width="60%" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AdaptiveScentPanel({
  enabled,
  loading,
  error,
  current,
  dailyForecast,
  recommendations,
  usingDefault,
  onUseDefault,
  onContinueWithout,
  onViewProduct,
}) {
  if (!enabled) return null
  if (loading) return <AdaptivePanelSkeleton />

  if (error) {
    return (
      <div className="adaptive-panel card mood-error">
        <div className="adaptive-panel__header">
          <div>
            <div className="tag">Adaptive Scent Forecast</div>
            <h2>Location needed</h2>
            <p className="section-subtitle">{error}</p>
          </div>
        </div>
        <div className="adaptive-actions">
          <button className="button" type="button" onClick={onUseDefault}>
            Use default location
          </button>
          <button className="button secondary" type="button" onClick={onContinueWithout}>
            Continue without Adaptive Scent
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null

  return (
    <section className={`adaptive-panel card mood-${current.mood}`}>
      <div className="adaptive-panel__header">
        <div>
          <div className="tag">Adaptive Scent Forecast</div>
          <h2>Recommended for this week’s weather</h2>
          <p className="section-subtitle">
            Matched using forecast conditions and each perfume’s notes.
          </p>
        </div>
      </div>

      <WeatherMoodCard current={current} usingDefault={usingDefault} />

      <div className="adaptive-forecast-grid">
        {dailyForecast.map((day) => (
          <ScentForecastCard key={day.date} day={day} />
        ))}
      </div>

      <div className="adaptive-recommendations">
        <div>
          <div className="tag">Adaptive Picks</div>
          <h3>Recommended Products</h3>
        </div>

        {recommendations.length === 0 ? (
          <p className="section-subtitle">
            No strong note match yet. Try adding clearer scent notes like citrus, musk, amber, or
            aquatic in product details.
          </p>
        ) : (
          <div className="adaptive-product-grid">
            {recommendations.map(({ product, matchedNotes, reason }) => (
              <button
                key={product.id}
                className="adaptive-product-card"
                type="button"
                onClick={() => onViewProduct(product.id)}
              >
                <div
                  className="adaptive-product-card__image"
                  style={{
                    backgroundImage: `url(${product.imageUrls?.[0] || product.imageUrl || ''})`,
                  }}
                />
                <div>
                  <span className="adaptive-pick-badge">Adaptive Pick</span>
                  <strong>{product.name}</strong>
                  <p>{reason}</p>
                  <small>Matched: {matchedNotes.slice(0, 4).join(', ')}</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default AdaptiveScentPanel
