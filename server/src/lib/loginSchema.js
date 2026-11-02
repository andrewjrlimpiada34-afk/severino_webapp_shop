import { z } from 'zod'
import { loginErrors, normalizeLoginIdentifier } from '../../shared/loginValidation.js'

export const loginSchema = z.object({
  identifier: z.string().optional(),
  // Keep email-only clients compatible during deployment.
  email: z.string().optional(),
  password: z.string().min(8, 'Use at least 8 characters.'),
}).superRefine((data, context) => {
  const errors = loginErrors(data.identifier || data.email || '', data.password)
  if (errors.identifier) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['identifier'], message: errors.identifier })
  }
}).transform((data) => ({
  identifier: normalizeLoginIdentifier(data.identifier || data.email || ''),
  password: data.password,
}))
