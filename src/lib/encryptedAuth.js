const encodeBase64 = (value) =>
  btoa(Array.from(new Uint8Array(value), (byte) => String.fromCharCode(byte)).join(''))

// Encrypt the full body so identifiers and every password field stay out of
// Network payloads. HTTPS still authenticates the server and protects the page.
export async function encryptAuthPayload(payload, { publicKey, keyToken }, target) {
  const crypto = globalThis.crypto
  if (!crypto?.subtle) {
    throw new Error('Secure sign-in requires HTTPS or localhost and a browser with Web Crypto support.')
  }

  const rsaKey = await crypto.subtle.importKey(
    'jwk', publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']
  )
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(`${keyToken}:${target}`), tagLength: 128 },
    aesKey,
    encoder.encode(JSON.stringify(payload))
  )
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' }, rsaKey, await crypto.subtle.exportKey('raw', aesKey)
  )

  return {
    keyToken,
    wrappedKey: encodeBase64(wrappedKey),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
  }
}

export async function requestEncryptedAuth(request, path, payload, method = 'POST') {
  const encryption = await request('/api/auth/encryption-key')
  const body = await encryptAuthPayload(payload, encryption, `${method} ${path}`)
  return request(path, { method, body: JSON.stringify(body) })
}
