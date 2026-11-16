import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from '../src/db/postgres.js'
import { logError } from '../src/lib/logging.js'

const schemaUrl = new URL('../sql/schema.sql', import.meta.url)

try {
  const schema = await readFile(fileURLToPath(schemaUrl), 'utf8')
  const statements = schema
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await getDb().query(statement)
  }
  console.log(`Applied ${statements.length} PostgreSQL schema statements.`)
} catch (error) {
  logError('database_schema_failed', error)
  process.exitCode = 1
} finally {
  await closeDb()
}
