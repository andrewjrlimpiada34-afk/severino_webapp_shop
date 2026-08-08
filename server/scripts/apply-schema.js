import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { closeDb, getDb } from '../src/db/mysql.js'

const schemaUrl = new URL('../sql/schema.sql', import.meta.url)

try {
  const schema = await readFile(fileURLToPath(schemaUrl), 'utf8')
  const statements = schema
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await getDb().execute(statement)
  }
  console.log(`Applied ${statements.length} MySQL schema statements.`)
} catch (error) {
  console.error('Unable to apply MySQL schema:', error.message)
  process.exitCode = 1
} finally {
  await closeDb()
}
