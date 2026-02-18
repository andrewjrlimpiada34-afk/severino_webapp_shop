import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

const adminEmail = process.env.ADMIN_EMAIL || 'admin@severinoatelier.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!'

const ensureAdmin = async () => {
  const db = await getDb()
  const users = db.collection('users')
  const existing = await users.findOne({ email: adminEmail })
  if (existing) return existing
  const admin = {
    name: 'Admin',
    email: adminEmail,
    passwordHash: bcrypt.hashSync(adminPassword, 12),
    role: 'admin',
    verified: true,
    phone: '',
    address: '',
    addressLine: '',
    barangay: '',
    city: '',
    province: '',
    zip: '',
    country: '',
    backupAddress: '',
    profileImage: '',
    preferredTheme: 'Default',
    createdAt: new Date(),
  }
  const result = await users.insertOne(admin)
  return { ...admin, _id: result.insertedId }
}

export const getUsers = async () => {
  await ensureAdmin()
  const db = await getDb()
  return db.collection('users').find({}).toArray()
}

export const getUserByEmail = async (email) => {
  await ensureAdmin()
  const db = await getDb()
  return db.collection('users').findOne({ email })
}

export const getUserById = async (id) => {
  if (!id) return null
  await ensureAdmin()
  const db = await getDb()
  return db.collection('users').findOne({ _id: new ObjectId(id) })
}

export const createUser = async (data) => {
  const db = await getDb()
  const users = db.collection('users')
  const user = {
    role: 'customer',
    verified: false,
    phone: '',
    address: '',
    addressLine: '',
    barangay: '',
    city: '',
    province: '',
    zip: '',
    country: '',
    backupAddress: '',
    profileImage: '',
    preferredTheme: 'Default',
    createdAt: new Date(),
    ...data,
  }
  const result = await users.insertOne(user)
  return { ...user, _id: result.insertedId }
}

export const updateUser = async (id, data) => {
  const db = await getDb()
  const users = db.collection('users')
  const updated = await users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: data },
    { returnDocument: 'after' }
  )
  return updated
}

export const removeUser = async (id) => {
  const db = await getDb()
  const users = db.collection('users')
  const removed = await users.findOneAndDelete({ _id: new ObjectId(id) })
  return removed
}

export const sanitizeUser = (user) => {
  if (!user) return null
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    verified: user.verified,
    phone: user.phone || '',
    address: user.address || '',
    addressLine: user.addressLine || '',
    barangay: user.barangay || '',
    city: user.city || '',
    province: user.province || '',
    zip: user.zip || '',
    country: user.country || '',
    backupAddress: user.backupAddress || '',
    profileImage: user.profileImage || '',
    preferredTheme: user.preferredTheme || 'Default',
  }
}
