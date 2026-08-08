import { getDb } from './mysql.js'
import { parseJson } from './util.js'

const defaultBanners = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Lacoste_logo.svg/1024px-Lacoste_logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Dior_Logo.svg/1024px-Dior_Logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Ralph_Lauren_Polo_logo.svg/1024px-Ralph_Lauren_Polo_logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Chanel_logo_interlocking_cs.svg/1024px-Chanel_logo_interlocking_cs.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Dior_Logo.svg/1024px-Dior_Logo.svg.png',
]

const defaultBannerStories = [
  { id: 'banner-1', title: 'Severino Perfume Tips', message: '' },
  { id: 'banner-2', title: 'Severino Inspiration', message: '' },
  { id: 'banner-3', title: 'Severino Stories', message: '' },
  { id: 'banner-4', title: 'Severino Scents', message: '' },
  { id: 'banner-5', title: 'Why Severino?', message: '' },
]

const defaultFeaturedBanners = [
  { id: 'featured-1', title: 'Featured Banner 1', image: '', message: '' },
  { id: 'featured-2', title: 'Featured Banner 2', image: '', message: '' },
  { id: 'featured-3', title: 'Featured Banner 3', image: '', message: '' },
]

const normalizeBannerStories = (stories = []) =>
  defaultBannerStories.map((item, index) => {
    const current = stories[index] || {}
    return { id: item.id, title: item.title, message: current.message || '' }
  })

const normalizeAnnouncements = (announcements = []) =>
  announcements
    .map((item, index) => ({
      id: item?.id || `announcement-${index + 1}`,
      title: item?.title || '',
      message: item?.message || '',
    }))
    .filter((item) => item.title || item.message)

const normalizeFeaturedBanners = (items = []) =>
  defaultFeaturedBanners.map((base, index) => {
    const current = items[index] || {}
    return {
      id: base.id,
      title: (current.title ?? base.title) || '',
      image: current.image || '',
      message: current.message || '',
    }
  })

const getSetting = async (key) => {
  const db = getDb()
  const [rows] = await db.execute(
    'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
    [key]
  )
  return rows[0] ? parseJson(rows[0].setting_value, null) : null
}

const setSetting = async (key, value) => {
  const db = getDb()
  await db.execute(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, JSON.stringify(value)]
  )
  return value
}

const ensureSetting = async (key, defaultValue) => {
  const existing = await getSetting(key)
  if (existing !== null) return existing
  await setSetting(key, defaultValue)
  return defaultValue
}

export const getBanners = async () => {
  const value = await ensureSetting('home', { images: defaultBanners })
  return value.images || defaultBanners
}

export const updateBanners = async (images) => {
  await setSetting('home', { images })
  return images
}

export const getLoginPopup = async () => {
  const value = await ensureSetting('login_popup', { image: '' })
  return value.image || ''
}

export const updateLoginPopup = async (image) => {
  await setSetting('login_popup', { image: image || '' })
  return image || ''
}

export const getLoginAnnouncements = async () => {
  let value = await getSetting('login_announcements')
  if (!value) {
    const legacy = await getSetting('login_announcement')
    const announcements = legacy?.title || legacy?.message
      ? normalizeAnnouncements([{ id: 'announcement-1', title: legacy.title, message: legacy.message }])
      : []
    value = await setSetting('login_announcements', { announcements })
  }
  return normalizeAnnouncements(value.announcements || [])
}

export const updateLoginAnnouncements = async (announcements) => {
  const nextAnnouncements = normalizeAnnouncements(announcements)
  await setSetting('login_announcements', { announcements: nextAnnouncements })
  return nextAnnouncements
}

export const getBannerStories = async () => {
  const value = await ensureSetting('banner_stories', { stories: normalizeBannerStories() })
  return normalizeBannerStories(value.stories || [])
}

export const updateBannerStories = async (stories) => {
  const nextStories = normalizeBannerStories(stories)
  await setSetting('banner_stories', { stories: nextStories })
  return nextStories
}

export const getHeroImage = async () => {
  const value = await ensureSetting('hero_image', { image: '' })
  return value.image || ''
}

export const updateHeroImage = async (image) => {
  await setSetting('hero_image', { image: image || '' })
  return image || ''
}

export const getFeaturedBanners = async () => {
  const value = await ensureSetting('featured_banners', {
    items: normalizeFeaturedBanners(),
  })
  return normalizeFeaturedBanners(value.items || [])
}

export const updateFeaturedBanners = async (items) => {
  const nextItems = normalizeFeaturedBanners(items)
  await setSetting('featured_banners', { items: nextItems })
  return nextItems
}
