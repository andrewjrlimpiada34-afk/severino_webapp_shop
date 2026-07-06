import AdaptiveScentToggle from './AdaptiveScentToggle.jsx'
import { SkeletonLine } from './Skeleton.jsx'
import ScentForecastCard from './ScentForecastCard.jsx'
import WeatherMoodCard from './WeatherMoodCard.jsx'

function AdaptivePanelSkeleton({ locationLabel, onUseDefaultLocation }) {
  return (
    <div className="adaptive-panel__body mood-loading">
      <div className="adaptive-panel__header">
        <div>
          <div className="tag">Adaptive Scent Forecast</div>
          <h2>Checking your weather...</h2>
          <p className="section-subtitle">
            Allow location access, or use {locationLabel}'s default forecast.
          </p>
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
      <button className="button adaptive-default-button" type="button" onClick={onUseDefaultLocation}>
        Use Default Location
      </button>
    </div>
  )
}

function AdaptiveScentPanel({
  enabled,
  onToggleEnabled,
  loading,
  error,
  current,
  dailyForecast,
  recommendations,
  usingDefault,
  locationLabel = 'Marinduque',
  onUseDefaultLocation,
  onViewProduct,
}) {
  const moodClass = current ? `mood-${current.mood}` : 'mood-loading'

  return (
    <section className={`adaptive-panel card ${moodClass}`}>
      <AdaptiveScentToggle enabled={enabled} onChange={onToggleEnabled} compact />

      {!enabled && (
        <div className="adaptive-panel__body adaptive-panel__body--idle">
          <div className="adaptive-idle-content">
            <div className="adaptive-idle-copy">
              <div className="tag">Adaptive Scent Forecast</div>
              <h2>Find scents for your weather</h2>
              <p className="section-subtitle">
                Turn this on to allow location access, or use {locationLabel}'s default forecast now.
              </p>
            </div>
            <img
              className="adaptive-idle-art"
              src="/adaptivescent.svg"
              alt=""
              aria-hidden="true"
            />
          </div>
          <button className="button adaptive-default-button" type="button" onClick={onUseDefaultLocation}>
            Use Default Location
          </button>
        </div>
      )}

      {enabled && loading && (
        <AdaptivePanelSkeleton
          locationLabel={locationLabel}
          onUseDefaultLocation={onUseDefaultLocation}
        />
      )}

      {enabled && error && (
        <div className="adaptive-panel__body mood-error">
          <div className="adaptive-panel__header">
            <div>
              <div className="tag">Adaptive Scent Forecast</div>
              <h2>Weather unavailable</h2>
              <p className="section-subtitle">{error}</p>
            </div>
          </div>
          <button className="button adaptive-default-button" type="button" onClick={onUseDefaultLocation}>
            Use Default Location
          </button>
        </div>
      )}

      {enabled && current && (
        <div className="adaptive-panel__body">
        <div className="adaptive-panel__header">
          <div>
            <div className="tag">Adaptive Scent Forecast</div>
            <h2>Recommended for this week's weather</h2>
            <p className="section-subtitle">
              {usingDefault
                ? `Using default location: ${locationLabel}. Based on the local weather forecast.`
                : "Matched using forecast conditions and each perfume's notes."}
            </p>
          </div>
        </div>

        <WeatherMoodCard current={current} usingDefault={usingDefault} locationLabel={locationLabel} />

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
      </div>
      )}
    </section>
  )
}

export default AdaptiveScentPanel
