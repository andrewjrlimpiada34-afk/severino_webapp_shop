import { normalizeEmail, normalizePhilippineMobile } from '../../server/shared/loginValidation.js'

export const checkoutStepFields = [
  ['name', 'barangay', 'city', 'province', 'zip', 'country'],
  ['mobile', 'email'],
]

export function normalizeCheckout(form) {
  const clean = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
  return { ...clean, mobile: normalizePhilippineMobile(clean.mobile), email: normalizeEmail(clean.email) }
}

export function checkoutErrors(form) {
  const clean = normalizeCheckout(form)
  return {
    name: clean.name?.length >= 2 ? '' : 'Enter your full name (at least 2 characters).',
    barangay: clean.barangay?.length >= 2 ? '' : 'Enter your barangay (at least 2 characters).',
    city: clean.city?.length >= 2 ? '' : 'Enter your city or municipality (at least 2 characters).',
    province: clean.province?.length >= 2 ? '' : 'Enter your province or state (at least 2 characters).',
    zip: clean.zip?.length >= 3 ? '' : 'Enter a ZIP code with at least 3 characters.',
    country: clean.country?.length >= 2 ? '' : 'Enter your country (at least 2 characters).',
    mobile: clean.mobile ? '' : 'Enter a valid Philippine mobile number.',
    email: clean.email ? '' : 'Enter a valid email address.',
  }
}

export function firstInvalidCheckoutStep(form) {
  const errors = checkoutErrors(form)
  return checkoutStepFields.findIndex((fields) => fields.some((field) => errors[field]))
}
