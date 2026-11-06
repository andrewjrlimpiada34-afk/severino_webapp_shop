export const FONT_OPTIONS = [
  { id: 'editorial', label: 'Editorial Luxury', heading: 'Cormorant Garamond', body: 'Manrope' },
  { id: 'fashion', label: 'High-fashion Luxury', heading: 'Bodoni Moda', body: 'Jost' },
]

const normalizeFont = (value) => FONT_OPTIONS.some((option) => option.id === value) ? value : 'editorial'
const storageKey = (userId) => `severino_font_${userId || 'guest'}`

export function readFontPreference(userId) {
  try { return normalizeFont(localStorage.getItem(storageKey(userId))) }
  catch { return 'editorial' }
}

export function applyFontPreference(value) {
  const font = normalizeFont(value)
  document.documentElement.setAttribute('data-font', font)
  return font
}

export function saveFontPreference(userId, value) {
  const font = applyFontPreference(value)
  try { localStorage.setItem(storageKey(userId), font) } catch { /* Font changes remain usable without storage. */ }
  return font
}
