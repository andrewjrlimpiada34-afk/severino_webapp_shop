import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb, withTransaction } from '../src/db/postgres.js'
import { logError } from '../src/lib/logging.js'

export async function migrateEnhancements() {
  return withTransaction(async (connection) => {
    await connection.query(
      "SELECT pg_advisory_xact_lock(hashtext('severino-schema-migrations'))"
    )
    await connection.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)'
    )
    await connection.query(
      'ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY'
    )
    const { rows } = await connection.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      ['001_system_enhancements']
    )
    if (rows.length) return false
    await connection.query(
      'LOCK TABLE users, products, orders, sales IN ACCESS EXCLUSIVE MODE'
    )
    const sql = await readFile(
      new URL('../sql/migrations/001_system_enhancements.sql', import.meta.url),
      'utf8'
    )
    await connection.query(sql)
    await connection.query(
      'INSERT INTO schema_migrations(version) VALUES ($1)',
      ['001_system_enhancements']
    )
    return true
  })
}

async function preflight() {
  const { rows } = await getDb().query(`SELECT
    (SELECT COUNT(*) FROM (SELECT lower(trim(email)) FROM users WHERE email IS NOT NULL GROUP BY lower(trim(email)) HAVING COUNT(*) > 1) duplicates) AS duplicate_emails,
    (SELECT COUNT(*) FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) i WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = i->>'productId' OR p.legacy_id = i->>'productId')) AS unresolved_product_references,
    (SELECT COUNT(*) FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) i WHERE COALESCE(i->>'trackingStatus', o.status) IN ('Approved','Verified','To Ship','To Receive','To Review','Delivered','Completed') AND NOT (i ? 'stockDeductedAt')) AS legacy_items_requiring_review,
    (SELECT COUNT(*) FROM (
      SELECT p.id FROM products p JOIN orders o ON o.status NOT IN ('Cancelled','Removed')
      CROSS JOIN LATERAL jsonb_array_elements(o.items) i
      WHERE (p.id=i->>'productId' OR p.legacy_id=i->>'productId') AND
        (i->>'reservationActive'='true' OR (COALESCE(i->>'trackingStatus',o.status) IN ('Pending','Pending COD') AND NOT (i ? 'stockDeductedAt')))
      GROUP BY p.id,p.stock HAVING SUM((i->>'quantity')::INTEGER)>p.stock
    ) shortages) AS products_with_insufficient_commitment_stock`)
  console.log(JSON.stringify(rows[0]))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.includes('--check')) await preflight()
    else
      console.log(
        (await migrateEnhancements())
          ? 'Applied enhancement migration 001.'
          : 'Enhancement migration already applied.'
      )
  } catch (error) {
    logError('enhancement_migration_failed', error)
    console.error(
      process.argv.includes('--check')
        ? 'Read-only preflight failed. Verify database connectivity and schema compatibility.'
        : 'Migration rolled back. Review pending order commitments and database constraints before retrying.'
    )
    process.exitCode = 1
  } finally {
    await closeDb()
  }
}
