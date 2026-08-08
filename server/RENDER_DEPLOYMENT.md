# Render backend with Supabase PostgreSQL

The React frontend and API contract are unchanged. Supabase is used only as the hosted PostgreSQL database; Supabase Auth, Storage, and generated APIs are not used.

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
npm run db:check
npm run db:schema
npm run db:migrate
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

Add the existing Google OAuth, email, Cloudinary, JWT, admin, and `CLIENT_ORIGIN` variables unchanged. `GOOGLE_REDIRECT_URL` remains:

```text
https://YOUR-BACKEND.onrender.com/api/auth/google/callback
```

## 4. Cut over safely

Disable Render Auto-Deploy before pushing the PostgreSQL code. During a quiet period, run `npm run db:migrate` one final time locally, push the code, save the Supabase environment variables, and manually deploy the latest commit.

Verify:

```text
GET /
GET /health
GET /api/products
```

`/health` must return HTTP 200 with `database: "connected"`. Then test registration, login, products, cart, checkout, order tracking, stock updates, reviews, feedback, uploads, email, and admin functions.

Keep MongoDB Atlas and its credentials available for rollback until the Supabase deployment has been stable and verified. The migration reads MongoDB but does not delete its data.
