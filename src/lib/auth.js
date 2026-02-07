export const setLocalProfile = (profile) => {
  localStorage.setItem('severino_profile', JSON.stringify(profile))
}

export const getLocalProfile = () => {
  const raw = localStorage.getItem('severino_profile')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const clearLocalProfile = () => {
  localStorage.removeItem('severino_profile')
}
