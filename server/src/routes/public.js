import express from 'express'
import { getLoginPopup, getBanners, getHeroImage } from '../db/banners.js'
import { createCache } from '../lib/cache.js'

const router = express.Router()
const bannersCache = createCache(20000)

router.get('/login-popup', async (req, res) => {
  const image = await getLoginPopup()
  res.json({ image: image || '' })
})

router.get('/banners', async (req, res) => {
  const cached = bannersCache.get()
  if (cached) {
    res.set('Cache-Control', 'public, max-age=20')
    return res.json(cached)
  }
  const banners = await getBanners()
  bannersCache.set(banners)
  res.set('Cache-Control', 'public, max-age=20')
  return res.json(banners)
})

router.get('/hero-image', async (req, res) => {
  const image = await getHeroImage()
  res.json({ image: image || '' })
})

export default router
