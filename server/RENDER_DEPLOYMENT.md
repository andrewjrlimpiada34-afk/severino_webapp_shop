# Render production deployment

The React frontend and API contract are unchanged. Only the backend database has moved from MongoDB to MySQL.

## 1. Provision production MySQL 8

The MySQL instance on your development computer is not reachable from Render. Use one of these options:

- Deploy the official Render MySQL 8 template as a private service with a persistent disk. Keep MySQL and the backend in the same Render region. Use the private service name as `DB_HOST` and set `DB_SSL=false`.
- Use an external hosted MySQL 8 provider. Set its public hostname as `DB_HOST`, enable `DB_SSL=true`, and add the provider CA with `DB_SSL_CA_BASE64` when required.

Create regular logical backups with `mysqldump`. Do not rely only on disk snapshots.

## 2. Create the Render backend

Create a Blueprint from the repository's root `render.yaml`. It configures:

- Root directory: `server`
- Build command: `npm ci --omit=dev`
- Pre-deploy command: `npm run db:schema`
- Start command: `npm start`
- Health check: `/health`
- Region: Singapore

The pre-deploy command requires a paid Render web-service instance. The Blueprint uses the `starter` plan.

## 3. Set Render environment variables

Never upload `server/.env`. Enter secrets in the Render Dashboard when the Blueprint prompts for variables.

Required application variables:

- `CLIENT_ORIGIN`: exact deployed frontend origin, without a trailing slash
- `JWT_SECRET`: keep the same value across redeploys
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Required database variables:

- `DB_HOST`
- `DB_PORT` (normally `3306`)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL` (`false` for a Render private MySQL service; normally `true` for an external provider)

Add the existing Google OAuth, email, and Cloudinary variables to preserve those features. Set `GOOGLE_REDIRECT_URL` to:

```text
https://YOUR-BACKEND.onrender.com/api/auth/google/callback
```

## 4. Move existing data to production MySQL

The successful local migration populated local MySQL only. The production MySQL database needs a separate migration.

For an external MySQL provider, temporarily point the local `DB_*` variables to production, keep the old `MONGODB_URI`, and run:

```powershell
npm run db:check
npm run db:schema
npm run db:migrate
```

For a private Render MySQL service, deploy the backend without switching frontend traffic, temporarily add `MONGODB_URI`, `MONGODB_DB`, and `MIGRATION_DNS_SERVERS` in Render, then run `npm run db:migrate` from the Render Shell. Remove the MongoDB variables after verifying the migration.

Do not run the data migration repeatedly after it succeeds.

## 5. Connect the frontend

Set the frontend deployment variable:

```text
VITE_API_URL=https://YOUR-BACKEND.onrender.com
```

Set the backend's `CLIENT_ORIGIN` to the exact Vercel/frontend origin. Redeploy the frontend after changing a Vite environment variable.

## 6. Production checks

Verify these endpoints first:

```text
GET /
GET /health
GET /api/products
```

`/health` must return HTTP 200 with `database: "connected"`. Then test registration, login, products, cart, checkout, order tracking, stock updates, reviews, feedback, uploads, email, and admin functions.
