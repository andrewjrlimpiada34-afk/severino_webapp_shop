import { getDb } from './mysql.js'
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
  const [rows] = await db.execute('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId])
  return mapCart(rows[0])
}

export const createCart = async (userId) => {
  const db = getDb()
  await db.execute(
    `INSERT INTO carts (id, user_id, items, created_at)
     VALUES (?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [createId(), userId, JSON.stringify([])]
  )
  return getCartByUserId(userId)
}

export const updateCart = async (userId, items) => {
  const db = getDb()
  const [result] = await db.execute('UPDATE carts SET items = ? WHERE user_id = ?', [
    JSON.stringify(items),
    userId,
  ])
  return result.affectedRows ? getCartByUserId(userId) : null
}

export const removeCartByUserId = async (userId) => {
  const db = getDb()
  await db.execute('DELETE FROM carts WHERE user_id = ?', [userId])
  return true
}
