import express from 'express'
import { getLoginPopup } from '../db/banners.js'
import { getBanners } from '../db/banners.js'

const router = express.Router()

router.get('/login-popup', async (req, res) => {
  const image = await getLoginPopup()
  res.json({ image: image || '' })
})

router.get('/banners', async (req, res) => {
  res.json(await getBanners())
})

export default router
