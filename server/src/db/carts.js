import { getDb } from './postgres.js'
import { createId, parseJson } from './util.js'

const mapCart = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        items: parseJson(row.items, []),
        createdAt: row.created_at,
      }
    : null

export const getCartByUserId = async (userId) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM carts WHERE user_id = $1 LIMIT 1', [userId])
  return mapCart(rows[0])
}

export const createCart = async (userId) => {
  const db = getDb()
  await db.query(
    `INSERT INTO carts (id, user_id, items, created_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO NOTHING`,
    [createId(), userId, JSON.stringify([])]
  )
  return getCartByUserId(userId)
}

export const updateCart = async (userId, items) => {
  const db = getDb()
  const result = await db.query('UPDATE carts SET items = $1 WHERE user_id = $2', [
    JSON.stringify(items),
    userId,
  ])
  return result.rowCount ? getCartByUserId(userId) : null
}

export const removeCartByUserId = async (userId) => {
  const db = getDb()
  await db.query('DELETE FROM carts WHERE user_id = $1', [userId])
  return true
}
