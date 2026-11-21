import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import { hasTestDatabase, useTestDatabase } from '../db/testDatabase.js'

test(
  'Google onboarding requires verified identity, consent, and existing account ownership',
  { skip: !hasTestDatabase && 'Set TEST_DATABASE_URL or TEST_PGLITE_MODULE.' },
  async (context) => {
    const database = await useTestDatabase(context)
    const { migrateEnhancements } =
      await import('../../scripts/migrate-enhancements.js')
    await migrateEnhancements()
    process.env.GOOGLE_CLIENT_ID = 'test-google-client'
    process.env.GOOGLE_CLIENT_SECRET = 'test-only-google-secret'
    process.env.GOOGLE_REDIRECT_URL =
      'https://api.example.com/api/auth/google/callback'
    process.env.CLIENT_ORIGIN = 'https://shop.example.com'
    let googleProfile = {
      id: 'google-subject-new',
      displayName: 'Google customer',
      emails: [{ value: 'GOOGLE@example.com' }],
      _json: { email_verified: true }
    }
    context.mock.method(
      passport,
      'authenticate',
      (strategy, options, callback) => () => callback(null, googleProfile)
    )
    const { default: routes } = await import('./auth.js')
    const { default: addressRoutes } = await import('./addresses.js')
    const { protectCookieMutations } = await import('../middleware/csrf.js')
    const { errorHandler } = await import('../middleware/error.js')
    const app = express()
    app.use(express.json(), cookieParser(), protectCookieMutations)
    app.use('/api/auth', routes)
    app.use('/api/addresses', addressRoutes)
    app.use(errorHandler)
    const server = await new Promise((done) => {
      const instance = app.listen(0, '127.0.0.1', () => done(instance))
    })
    context.after(async () => {
      server.closeAllConnections()
      await new Promise((done) => server.close(done))
    })
    const base = `http://127.0.0.1:${server.address().port}`
    const callback = (validState = true) =>
      fetch(
        `${base}/api/auth/google/callback?state=${validState ? 'test-state' : 'bad-state'}`,
        { redirect: 'manual', headers: { Cookie: 'oauth_state=test-state' } }
      )
    const complete = (
      cookie,
      data = { termsAccepted: true, termsVersion: '2026-11-19' },
      header = true
    ) =>
      fetch(`${base}/api/auth/google/complete`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
          ...(header ? { 'X-Severino-Request': '1' } : {})
        },
        body: JSON.stringify(data)
      })
    let onboardingCookie
    await context.test(
      'invalid state and unverified or absent verified-email claims create no account',
      async () => {
        assert.match(
          (await callback(false)).headers.get('Location'),
          /cancelled/
        )
        for (const verified of [false, undefined]) {
          googleProfile._json.email_verified = verified
          assert.match((await callback()).headers.get('Location'), /failed/)
        }
        assert.equal(
          (await database.query('SELECT COUNT(*)::int AS count FROM users'))
            .rows[0].count,
          0
        )
        googleProfile._json.email_verified = true
      }
    )
    await context.test(
      'a new Google identity is pending until explicit current terms acceptance',
      async () => {
        const response = await callback()
        assert.equal(
          response.headers.get('Location'),
          'https://shop.example.com/google-onboarding'
        )
        onboardingCookie = `google_onboarding=${response.headers.get('Set-Cookie').match(/google_onboarding=([^;]+)/)[1]}`
        assert.equal(
          (await database.query('SELECT COUNT(*)::int AS count FROM users'))
            .rows[0].count,
          0
        )
        assert.equal(
          (
            await complete(onboardingCookie, {
              termsAccepted: false,
              termsVersion: '2026-11-19'
            })
          ).status,
          400
        )
        const completed = await complete(onboardingCookie)
        assert.equal(completed.status, 200)
        const user = await completed.json()
        assert.deepEqual(Object.keys(user).sort(), ['id', 'preferredTheme', 'profileImage', 'role'])
        const account = (await database.query('SELECT email, password_hash FROM users WHERE id = $1', [user.id])).rows[0]
        assert.equal(account.email, 'google@example.com')
        assert.ok(!account.password_hash)
        assert.equal(
          (
            await database.query(
              'SELECT COUNT(*)::int AS count FROM terms_acceptances'
            )
          ).rows[0].count,
          1
        )
        assert.equal((await complete(onboardingCookie)).status, 401)
        assert.equal(
          (await database.query('SELECT COUNT(*)::int AS count FROM users'))
            .rows[0].count,
          1
        )
        assert.equal(
          (await callback()).headers.get('Location'),
          'https://shop.example.com'
        )
      }
    )
    await context.test(
      'linking a password account requires an authenticated session belonging to that account',
      async () => {
        const existing = 'cccccccccccccccccccccccc'
        await database.query(
          "INSERT INTO users(id,name,email,password_hash,role,verified) VALUES ($1,'Existing customer','existing@example.com','existing-hash','customer',TRUE)",
          [existing]
        )
        googleProfile = {
          ...googleProfile,
          id: 'google-subject-existing',
          emails: [{ value: 'EXISTING@example.com' }]
        }
        const response = await callback()
        const cookie = `google_onboarding=${response.headers.get('Set-Cookie').match(/google_onboarding=([^;]+)/)[1]}`
        assert.equal((await complete(cookie)).status, 409)
        const token = jwt.sign(
          { id: existing, role: 'customer' },
          process.env.JWT_SECRET
        )
        assert.equal(
          (await complete(`${cookie}; token=${token}`, undefined, false))
            .status,
          403
        )
        assert.equal((await complete(`${cookie}; token=${token}`)).status, 200)
        assert.equal(
          (
            await database.query(
              'SELECT user_id FROM auth_identities WHERE subject=$1',
              ['google-subject-existing']
            )
          ).rows[0].user_id,
          existing
        )
        assert.equal(
          (await database.query('SELECT COUNT(*)::int AS count FROM users'))
            .rows[0].count,
          2
        )
        await database.query(
          'UPDATE users SET deleted_at=CURRENT_TIMESTAMP WHERE id=$1',
          [existing]
        )
        const revoked = await fetch(`${base}/api/addresses`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        assert.equal(revoked.status, 401)
      }
    )
    await context.test(
      'legacy Google customers receive verified account access when onboarding adds their provider identity',
      async () => {
        const legacy = 'dddddddddddddddddddddddd'
        await database.query(
          "INSERT INTO users(id,name,email,password_hash,role,verified) VALUES ($1,'Legacy Google customer','legacy-google@example.com','','customer',FALSE)",
          [legacy]
        )
        googleProfile = {
          ...googleProfile,
          id: 'legacy-google-subject',
          emails: [{ value: 'legacy-google@example.com' }]
        }
        const response = await callback()
        const onboarding =
          'google_onboarding=' +
          response.headers
            .get('Set-Cookie')
            .match(/google_onboarding=([^;]+)/)[1]
        const completed = await complete(onboarding)
        assert.equal(completed.status, 200)
        assert.equal((await completed.json()).id, legacy)
        const account = (await database.query('SELECT verified, password_hash FROM users WHERE id=$1', [legacy])).rows[0]
        assert.equal(account.verified, true)
        assert.ok(!account.password_hash)
        const tokenCookie =
          'token=' +
          completed.headers.get('Set-Cookie').match(/(?:^|, )token=([^;]+)/)[1]
        assert.equal(
          (
            await fetch(base + '/api/addresses', {
              headers: { Cookie: tokenCookie }
            })
          ).status,
          200
        )
      }
    )
  }
)
