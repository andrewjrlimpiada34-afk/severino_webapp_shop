import mysql from 'mysql2/promise'

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
for (const variable of requiredVariables) {
  if (!process.env[variable]) throw new Error(`${variable} is not set`)
}

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback
  return String(value).toLowerCase() === 'true'
}

const positiveNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const connectionLimit = positiveNumber(process.env.DB_POOL_SIZE, 10)
const sslEnabled = parseBoolean(process.env.DB_SSL)
const sslCa = process.env.DB_SSL_CA_BASE64
  ? Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8')
  : process.env.DB_SSL_CA?.replace(/\\n/g, '\n')

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: positiveNumber(process.env.DB_PORT, 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit,
  maxIdle: positiveNumber(process.env.DB_POOL_MAX_IDLE, connectionLimit),
  idleTimeout: positiveNumber(process.env.DB_IDLE_TIMEOUT_MS, 60000),
  queueLimit: 0,
  connectTimeout: positiveNumber(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: 'Z',
  decimalNumbers: true,
  ssl: sslEnabled
    ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
        ...(sslCa ? { ca: sslCa } : {}),
      }
    : undefined,
})

export const getDb = () => pool

export const testDbConnection = async () => {
  const connection = await pool.getConnection()
  try {
    await connection.ping()
    const [rows] = await connection.execute('SELECT 1 AS connected')
    return rows[0]?.connected === 1
  } finally {
    connection.release()
  }
}

export const withTransaction = async (callback) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export const closeDb = async () => {
  await pool.end()
}
