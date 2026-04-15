import { getDb } from './mongo.js'

const defaultBanners = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Lacoste_logo.svg/1024px-Lacoste_logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Dior_Logo.svg/1024px-Dior_Logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Ralph_Lauren_Polo_logo.svg/1024px-Ralph_Lauren_Polo_logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Chanel_logo_interlocking_cs.svg/1024px-Chanel_logo_interlocking_cs.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Dior_Logo.svg/1024px-Dior_Logo.svg.png',
]

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

const ensureLoginAnnouncement = async () => {
  const db = await getDb()
  const collection = db.collection('banners')
  const existing = await collection.findOne({ key: 'login_announcement' })
  if (!existing) {
    const announcement = { title: '', message: '' }
    await collection.insertOne({ key: 'login_announcement', ...announcement })
    return announcement
  }
  return {
    title: existing.title || '',
    message: existing.message || '',
  }
}

export const getLoginAnnouncement = async () => {
  return ensureLoginAnnouncement()
}

export const updateLoginAnnouncement = async ({ title, message }) => {
  const db = await getDb()
  const nextAnnouncement = {
    title: title || '',
    message: message || '',
  }
  await db.collection('banners').updateOne(
    { key: 'login_announcement' },
    { $set: nextAnnouncement },
    { upsert: true }
  )
  return nextAnnouncement
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
