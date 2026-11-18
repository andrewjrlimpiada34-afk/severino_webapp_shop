import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from '../src/db/postgres.js'
import { logError } from '../src/lib/logging.js'
import { migrateEnhancements } from './migrate-enhancements.js'

const schemaUrl = new URL('../sql/schema.sql', import.meta.url)

try {
  const schema = await readFile(fileURLToPath(schemaUrl), 'utf8')
  await getDb().query(schema)
  if (!process.argv.includes('--base-only')) await migrateEnhancements()
  console.log(process.argv.includes('--base-only') ? 'Applied base PostgreSQL schema for legacy import.' : 'Applied PostgreSQL schema and versioned migrations.')
} catch (error) {
  logError('database_schema_failed', error)
  process.exitCode = 1
} finally {
  await closeDb()
}
