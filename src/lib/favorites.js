const keyFor = (userId = 'guest') => `severino_favorites_${userId}`

export const getFavorites = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(keyFor(userId)) || '[]')
  } catch {
    return []
  }
}

export const toggleFavorite = (id, userId) => {
  const list = getFavorites(userId)
  const exists = list.includes(id)
  const next = exists ? list.filter((item) => item !== id) : [...list, id]
  localStorage.setItem(keyFor(userId), JSON.stringify(next))
  return next
}
