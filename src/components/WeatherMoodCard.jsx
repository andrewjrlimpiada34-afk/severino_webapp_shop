function WeatherMoodCard({ current, usingDefault = false, locationLabel = 'Marinduque' }) {
  if (!current) return null

  return (
    <div className="weather-mood-card">
      <div className="weather-mood-card__icon" aria-hidden="true">
        {current.profile.icon}
      </div>
      <div>
        <div className="tag">Today's Weather Mood</div>
        <h3>{current.profile.label}</h3>
        <p>
          {current.temperature}&deg;C - {current.humidity}% humidity - Rain {current.rain} mm
        </p>
        {usingDefault && <span className="pill">Using default location: {locationLabel}</span>}
      </div>
    </div>
  )
}

export default WeatherMoodCard
