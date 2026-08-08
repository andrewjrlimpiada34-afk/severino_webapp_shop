import 'dotenv/config'
import { closeDb, testDbConnection } from '../src/db/mysql.js'

try {
  const connected = await testDbConnection()
  console.log(connected ? 'MySQL connection successful.' : 'MySQL connection failed.')
  process.exitCode = connected ? 0 : 1
} catch (error) {
  console.error('MySQL connection failed:', error.message)
  process.exitCode = 1
} finally {
  await closeDb()
}
