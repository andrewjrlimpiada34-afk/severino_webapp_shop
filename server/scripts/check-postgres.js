import 'dotenv/config'
import { closeDb, testDbConnection } from '../src/db/postgres.js'

try {
  const connected = await testDbConnection()
  console.log(connected ? 'PostgreSQL connection successful.' : 'PostgreSQL connection failed.')
  process.exitCode = connected ? 0 : 1
} catch (error) {
  console.error('PostgreSQL connection failed:', error.message)
  process.exitCode = 1
} finally {
  await closeDb()
}
