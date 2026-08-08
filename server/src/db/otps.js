import { getDb } from './mysql.js'

const mapOtp = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id || undefined,
        email: row.email || undefined,
        phone: row.phone || undefined,
        code: row.code,
        type: row.type,
        expiresAt: Number(row.expires_at),
        attempts: Number(row.attempts || 0),
        verifiedAt: row.verified_at,
        createdAt: row.created_at,
      }
    : null

export const getOtpById = async (id) => {
  const db = getDb()
  const [rows] = await db.execute('SELECT * FROM otps WHERE id = ? LIMIT 1', [id])
  return mapOtp(rows[0])
}

export const createOtp = async (data) => {
  const db = getDb()
  const createdAt = data.createdAt || new Date()
  await db.execute(
    `INSERT INTO otps (
      id, user_id, email, phone, code, type, expires_at, attempts, verified_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id), email = VALUES(email), phone = VALUES(phone),
      code = VALUES(code), type = VALUES(type), expires_at = VALUES(expires_at),
      attempts = VALUES(attempts), verified_at = VALUES(verified_at), created_at = VALUES(created_at)`,
    [
      data.id, data.userId || null, data.email || null, data.phone || null, data.code,
      data.type || 'register', data.expiresAt, data.attempts || 0, data.verifiedAt || null, createdAt,
    ]
  )
  return getOtpById(data.id)
}

export const getLatestOtpByEmail = async (email, type = 'register') => {
  const db = getDb()
  const [rows] = await db.execute(
    'SELECT * FROM otps WHERE email = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
    [email, type]
  )
  return mapOtp(rows[0])
}

export const getLatestOtpByPhone = async (phone, type = 'register') => {
  const db = getDb()
  const [rows] = await db.execute(
    'SELECT * FROM otps WHERE phone = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
    [phone, type]
  )
  return mapOtp(rows[0])
}

export const markOtpVerified = async (id) => {
  const db = getDb()
  await db.execute('UPDATE otps SET verified_at = NOW(3) WHERE id = ?', [id])
  return true
}

export const incrementOtpAttempts = async (id) => {
  const db = getDb()
  await db.execute('UPDATE otps SET attempts = attempts + 1 WHERE id = ?', [id])
  return true
}

export const consumeOtp = async (id) => {
  const db = getDb()
  await db.execute('DELETE FROM otps WHERE id = ?', [id])
  return true
}
