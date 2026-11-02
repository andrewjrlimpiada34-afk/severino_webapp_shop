// Shared by React and Express so both accept the same login identifiers.
const emailPattern = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i

export const normalizePhilippineMobile = (value = '') => {
  if (typeof value !== 'string') return ''
  const compact = value.replace(/[\s-]/g, '')
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`
  if (/^9\d{9}$/.test(compact)) return `+63${compact}`
  if (/^\+639\d{9}$/.test(compact)) return compact
  if (/^639\d{9}$/.test(compact)) return `+${compact}`
  return ''
}

export const normalizeEmail = (value = '') => {
  if (typeof value !== 'string') return ''
  const email = value.trim()
  return email.length <= 254 && emailPattern.test(email) ? email.toLowerCase() : ''
}

export const normalizeLoginIdentifier = (value = '') =>
  normalizePhilippineMobile(value) || normalizeEmail(value)

export const loginErrors = (identifier, password) => ({
  identifier: normalizeLoginIdentifier(identifier) ? '' : 'Enter a valid email address or Philippine mobile number.',
  password: typeof password !== 'string' || !password
    ? 'Enter your password.'
    : password.length < 8 ? 'Use at least 8 characters.' : '',
})
