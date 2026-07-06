function formatDay(date) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(date)
  )
}

function ScentForecastCard({ day }) {
  return (
    <div className={`scent-forecast-card mood-${day.mood}`}>
      <div className="scent-forecast-card__top">
        <span>{day.profile.icon}</span>
        <strong>{formatDay(day.date)}</strong>
      </div>
      <div>{day.profile.label}</div>
      <p>
        {day.minTemp}&deg;-{day.maxTemp}&deg;C - {day.precipitationProbability}% rain
      </p>
    </div>
  )
}

export default ScentForecastCard
