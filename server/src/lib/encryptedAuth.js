import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { z } from 'zod'

const keyLifetimeMs = 2 * 60 * 1000
const keyContext = Buffer.from('severino-auth-encryption-v1')
const base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/)
const envelopeSchema = z.object({
  keyToken: base64.max(8192),
  wrappedKey: base64.length(344),
  iv: base64.length(16),
  ciphertext: base64.min(24),
}).strict()
let keyPair

const getWrappingKey = () => {
  if (!process.env.JWT_SECRET) throw new Error('Authentication encryption is unavailable')
  return crypto.hkdfSync('sha256', process.env.JWT_SECRET, keyContext, 'key-wrapping', 32)
}

const decrypt = (key, iv, ciphertext, additionalData) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(additionalData)
  decipher.setAuthTag(ciphertext.subarray(-16))
  return Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()])
}

export async function createAuthEncryptionKey() {
  // Generate once per process without blocking Express. The encrypted key token
  // lets any replica with the same JWT_SECRET decrypt requests across restarts.
  if (!keyPair) {
    keyPair = promisify(crypto.generateKeyPair)('rsa', { modulusLength: 2048 }).catch((error) => {
      keyPair = undefined
      throw error
    })
  }
  const { publicKey, privateKey } = await keyPair
  const expiresAt = Date.now() + keyLifetimeMs
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getWrappingKey(), iv)
  cipher.setAAD(keyContext)
  const keyData = JSON.stringify({
    expiresAt,
    privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  })
  const encryptedKey = Buffer.concat([cipher.update(keyData, 'utf8'), cipher.final()])
  const keyToken = Buffer.concat([iv, encryptedKey, cipher.getAuthTag()]).toString('base64')
  return { publicKey: publicKey.export({ format: 'jwk' }), keyToken }
}

export function decryptAuthPayload(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try {
    const envelope = envelopeSchema.parse(req.body)
    const keyToken = Buffer.from(envelope.keyToken, 'base64')
    const keyData = JSON.parse(decrypt(
      getWrappingKey(), keyToken.subarray(0, 12), keyToken.subarray(12), keyContext
    ).toString('utf8'))
    if (keyData.expiresAt <= Date.now()) throw new Error('Expired encryption key')

    const key = crypto.privateDecrypt({
      key: crypto.createPrivateKey({ key: Buffer.from(keyData.privateKey, 'base64'), format: 'der', type: 'pkcs8' }),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, Buffer.from(envelope.wrappedKey, 'base64'))
    const target = `${req.method} ${req.baseUrl}${req.path}`
    const plaintext = decrypt(
      key,
      Buffer.from(envelope.iv, 'base64'),
      Buffer.from(envelope.ciphertext, 'base64'),
      Buffer.from(`${envelope.keyToken}:${target}`)
    )
    req.body = JSON.parse(plaintext.toString('utf8'))
  } catch {
    return res.status(400).json({ message: 'Secure request expired or invalid. Refresh the page and try again.' })
  }
  return next()
}
