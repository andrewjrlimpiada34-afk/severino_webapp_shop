import express from 'express'
import { getLoginPopup, getBanners, getHeroImage } from '../db/banners.js'

const router = express.Router()

router.get('/login-popup', async (req, res) => {
  const image = await getLoginPopup()
  res.json({ image: image || '' })
})

router.get('/banners', async (req, res) => {
  res.json(await getBanners())
})

router.get('/hero-image', async (req, res) => {
  const image = await getHeroImage()
  res.json({ image: image || '' })
})

export default router
