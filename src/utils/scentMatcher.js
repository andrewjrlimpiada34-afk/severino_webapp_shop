const WEATHER_PROFILES = {
  sunny: {
    label: 'Sunny / Hot',
    icon: '☀️',
    keywords: ['citrus', 'aquatic', 'fresh', 'bergamot', 'lemon', 'orange', 'green tea', 'mint'],
  },
  rainy: {
    label: 'Rainy / Cloudy',
    icon: '🌧️',
    keywords: ['musk', 'amber', 'vanilla', 'lavender', 'tea', 'woody', 'powdery'],
  },
  cloudy: {
    label: 'Cloudy',
    icon: '☁️',
    keywords: ['musk', 'tea', 'lavender', 'powdery', 'woody', 'soft floral'],
  },
  humid: {
    label: 'Humid',
    icon: '💧',
    keywords: ['fresh', 'clean', 'green', 'aquatic', 'light floral'],
  },
  cool: {
    label: 'Cool / Breezy',
    icon: '🍂',
    keywords: ['woody', 'amber', 'vanilla', 'spicy', 'warm', 'musky'],
  },
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])
const CLOUDY_CODES = new Set([2, 3, 45, 48])

function normalizeNotes(notes = '') {
  if (Array.isArray(notes)) {
    return notes.map((note) => String(note).trim().toLowerCase()).filter(Boolean)
  }
  return String(notes)
    .split(/[,/|•·]+/)
    .map((note) => note.trim().toLowerCase())
    .filter(Boolean)
}

function includesNote(notes, keyword) {
  return notes.some((note) => note.includes(keyword) || keyword.includes(note))
}

function getWeatherMood({ temperature, humidity, rain = 0, precipitationProbability = 0, weatherCode }) {
  if (rain > 0 || precipitationProbability >= 55 || RAIN_CODES.has(Number(weatherCode))) {
    return 'rainy'
  }
  if (humidity >= 78 && temperature >= 24) {
    return 'humid'
  }
  if (temperature <= 23) {
    return 'cool'
  }
  if (CLOUDY_CODES.has(Number(weatherCode))) {
    return 'cloudy'
  }
  return 'sunny'
}

function getMoodProfile(mood) {
  return WEATHER_PROFILES[mood] || WEATHER_PROFILES.sunny
}

function getCurrentWeatherSummary(forecast) {
  const current = forecast?.current || {}
  const mood = getWeatherMood({
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    rain: current.rain,
    precipitationProbability: forecast?.daily?.precipitation_probability_max?.[0] || 0,
    weatherCode: current.weather_code,
  })

  return {
    mood,
    profile: getMoodProfile(mood),
    temperature: Math.round(Number(current.temperature_2m) || 0),
    humidity: Math.round(Number(current.relative_humidity_2m) || 0),
    rain: Number(current.rain) || 0,
    weatherCode: current.weather_code,
  }
}

function getDailyForecast(forecast) {
  const daily = forecast?.daily || {}
  const days = daily.time || []
  return days.map((date, index) => {
    const maxTemp = daily.temperature_2m_max?.[index]
    const minTemp = daily.temperature_2m_min?.[index]
    const precipitationProbability = daily.precipitation_probability_max?.[index] || 0
    const weatherCode = daily.weather_code?.[index]
    const averageTemp = (Number(maxTemp) + Number(minTemp)) / 2
    const mood = getWeatherMood({
      temperature: Number.isFinite(averageTemp) ? averageTemp : Number(maxTemp) || 0,
      humidity: 0,
      precipitationProbability,
      weatherCode,
    })

    return {
      date,
      maxTemp: Math.round(Number(maxTemp) || 0),
      minTemp: Math.round(Number(minTemp) || 0),
      precipitationProbability,
      weatherCode,
      mood,
      profile: getMoodProfile(mood),
    }
  })
}

function buildWeeklyKeywords(currentMood, dailyForecast) {
  const counts = new Map()
  const addKeywords = (mood, weight = 1) => {
    getMoodProfile(mood).keywords.forEach((keyword) => {
      counts.set(keyword, (counts.get(keyword) || 0) + weight)
    })
  }

  addKeywords(currentMood, 2)
  dailyForecast.forEach((day) => addKeywords(day.mood, 1))

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([keyword]) => keyword)
}

function rankProductsForWeather(products, forecast, limit = 6) {
  if (!forecast) return []

  const current = getCurrentWeatherSummary(forecast)
  const dailyForecast = getDailyForecast(forecast)
  const weeklyKeywords = buildWeeklyKeywords(current.mood, dailyForecast)

  return products
    .filter((product) => product.stock === undefined || product.stock > 0)
    .map((product) => {
      const notes = normalizeNotes(product.notes)
      const matchedNotes = weeklyKeywords.filter((keyword) => includesNote(notes, keyword))
      const score = matchedNotes.length
      const dominantMood = current.profile.label.toLowerCase()
      const reason = matchedNotes.length
        ? `Recommended because this week feels ${dominantMood}, and this scent has ${matchedNotes
            .slice(0, 3)
            .join(', ')} notes.`
        : ''

      return {
        product,
        notes,
        matchedNotes,
        score,
        reason,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (b.product.soldCount || 0) - (a.product.soldCount || 0)
    })
    .slice(0, limit)
}

function buildAdaptiveScentData(products, forecast) {
  if (!forecast) {
    return {
      current: null,
      dailyForecast: [],
      recommendations: [],
      recommendationIds: new Set(),
    }
  }

  const current = getCurrentWeatherSummary(forecast)
  const dailyForecast = getDailyForecast(forecast)
  const recommendations = rankProductsForWeather(products, forecast)

  return {
    current,
    dailyForecast,
    recommendations,
    recommendationIds: new Set(recommendations.map((item) => item.product.id)),
  }
}

export {
  WEATHER_PROFILES,
  buildAdaptiveScentData,
  getCurrentWeatherSummary,
  getDailyForecast,
  getMoodProfile,
  getWeatherMood,
  normalizeNotes,
  rankProductsForWeather,
}
