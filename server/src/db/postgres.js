import pg from 'pg'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL?.trim()
const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']

if (!databaseUrl) {
  for (const variable of requiredVariables) {
    if (!process.env[variable]) throw new Error(`${variable} is not set`)
  }
}

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback
  return String(value).toLowerCase() === 'true'
}

const positiveNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const sslEnabled = parseBoolean(process.env.DB_SSL, process.env.NODE_ENV === 'production')
const sslCa = process.env.DB_SSL_CA_BASE64
  ? Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8')
  : process.env.DB_SSL_CA?.replace(/\\n/g, '\n')

const pool = new Pool({
  ...(databaseUrl
    ? { connectionString: databaseUrl }
    : {
        host: process.env.DB_HOST,
        port: positiveNumber(process.env.DB_PORT, 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }),
  max: positiveNumber(process.env.DB_POOL_SIZE, 10),
  idleTimeoutMillis: positiveNumber(process.env.DB_IDLE_TIMEOUT_MS, 60000),
  connectionTimeoutMillis: positiveNumber(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
  keepAlive: true,
  ssl: sslEnabled
    ? {
        rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
        ...(sslCa ? { ca: sslCa } : {}),
      }
    : false,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message)
})

export const getDb = () => pool

export const testDbConnection = async () => {
  const client = await pool.connect()
  try {
    const { rows } = await client.query('SELECT 1 AS connected')
    return rows[0]?.connected === 1
  } finally {
    client.release()
  }
}

export const withTransaction = async (callback) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const closeDb = async () => {
  await pool.end()
}
