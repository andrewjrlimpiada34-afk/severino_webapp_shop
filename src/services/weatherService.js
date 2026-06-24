const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const DEFAULT_LOCATION = {
  label: 'Metro Manila',
  latitude: 14.5995,
  longitude: 120.9842,
}

function getBrowserPosition() {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('Geolocation is not supported by this browser.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 12000,
    })
  })
}

async function fetchWeatherForecast({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,rain,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    forecast_days: '7',
    timezone: 'auto',
  })

  const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Unable to fetch weather forecast right now.')
  }
  return response.json()
}

async function fetchForecastForCurrentLocation() {
  const position = await getBrowserPosition()
  return fetchWeatherForecast({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  })
}

function fetchForecastForDefaultLocation() {
  return fetchWeatherForecast(DEFAULT_LOCATION)
}

export {
  DEFAULT_LOCATION,
  fetchForecastForCurrentLocation,
  fetchForecastForDefaultLocation,
  fetchWeatherForecast,
  getBrowserPosition,
}
