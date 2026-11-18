import { getDb, withTransaction } from './postgres.js'
import { createId } from './util.js'

export const mapAddress = (row) => ({
  id: row.id,
  label: row.label,
  name: row.name,
  phone: row.phone,
  addressLine: row.address_line,
  barangay: row.barangay,
  city: row.city,
  province: row.province,
  zip: row.zip,
  country: row.country,
  isDefault: row.is_default
})

export const listAddresses = async (userId, connection = getDb()) => {
  const { rows } = await connection.query(
    'SELECT * FROM customer_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at, id',
    [userId]
  )
  return rows.map(mapAddress)
}

export const saveAddress = (userId, data, id = null) =>
  withTransaction(async (connection) => {
    await connection.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
      userId
    ])
    if (id) {
      const { rows } = await connection.query(
        'SELECT id FROM customer_addresses WHERE id = $1 AND user_id = $2',
        [id, userId]
      )
      if (!rows.length) return null
    }
    const existing = await listAddresses(userId, connection)
    const isDefault = Boolean(
      data.isDefault ||
      !existing.length ||
      existing.find((address) => address.id === id)?.isDefault
    )
    if (isDefault)
      await connection.query(
        'UPDATE customer_addresses SET is_default = FALSE WHERE user_id = $1',
        [userId]
      )
    const values = [
      data.label,
      data.name,
      data.phone,
      data.addressLine || '',
      data.barangay,
      data.city,
      data.province,
      data.zip,
      data.country,
      isDefault,
      id || createId(),
      userId
    ]
    const { rows } = await connection.query(
      id
        ? `UPDATE customer_addresses SET label=$1, name=$2, phone=$3, address_line=$4, barangay=$5, city=$6, province=$7, zip=$8, country=$9, is_default=$10 WHERE id=$11 AND user_id=$12 RETURNING *`
        : `INSERT INTO customer_addresses(label,name,phone,address_line,barangay,city,province,zip,country,is_default,id,user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      values
    )
    return mapAddress(rows[0])
  })

export const deleteAddress = (userId, id) =>
  withTransaction(async (connection) => {
    await connection.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
      userId
    ])
    const result = await connection.query(
      'DELETE FROM customer_addresses WHERE id = $1 AND user_id = $2 RETURNING is_default',
      [id, userId]
    )
    if (!result.rowCount) return false
    if (result.rows[0].is_default)
      await connection.query(
        `UPDATE customer_addresses SET is_default = TRUE WHERE id = (SELECT id FROM customer_addresses WHERE user_id = $1 ORDER BY created_at, id LIMIT 1)`,
        [userId]
      )
    return true
  })
