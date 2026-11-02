import { normalizeEmail, normalizePhilippineMobile } from '../../server/shared/loginValidation.js'

export { normalizePhilippineMobile }

export const registrationSteps = ['Profile', 'Verify email', 'Security', 'Address', 'Review']

export const registrationStepFields = [
  ['firstName', 'lastName', 'email', 'mobile'],
  [],
  ['password', 'confirmPassword'],
  ['barangay', 'city', 'province', 'zip', 'country'],
  [],
]

export function registrationProgress(form, verification) {
  const email = form.email.trim().toLowerCase()
  const errors = {
    firstName: form.firstName.trim() ? '' : 'Enter your first name.',
    lastName: form.lastName.trim() ? '' : 'Enter your last name.',
    email: normalizeEmail(email) ? '' : 'Enter a valid email address.',
    mobile: normalizePhilippineMobile(form.mobile) ? '' : 'Enter a valid Philippine mobile number.',
    password: form.password.length >= 8 ? '' : 'Use at least 8 characters.',
    confirmPassword: form.confirmPassword && form.password === form.confirmPassword ? '' : 'Passwords must match.',
    barangay: form.barangay.trim() ? '' : 'Enter your barangay.',
    city: form.city.trim() ? '' : 'Enter your city or municipality.',
    province: form.province.trim() ? '' : 'Enter your province or state.',
    zip: form.zip.trim() ? '' : 'Enter your ZIP code.',
    country: form.country.trim() ? '' : 'Enter your country.',
  }
  const verified = Boolean(verification.verified && verification.challengeId && verification.email === email)
  const complete = registrationStepFields.map((fields, index) =>
    index === 1 ? verified : index === 4 ? false : fields.every((field) => !errors[field])
  )
  const firstIncomplete = complete.findIndex((value) => !value)
  return { errors, complete, verified, furthestStep: firstIncomplete + 1, canCreate: complete.slice(0, 4).every(Boolean) }
}
