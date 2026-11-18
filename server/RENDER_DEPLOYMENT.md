# Render backend with Supabase PostgreSQL

The Express backend owns authentication and application data access. Supabase supplies the hosted PostgreSQL database. The current release adds versioned account, inventory, payment, and address migrations. Follow [the enhancement rollout guide](../docs/ENHANCEMENT_ROLLOUT.md) for an existing PostgreSQL installation.

## 1. Create the free Supabase database

Create a Supabase project and save its database password. In **Project > Connect**, select the **Session pooler** connection because it supports IPv4 and is appropriate for a persistent Render backend.

Copy the session-pooler host, port, database, user, and password. Download the server root certificate from **Project Settings > Database > SSL Configuration**.

## 2. Configure a local migration connection

In `server/.env`, set the Supabase Session Pooler values:

```text
DB_HOST=YOUR_SESSION_POOLER_HOST
DB_PORT=5432
DB_USER=postgres.YOUR_PROJECT_REF
DB_PASSWORD=YOUR_DATABASE_PASSWORD
DB_NAME=postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA_BASE64=YOUR_BASE64_CERTIFICATE
```

Keep `MONGODB_URI`, `MONGODB_DB`, and `MIGRATION_DNS_SERVERS` temporarily so the migration script can read the old MongoDB database.

Run from `server`:

```powershell
npm.cmd run db:check
npm.cmd run db:schema -- --base-only
npm.cmd run db:migrate
npm.cmd run db:enhance
```

The schema enables Row Level Security without public policies. The Express backend connects directly with the Supabase Postgres database user and remains the only application data-access layer.

## 3. Update the existing Render backend

Keep the existing Render service and URL. Add the same Supabase values under **Environment**. Keep the old MongoDB variables temporarily for rollback.

Use these service settings:

- Root directory: `server`
- Build command: `npm ci --omit=dev`
- Pre-deploy command: `npm run db:schema` on a paid Render instance; leave blank on Free
- Start command: `npm start`
- Health check: `/health`

The repository's `render.yaml` selects the paid Starter plan because Render pre-deploy commands are not available on Free. If the existing backend must remain Free, do not sync that plan setting; apply the schema locally before deployment.

Keep the existing Google OAuth, email, Cloudinary, JWT, and admin variables. Set
`CLIENT_ORIGIN` to the frontend origin under **Render > Environment**:

```text
CLIENT_ORIGIN=https://severino-webapp-shop.vercel.app
```

This is the Vercel frontend URL, including `https://`. A browser's Origin does not
include a path. Configuration URLs are normalized, including trailing slashes.
If several frontends are needed, use a comma-separated list of explicitly trusted
origins. Put the main frontend first; Google sign-in redirects there. Preview
deployments must be listed individually. Wildcards are not supported with the
credentialed allowlist. Production has no localhost fallback.

Save the Render environment change and deploy the latest backend commit. Verify
that startup logs show the expected **Allowed frontend origins**. A CORS 403 log
includes the rejected Origin so it can be compared with this setting. Vercel's
`VITE_API_URL` should be `https://severino-webapp-shop.onrender.com`; frontend API
paths already include `/api`.

Rejected asynchronous route operations are forwarded to Express's error handler,
which returns a generic HTTP 500 and logs the original message and error code.
Database failures while checking a session return 500 without invalidating its
cookie. Unexpected fatal rejections still shut down the process, but now log their
actual cause before shutdown.

`GOOGLE_REDIRECT_URL` remains:

```text
https://YOUR-BACKEND.onrender.com/api/auth/google/callback
```

Automatic admin provisioning requires both `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
There is no default admin password. Existing admin accounts keep their current
passwords; changing the environment variables does not reset those passwords.

The login API returns a sanitized `user` alongside `requires2fa: false`, allowing
the frontend to reuse profile data without extra session/profile requests.
Deploy the Node backend and frontend changes together. No Python OTP service
changes or environment updates are required for this login/request cleanup.

## Order workflow and live inventory

The fulfillment stages are `Pending COD -> Approved -> To Ship -> To Receive -> To Review`.
Checkout reserves available stock in the order transaction. Approval and shipment
preparation retain that reservation. Moving an item to `To Receive` deducts physical
stock and consumes its reservation once. Eligible cancellations release reservations.
Accepted returned goods restore their recorded quantities through a separate action.

COD payment confirmation is an administrator action after actual collection has been
verified. Payment and refund records drive collected-sales reports. Inventory and
payment actions write audit records. Historical deduction markers are retained;
advanced items missing deduction evidence use the reconciliation action.

`GET /api/products/stock-events` streams inventory notifications. Each Node instance
listens on PostgreSQL channel `severino_inventory`. Keep a persistent connection
suitable for LISTEN/NOTIFY. Storefront clients refetch stock after committed events,
reconnects, and return to the tab. Stock-bearing responses use `Cache-Control: no-store`.

The enhancement migration is required before this backend starts. The tracked Render
blueprint runs `npm run db:schema` before deployment. Its migration history prevents a
repeat deployment from replaying the backfill. Review [migration and recovery steps](../docs/ENHANCEMENT_ROLLOUT.md)
when the service is configured manually.

## 4. Cut over safely

Disable Render Auto-Deploy before pushing the PostgreSQL code. For a legacy MongoDB cutover, complete the final import into the base-schema target before enhancement migration 001. For an existing PostgreSQL installation, use the coordinated enhancement rollout, then deploy the matching backend and frontend commit.

Verify:

```text
GET /
GET /health
GET /api/products
```

`/health` must return HTTP 200 with `database: "connected"`. Then test registration, login, products, cart, checkout, order tracking, stock updates, reviews, feedback, uploads, email, and admin functions.

Keep MongoDB Atlas and its credentials available for rollback until the Supabase deployment has been stable and verified. The migration reads MongoDB but does not delete its data.
