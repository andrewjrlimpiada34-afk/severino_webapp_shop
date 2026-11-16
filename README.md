# Severino Perfume Web App

A perfume shopping and store management application with a React storefront,
an Express API, PostgreSQL storage, and a separate Python email OTP service.

[Test commands](TESTCMD.md) | [Documentation index](docs/README.md) |
[Repository map](docs/REPOSITORY_MAP.md) | [Contributing](CONTRIBUTING.md)

## Features

- **Customers:** browse and search perfumes, save favorites, manage a cart,
  check out with cash on delivery, track orders, manage account details, and
  submit reviews and feedback.
- **FAQs:** guests and customers can read expandable answers at `/faqs`.
  Administrators manage questions and answers from the **FAQs** menu at
  `/admin/faqs`. Saved changes publish immediately. FAQ content uses the existing
  PostgreSQL `app_settings` table, starting with ten editable answers about
  existing app features.
- **Store administrators:** manage products and inventory, advance order
  fulfillment, view customers and feedback, customize storefront content, and
  inspect sales reports.
- **Account access:** email/mobile login, Google sign-in when configured, and
  email OTP verification during registration.
- **Storefront tools:** shared live inventory updates, scent suggestions, and
  weather-based scent information.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 18, React Router, Vite, CSS |
| Backend API | Node.js, Express |
| Database | PostgreSQL; hosted deployment uses Supabase PostgreSQL |
| OTP service | Python, FastAPI, Gmail API |
| Media uploads | Cloudinary |
| Deployment configuration | Vercel frontend; Render Node and Python services |
| Tests | Node.js test runner, Python unittest, browser QA scripts |

## Local setup

Commands below use PowerShell and start in the repository root. Use separate
terminals for the frontend, API, and OTP service.

### 1. Install dependencies

Use Node.js **24.x** and npm **11.x**, matching the backend's declared engines,
plus Python **3.12** for the OTP service. A PostgreSQL database is required to
run the API.

```powershell
npm ci
npm --prefix server ci
python -m venv .venv-otp
.\.venv-otp\Scripts\python.exe -m pip install -r server/otp_service/requirements.txt
```

### 2. Configure local environment values

Create a root `.env` file for the frontend:

```dotenv
VITE_API_URL=http://localhost:4000
```

Use the API origin without `/api`; request paths already include that prefix.
Frontend `VITE_` values are visible in the browser, so keep private credentials
in the backend or OTP process environment.

Create `server/.env` for the API. This example assumes a **local development
PostgreSQL database**; replace the placeholders with your own local values:

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=replace-with-your-local-database-password
DB_NAME=severino
DB_SSL=false
JWT_SECRET=replace-with-a-long-random-private-secret
OTP_SERVICE_URL=http://127.0.0.1:8000
OTP_SERVICE_KEY=replace-with-a-random-shared-secret-at-least-32-characters
```

For hosted PostgreSQL, use the connection and certificate settings in the
[backend deployment guide](server/RENDER_DEPLOYMENT.md) instead of the local
database example. Google sign-in requires `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URL`. Media uploads and other
application emails require their corresponding Cloudinary and mail settings.

The Python process needs the same PostgreSQL connection values and
`OTP_SERVICE_KEY`, plus `GMAIL_API_CLIENT_ID`, `GMAIL_API_CLIENT_SECRET`,
`GMAIL_API_REFRESH_TOKEN`, and `GMAIL_API_SENDER`. Follow the
[OTP setup guide](server/otp_service/README.md) to authorize the sender and set
those environment variables. **Python does not automatically load `.env`.**

### 3. Initialize the development database

Create the PostgreSQL database first, then run:

```powershell
npm --prefix server run db:check
npm --prefix server run db:schema
```

`db:schema` writes tables, indexes, and database policies to the configured
database. Use your development database for local setup. The legacy
`db:migrate` command is for the documented MongoDB-to-PostgreSQL migration;
it is not part of a fresh installation or a test run.

### 4. Start the services

**Terminal 1 - Python OTP:** after configuring its process environment, run:

```powershell
.\.venv-otp\Scripts\python.exe -m uvicorn app:app --app-dir server/otp_service --host 127.0.0.1 --port 8000
```

**Terminal 2 - Node API:**

```powershell
npm --prefix server start
```

**Terminal 3 - React frontend:**

```powershell
npm run dev
```

| Service | Default local address |
| --- | --- |
| Storefront | `http://localhost:5173` |
| Admin sign-in | `http://localhost:5173/admin/login` |
| API health | `http://localhost:4000/health` |
| OTP health | `http://127.0.0.1:8000/health` |

Open the frontend URL printed by Vite. If its port changes, update
`CLIENT_ORIGIN` to match. Initial admin provisioning requires both
`ADMIN_EMAIL` and `ADMIN_PASSWORD` in the API environment; there is no default
admin password. Updating those values does not reset an existing account.

Login, registration, and password changes encrypt their complete request bodies
with Web Crypto before sending them. Both admin and customer login use this
flow. The API issues a public RSA key and an encrypted key token valid for two
minutes, then decrypts requests before the existing validation and bcrypt checks.
Replicas must share the same `JWT_SECRET`. Deploy the API and frontend together
because these endpoints require encrypted bodies. The browser needs HTTPS or
localhost for Web Crypto. HTTPS remains required in production, and anyone
controlling the browser can inspect values entered into it.

Development access logs contain only the HTTP method, status, and timing.
Error logs contain a fixed event name, status/method when available, and a known
error code. Request bodies, headers, URLs, query strings, raw error messages,
stack traces, and email-provider responses are omitted in every environment.
Browser DevTools can inspect requests independently of application logging.

## Testing

See [TESTCMD.md](TESTCMD.md) for security regression tests, frontend and backend
tests, Python OTP tests, browser QA, linting, dependency audits, and build checks.
It explains prerequisites, working directories, and expected results.

## Build and deployment

```powershell
npm run build
npm run preview
```

The frontend build is written to `dist/`. Preview serves that build locally;
the Node API and Python OTP service run separately.

- [Vercel configuration](vercel.json): builds the frontend, publishes `dist/`,
  and rewrites client-side routes to `index.html`.
- [Render configuration](render.yaml): describes the Node API and Python OTP
  services. Review its service plans before applying it.
- [Backend deployment guide](server/RENDER_DEPLOYMENT.md): PostgreSQL setup,
  environment configuration, order workflow, and deployment verification.
- [OTP service guide](server/otp_service/README.md): Gmail authorization,
  service configuration, and verification.

Public assets are copied by `build/publicAssets.js`. The
`SHOW_HOME_SCROLL_VIDEO` flag in `src/config/storefrontFeatures.js` is currently
`false`, so production builds exclude the `desktop_homevideo` and
`mobile_homevideo` frame directories. Enabling that feature requires its frame
assets to be present. The asset-copy behavior has its own regression tests.

## Repository and contributions

Start with the [repository map](docs/REPOSITORY_MAP.md) to locate frontend,
backend, shared helpers, database scripts, and test files. The
[documentation index](docs/README.md) links all project guides.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use the
bug report and feature request templates for new GitHub issues. Keep local
credentials, generated documents, and browser QA output out of commits.
