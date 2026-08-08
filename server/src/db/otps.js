import { getDb } from './postgres.js'

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
  const { rows } = await db.query('SELECT * FROM otps WHERE id = $1 LIMIT 1', [id])
  return mapOtp(rows[0])
}

export const createOtp = async (data) => {
  const db = getDb()
  const createdAt = data.createdAt || new Date()
  await db.query(
    `INSERT INTO otps (
      id, user_id, email, phone, code, type, expires_at, attempts, verified_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, email = EXCLUDED.email, phone = EXCLUDED.phone,
      code = EXCLUDED.code, type = EXCLUDED.type, expires_at = EXCLUDED.expires_at,
      attempts = EXCLUDED.attempts, verified_at = EXCLUDED.verified_at,
      created_at = EXCLUDED.created_at`,
    [
      data.id, data.userId || null, data.email || null, data.phone || null, data.code,
      data.type || 'register', data.expiresAt, data.attempts || 0, data.verifiedAt || null, createdAt,
    ]
  )
  return getOtpById(data.id)
}

export const getLatestOtpByEmail = async (email, type = 'register') => {
  const db = getDb()
  const { rows } = await db.query(
    'SELECT * FROM otps WHERE email = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1',
    [email, type]
  )
  return mapOtp(rows[0])
}

export const getLatestOtpByPhone = async (phone, type = 'register') => {
  const db = getDb()
  const { rows } = await db.query(
    'SELECT * FROM otps WHERE phone = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1',
    [phone, type]
  )
  return mapOtp(rows[0])
}

export const markOtpVerified = async (id) => {
  const db = getDb()
  await db.query('UPDATE otps SET verified_at = CURRENT_TIMESTAMP WHERE id = $1', [id])
  return true
}

export const incrementOtpAttempts = async (id) => {
  const db = getDb()
  await db.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [id])
  return true
}

export const consumeOtp = async (id) => {
  const db = getDb()
  await db.query('DELETE FROM otps WHERE id = $1', [id])
  return true
}
