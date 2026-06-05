# Firebase Auth Integration - Implementation TODO

## Plan Summary (Admin via existing Mongo + keep customer OTP)
Goal: Replace the backend JWT/password login for end users with Firebase Auth, but keep Mongo as the source of truth for roles (`users.role`) and keep `/register` OTP flow for customers.

## Steps
1. Inspect and update backend authentication middleware:
   - Add Firebase Admin verification of ID tokens.
   - Replace `requireAuth` to accept Firebase Bearer token (from `Authorization`) OR Firebase session cookie if you later choose it.
   - Preserve `requireAdmin` based on `req.user.role` (still read from Mongo).

2. Add a backend route to support frontend auth integration:
   - `POST /api/auth/firebase-login` (or `POST /api/auth/verify-token`) that:
     - verifies Firebase ID token
     - finds/creates the Mongo user record (customer)
     - returns the sanitized user
     - (optional) issues your own short-lived session JWT cookie if you want to avoid passing Firebase token for every request.

3. Update `GET /api/auth/me` and `GET/PATCH /api/users/me` authorization so it uses Firebase identity.

4. Update frontend auth layer:
   - Modify `src/context/AuthContext.jsx` and `src/lib/auth.js` / `src/lib/api.js` to use Firebase client SDK for login/logout.
   - Ensure every API call attaches `Authorization: Bearer <firebaseIdToken>`.
   - Keep calling `/api/auth/register`, `/api/auth/otp/send`, `/api/auth/otp/verify` for OTP registration.

5. Update admin login page behavior:
   - AdminLogin should use Firebase sign-in, then navigate only if Mongo role is `admin`.

6. Deployment on Render:
   - Add env vars required for Firebase Admin SDK.
   - Ensure CORS + cookies behavior still works.

7. Test matrix:
   - Customer OTP register -> login via Firebase? (decide: OTP only for profile completeness or still allow Firebase login)
   - Admin seeded in Mongo (`ADMIN_EMAIL`) must be able to sign in via Firebase and be recognized as admin by `users.role`.
   - Verify `admin/*` endpoints reject non-admin.

