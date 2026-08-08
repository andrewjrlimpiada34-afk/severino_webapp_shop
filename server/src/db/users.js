import bcrypt from 'bcryptjs'
import { getDb } from './mysql.js'
import { createId, nullable } from './util.js'

const adminEmail = process.env.ADMIN_EMAIL || 'admin@severinoatelier.com'
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!'

const mapUser = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        email: row.email || '',
        phone: row.phone || '',
        passwordHash: row.password_hash || '',
        role: row.role,
        verified: Boolean(row.verified),
        address: row.address || '',
        addressLine: row.address_line || '',
        barangay: row.barangay || '',
        city: row.city || '',
        province: row.province || '',
        zip: row.zip || '',
        country: row.country || '',
        backupAddress: row.backup_address || '',
        profileImage: row.profile_image || '',
        preferredTheme: row.preferred_theme || 'Default',
        createdAt: row.created_at,
      }
    : null

const findUser = async (column, value) => {
  const db = getDb()
  const [rows] = await db.execute(`SELECT * FROM users WHERE ${column} = ? LIMIT 1`, [value])
  return mapUser(rows[0])
}

const ensureAdmin = async () => {
  const existing = await findUser('email', adminEmail)
  if (existing) return existing

  const db = getDb()
  await db.execute(
    `INSERT INTO users (
      id, name, email, password_hash, role, verified, phone, address,
      address_line, barangay, city, province, zip, country, backup_address,
      profile_image, preferred_theme, created_at
    ) VALUES (?, 'Admin', ?, ?, 'admin', TRUE, NULL, '', '', '', '', '', '', '', '', '', 'Default', NOW(3))
    ON DUPLICATE KEY UPDATE email = VALUES(email)`,
    [createId(), adminEmail, bcrypt.hashSync(adminPassword, 12)]
  )
  return findUser('email', adminEmail)
}

export const getUsers = async () => {
  await ensureAdmin()
  const db = getDb()
  const [rows] = await db.execute('SELECT * FROM users ORDER BY created_at DESC')
  return rows.map(mapUser)
}

export const getUserByEmail = async (email) => {
  await ensureAdmin()
  return email ? findUser('email', email) : null
}

export const getUserByPhone = async (phone) => {
  await ensureAdmin()
  return phone ? findUser('phone', phone) : null
}

export const getUserById = async (id) => {
  if (!id) return null
  await ensureAdmin()
  return findUser('id', id)
}

export const createUser = async (data) => {
  const db = getDb()
  const user = {
    id: createId(),
    name: data.name,
    email: nullable(data.email),
    phone: nullable(data.phone),
    passwordHash: data.passwordHash || '',
    role: data.role || 'customer',
    verified: Boolean(data.verified),
    address: data.address || '',
    addressLine: data.addressLine || '',
    barangay: data.barangay || '',
    city: data.city || '',
    province: data.province || '',
    zip: data.zip || '',
    country: data.country || '',
    backupAddress: data.backupAddress || '',
    profileImage: data.profileImage || '',
    preferredTheme: data.preferredTheme || 'Default',
    createdAt: data.createdAt || new Date(),
  }

  await db.execute(
    `INSERT INTO users (
      id, name, email, phone, password_hash, role, verified, address,
      address_line, barangay, city, province, zip, country, backup_address,
      profile_image, preferred_theme, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id, user.name, user.email, user.phone, user.passwordHash, user.role,
      user.verified, user.address, user.addressLine, user.barangay, user.city,
      user.province, user.zip, user.country, user.backupAddress, user.profileImage,
      user.preferredTheme, user.createdAt,
    ]
  )
  return getUserById(user.id)
}

const userColumns = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  passwordHash: 'password_hash',
  role: 'role',
  verified: 'verified',
  address: 'address',
  addressLine: 'address_line',
  barangay: 'barangay',
  city: 'city',
  province: 'province',
  zip: 'zip',
  country: 'country',
  backupAddress: 'backup_address',
  profileImage: 'profile_image',
  preferredTheme: 'preferred_theme',
}

export const updateUser = async (id, data) => {
  const updates = []
  const values = []
  for (const [key, column] of Object.entries(userColumns)) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue
    updates.push(`${column} = ?`)
    values.push(key === 'email' || key === 'phone' ? nullable(data[key]) : data[key])
  }
  if (!updates.length) return getUserById(id)

  const db = getDb()
  const [result] = await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ])
  return result.affectedRows ? getUserById(id) : null
}

export const removeUser = async (id) => {
  const user = await getUserById(id)
  if (!user) return null
  const db = getDb()
  await db.execute('DELETE FROM users WHERE id = ?', [id])
  return user
}

export const sanitizeUser = (user) => {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email || '',
    role: user.role,
    verified: Boolean(user.verified),
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
    hasPassword: Boolean(user.passwordHash),
  }
}
