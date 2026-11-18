import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

// Tests use a separately configured database or a temporary PGlite installation.
// The application's configured DATABASE_URL is never used for test storage.
export const hasTestDatabase = Boolean(
  process.env.TEST_DATABASE_URL || process.env.TEST_PGLITE_MODULE
)

export async function useTestDatabase(context) {
  process.env.DATABASE_URL =
    'postgresql://test:test@localhost:1/intercepted-test-pool'
  process.env.JWT_SECRET = 'integration-tests-only-secret'
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_PASSWORD
  const { getDb, closeDb } = await import('./postgres.js')
  let adapter
  let executeSql
  let cleanup
  if (process.env.TEST_DATABASE_URL) {
    const schema = `test_enhancements_${crypto.randomUUID().replaceAll('-', '')}`
    const administrator = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL
    })
    await administrator.query(`CREATE SCHEMA ${schema}`)
    const pool = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema},public`
    })
    adapter = pool
    executeSql = (sql) => pool.query(sql)
    cleanup = async () => {
      await pool.end()
      await administrator.query(`DROP SCHEMA ${schema} CASCADE`)
      await administrator.end()
    }
  } else {
    const { PGlite } = await import(
      pathToFileURL(resolve(process.env.TEST_PGLITE_MODULE)).href
    )
    const database = new PGlite()
    let queue = Promise.resolve()
    const lock = async () => {
      const previous = queue
      let release
      queue = new Promise((done) => {
        release = done
      })
      await previous
      return release
    }
    const query = async (sql, values) => {
      const result =
        !values && sql.includes(';')
          ? (await database.exec(sql)).at(-1)
          : await database.query(sql, values)
      return { ...result, rowCount: result.affectedRows ?? result.rows.length }
    }
    adapter = {
      query: async (sql, values) => {
        const release = await lock()
        try {
          return await query(sql, values)
        } finally {
          release()
        }
      },
      connect: async () => {
        const release = await lock()
        return { query, release }
      }
    }
    executeSql = (sql) => database.exec(sql)
    cleanup = () => database.close()
  }
  context.mock.method(getDb(), 'query', (sql, values) =>
    adapter.query(sql, values)
  )
  context.mock.method(getDb(), 'connect', () => adapter.connect())
  context.after(async () => {
    await cleanup()
    await closeDb()
  })
  await executeSql(
    await readFile(new URL('../../sql/schema.sql', import.meta.url), 'utf8')
  )
  return { query: adapter.query.bind(adapter), executeSql }
}
