import { getDb } from './mongo.js'

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

const normalizeBannerStories = (stories = []) =>
  defaultBannerStories.map((item, index) => {
    const current = stories[index] || {}
    return {
      id: item.id,
      title: item.title,
      message: current.message || '',
    }
  })

const normalizeAnnouncements = (announcements = []) =>
  announcements
    .map((item, index) => ({
      id: item?.id || `announcement-${index + 1}`,
      title: item?.title || '',
      message: item?.message || '',
    }))
    .filter((item) => item.title || item.message)

const ensureBanners = async () => {
  const db = await getDb()
  const collection = db.collection('banners')
  const existing = await collection.findOne({ key: 'home' })
  if (!existing) {
    await collection.insertOne({ key: 'home', images: defaultBanners })
    return defaultBanners
  }
  return existing.images || defaultBanners
}

export const getBanners = async () => {
  return ensureBanners()
}

export const updateBanners = async (images) => {
  const db = await getDb()
  await db.collection('banners').updateOne(
    { key: 'home' },
    { $set: { images } },
    { upsert: true }
  )
  return images
}

const ensureLoginPopup = async () => {
  const db = await getDb()
  const collection = db.collection('banners')
  const existing = await collection.findOne({ key: 'login_popup' })
  if (!existing) {
    await collection.insertOne({ key: 'login_popup', image: '' })
    return ''
  }
  return existing.image || ''
}

export const getLoginPopup = async () => {
  return ensureLoginPopup()
}

export const updateLoginPopup = async (image) => {
  const db = await getDb()
  await db.collection('banners').updateOne(
    { key: 'login_popup' },
    { $set: { image } },
    { upsert: true }
  )
  return image || ''
}

const ensureLoginAnnouncements = async () => {
  const db = await getDb()
  const collection = db.collection('banners')
  const existing = await collection.findOne({ key: 'login_announcements' })
  if (!existing) {
    const legacy = await collection.findOne({ key: 'login_announcement' })
    const announcements = legacy?.title || legacy?.message
      ? normalizeAnnouncements([{ id: 'announcement-1', title: legacy.title, message: legacy.message }])
      : []
    await collection.insertOne({ key: 'login_announcements', announcements })
    return announcements
  }
  return normalizeAnnouncements(existing.announcements || [])
}

export const getLoginAnnouncements = async () => {
  return ensureLoginAnnouncements()
}

export const updateLoginAnnouncements = async (announcements) => {
  const db = await getDb()
  const nextAnnouncements = normalizeAnnouncements(announcements)
  await db.collection('banners').updateOne(
    { key: 'login_announcements' },
    { $set: { announcements: nextAnnouncements } },
    { upsert: true }
  )
  return nextAnnouncements
}

const ensureBannerStories = async () => {
  const db = await getDb()
  const collection = db.collection('banners')
  const existing = await collection.findOne({ key: 'banner_stories' })
  if (!existing) {
    const stories = normalizeBannerStories()
    await collection.insertOne({ key: 'banner_stories', stories })
    return stories
  }
  return normalizeBannerStories(existing.stories || [])
}

export const getBannerStories = async () => {
  return ensureBannerStories()
}

export const updateBannerStories = async (stories) => {
  const db = await getDb()
  const nextStories = normalizeBannerStories(stories)
  await db.collection('banners').updateOne(
    { key: 'banner_stories' },
    { $set: { stories: nextStories } },
    { upsert: true }
  )
  return nextStories
}

const ensureHeroImage = async () => {
  const db = await getDb()
  const collection = db.collection('banners')
  const existing = await collection.findOne({ key: 'hero_image' })
  if (!existing) {
    await collection.insertOne({ key: 'hero_image', image: '' })
    return ''
  }
  return existing.image || ''
}

export const getHeroImage = async () => {
  return ensureHeroImage()
}

export const updateHeroImage = async (image) => {
  const db = await getDb()
  await db.collection('banners').updateOne(
    { key: 'hero_image' },
    { $set: { image } },
    { upsert: true }
  )
  return image || ''
}
