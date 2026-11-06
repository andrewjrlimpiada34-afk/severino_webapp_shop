import express from 'express'
import { asyncRoute } from '../lib/asyncRoute.js'
import {
  getBannerStories,
  getLoginPopup,
  getBanners,
  getHeroImage,
  getLoginAnnouncements,
  getFeaturedBanners,
} from '../db/banners.js'

import { createCache } from '../lib/cache.js'

const router = express.Router()
const bannersCache = createCache(300000)

router.get('/login-popup', asyncRoute(async (req, res) => {
  const image = await getLoginPopup()
  res.json({ image: image || '' })
}))

router.get('/login-announcement', asyncRoute(async (req, res) => {
  const announcements = await getLoginAnnouncements()
  res.json(announcements)
}))

router.get('/banner-stories', asyncRoute(async (req, res) => {
  const stories = await getBannerStories()
  res.json(stories)
}))

router.get('/banners', asyncRoute(async (req, res) => {
  const cached = bannersCache.get()
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300')
    return res.json(cached)
  }
  const banners = await getBanners()
  bannersCache.set(banners)
  res.set('Cache-Control', 'public, max-age=300')
  return res.json(banners)
}))

router.get('/hero-image', asyncRoute(async (req, res) => {
  const image = await getHeroImage()
  res.json({ image: image || '' })
}))

router.get('/featured-banners', asyncRoute(async (req, res) => {
  const items = await getFeaturedBanners()
  res.json(items)
}))

export default router

