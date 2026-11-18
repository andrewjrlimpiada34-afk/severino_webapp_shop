import { createHash, randomBytes } from 'node:crypto'
import { getDb, withTransaction } from './postgres.js'
import { createId } from './util.js'
import { createUser } from './users.js'
import { PRIVACY_VERSION, TERMS_VERSION } from '../../shared/policyVersions.js'

const hash = (token) => createHash('sha256').update(token).digest('hex')
export async function findGoogleUser(subject) {
  const { rows } = await getDb().query(
    "SELECT u.* FROM users u JOIN auth_identities i ON i.user_id = u.id WHERE i.provider = 'google' AND i.subject = $1",
    [subject]
  )
  return rows[0] || null
}
export async function startGoogleOnboarding(profile) {
  const token = randomBytes(32).toString('hex')
  await getDb().query(
    'DELETE FROM oauth_onboarding WHERE expires_at < CURRENT_TIMESTAMP'
  )
  await getDb().query(
    "INSERT INTO oauth_onboarding(token_hash,subject,email,name,expires_at) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP + INTERVAL '10 minutes')",
    [hash(token), profile.id, profile.email, profile.name.slice(0, 150)]
  )
  return token
}
export async function getGoogleOnboarding(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const { rows } = await getDb().query(
    'SELECT * FROM oauth_onboarding WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP',
    [hash(token)]
  )
  if (!rows[0]) return null
  const { rows: users } = await getDb().query(
    'SELECT id, password_hash FROM users WHERE lower(email) = $1 AND deleted_at IS NULL',
    [rows[0].email]
  )
  return {
    email: rows[0].email,
    name: rows[0].name,
    needsLinkLogin: Boolean(users[0]?.password_hash)
  }
}
export async function completeGoogleOnboarding(
  token,
  authenticatedUserId = null
) {
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw Object.assign(new Error('Restart Google sign-in to continue.'), {
      statusCode: 401
    })
  return withTransaction(async (connection) => {
    const { rows } = await connection.query(
      'SELECT * FROM oauth_onboarding WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP FOR UPDATE',
      [hash(token)]
    )
    const pending = rows[0]
    if (!pending)
      throw Object.assign(new Error('Restart Google sign-in to continue.'), {
        statusCode: 401
      })
    await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `google:${pending.subject}`
    ])
    const identity = await connection.query(
      "SELECT user_id FROM auth_identities WHERE provider = 'google' AND subject = $1",
      [pending.subject]
    )
    const existing = await connection.query(
      'SELECT * FROM users WHERE lower(email) = $1 FOR UPDATE',
      [pending.email]
    )
    let user = existing.rows[0]
    if (identity.rows.length) {
      const result = await connection.query(
        'SELECT * FROM users WHERE id = $1',
        [identity.rows[0].user_id]
      )
      user = result.rows[0]
    }
    if (user?.deleted_at || user?.role === 'admin')
      throw Object.assign(
        new Error('Use the account sign-in page for this account.'),
        { statusCode: 403 }
      )
    if (
      !identity.rows.length &&
      user?.password_hash &&
      authenticatedUserId !== user.id
    )
      throw Object.assign(
        new Error('Sign in to your existing account to link Google.'),
        { statusCode: 409 }
      )
    const userId =
      user?.id ||
      (
        await createUser(
          { name: pending.name, email: pending.email, verified: true },
          connection
        )
      ).id
    await connection.query('UPDATE users SET verified = TRUE WHERE id = $1', [
      userId
    ])
    await connection.query(
      "INSERT INTO auth_identities(id,user_id,provider,subject) VALUES ($1,$2,'google',$3) ON CONFLICT(provider,subject) DO NOTHING",
      [createId(), userId, pending.subject]
    )
    await connection.query(
      'INSERT INTO terms_acceptances(id,user_id,terms_version,privacy_version,method) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(user_id,terms_version) DO NOTHING',
      [createId(), userId, TERMS_VERSION, PRIVACY_VERSION, 'google']
    )
    await connection.query(
      'DELETE FROM oauth_onboarding WHERE token_hash = $1',
      [hash(token)]
    )
    return userId
  })
}
