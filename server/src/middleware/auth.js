import jwt from 'jsonwebtoken'
import { getUserById } from '../db/users.js'

export const requireAuth = async (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (typeof payload.id !== 'string') return res.status(401).json({ message: 'Invalid token' })
    req.user = payload
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
  try {
    const user = await getUserById(req.user.id)
    if (!user || user.deletedAt || (!user.verified && user.role !== 'admin')) return res.status(401).json({ message: 'Unauthorized' })
    req.user = { id: user.id, role: user.role }
    return next()
  } catch (error) { return next(error) }
}

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' })
  }
  return next()
}
