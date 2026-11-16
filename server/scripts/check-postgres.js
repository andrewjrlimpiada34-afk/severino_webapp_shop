import 'dotenv/config'
import { closeDb, testDbConnection } from '../src/db/postgres.js'
import { logError } from '../src/lib/logging.js'

try {
  const connected = await testDbConnection()
  console.log(connected ? 'PostgreSQL connection successful.' : 'PostgreSQL connection failed.')
  process.exitCode = connected ? 0 : 1
} catch (error) {
  logError('database_check_failed', error)
  process.exitCode = 1
} finally {
  await closeDb()
}
