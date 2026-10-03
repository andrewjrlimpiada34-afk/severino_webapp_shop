# Python OTP service on Render

React continues using the same Node `/api/auth` routes. Node forwards OTP requests
to this authenticated Python service. Python generates and verifies codes, uses
the existing PostgreSQL `otps` table, and sends through Gmail API over HTTPS.
No SMTP or Promailer is used for OTP. Other application emails retain the existing mailer.

## Authorize the sending Gmail account locally

1. In Google Cloud, enable Gmail API. Configure the OAuth consent screen and add
   your sending Gmail account as a test user while setting up.
2. Create a **Desktop app** OAuth client and download its JSON into this directory
   as `gmail-credentials.json`. These are separate from website Google sign-in credentials.
3. From this directory, run:

   ```powershell
   python -m pip install -r requirements.txt
   python authorize_gmail.py gmail-credentials.json --sender youraccount@gmail.com
   ```

4. Sign in as the sending account and authorize Gmail sending. The helper writes
   `.env.gmail-api` locally. Copy its four values into the Python service's Render
   environment settings. Never commit that file or share the refresh token.
5. For lasting use, move the OAuth consent app out of Testing and reauthorize.
   External apps in Testing ordinarily have refresh tokens that expire after
   seven days for Gmail scopes. Complete any verification Google requires for
   your app's audience. This authorization belongs to the sender; customers
   do not need to sign into Google to receive OTPs.

Google references: [Sending mail](https://developers.google.com/workspace/gmail/api/guides/sending),
[OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

## Deploy

The repository `render.yaml` adds `severino-perfume-otp` as a separate Python web
service. Apply the Blueprint update, or create it manually with:

- Root directory: `server/otp_service`
- Runtime: Python; build: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Health path: `/health`
- Use the same PostgreSQL connection values and TLS CA as your Node backend.
  The existing Node schema deployment must run before starting Python.
- Set `OTP_SERVICE_KEY` to the same random secret of at least 32 characters on
  both services. Generate one locally with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Set `OTP_SERVICE_URL` on **Node** to the Python service's HTTPS URL.
- Set the four `GMAIL_API_*` values on **Python** and the existing `OTP_TTL_MS`,
  `OTP_RESEND_MS`, `OTP_MAX_ATTEMPTS`, and `MAIL_FROM_NAME` there.

The Blueprint uses Starter to avoid sleep latency; select your intended plan
before applying it (creating a paid service can incur charges). Free Python web
services work with HTTPS email but can sleep, making the first OTP request slow.
Node allows up to 90 seconds for Python; delivery errors return an error and
roll back the new challenge. Do not automatically retry a timed-out send.

Locally, supply the Python environment variables in your shell, run
`python -m uvicorn app:app --host 127.0.0.1 --port 8000`, and set Node's
`OTP_SERVICE_URL=http://127.0.0.1:8000`. Python does not automatically load `.env`.

## Verify deployment

Check `/health`, request an OTP through the unchanged registration page, confirm
the email arrives, verify the code, and create an account. Also check wrong-code,
expiry, resend cooldown, and exhausted-attempt behavior. Live delivery requires
your Google authorization and deployed service; local tests use mocked email.

New codes are stored as keyed digests, failed attempts persist transactionally,
and each mailbox is locked while issuing codes so concurrent sends obey the
cooldown. Earlier codes are invalidated after a successful resend. Send history
remains in `otps` to enforce five sends per mailbox per ten minutes even after
account registration. Changing the service key invalidates outstanding new codes.
