# Test Commands

Run commands from the **repository root in PowerShell**, unless a section says
otherwise. The frontend and backend do not currently define an `npm test`
script; use the existing Node.js test files directly.

## Prerequisites

Use Node.js 24.x and npm 11.x. Install the JavaScript dependencies once:

```powershell
npm ci
npm --prefix server ci
```

For Python OTP tests, create the Python 3.12 environment and install its
dependencies once:

```powershell
python -m venv .venv-otp
.\.venv-otp\Scripts\python.exe -m pip install -r server/otp_service/requirements.txt
```

The automated regression suites below use fixtures and mocked database/email
operations. Database integration suites additionally require `TEST_DATABASE_URL`
or `TEST_PGLITE_MODULE`; otherwise they report a skip. Their configuration is
described below. The tests do not require deployed application services.
Backend route tests start temporary servers on the local loopback interface.

## Security Test

Run this command in your terminal:

```powershell
node --test server/shared/loginValidation.test.js server/src/lib/clientOrigins.test.js server/src/lib/encryptedAuth.test.js server/src/lib/logging.test.js server/src/routes/auth.test.js server/src/routes/users.test.js server/src/otp-client.test.js src/lib/registration.test.js
```

Checks login validation, trusted frontend origins, secure login cookies,
encrypted credential requests, safe development/error logs, credential redaction, failed-login rate limiting,
verified registration proof, authenticated account lookups, and the
Node-to-Python OTP contract.

**Expected:** all selected tests pass and Node exits with code `0`. These are
focused security regression checks, not a complete penetration test or security
certification. Run the separate Python OTP tests for code expiry and send limits.

## Frontend Logic Test

Run this command in your terminal:

```powershell
node --test "src/**/*.test.js"
```

Checks API request behavior, checkout and registration validation, shared
inventory state, order progression, address grouping, and sales calculations.
This tests JavaScript logic; browser rendering is covered separately below.

**Expected:** no failed tests and exit code `0`.

## Backend and Shared Helpers Test

Run this command in your terminal:

```powershell
node --test "server/shared/*.test.js" "server/src/**/*.test.js"
```

Checks shared validation and banner helpers, authentication and account routes,
order workflow and stock transactions, inventory notifications, CORS handling,
OTP forwarding, FAQ publishing and admin authorization, and resilience to
simulated database failures.

**Expected:** no failed tests and exit code `0`. Some tests deliberately trigger
errors; use the final test summary and exit code to determine the result.

## Python OTP Test

Run this command in your terminal:

```powershell
.\.venv-otp\Scripts\python.exe -m unittest discover -s server/otp_service -p "test_*.py" -v
```

Checks challenge-bound code digests, expiry and attempt limits, verified state,
resend cooldowns and send limits, delivery failures, internal authentication,
and mocked Gmail HTTPS delivery. Database and email operations are mocked.

**Expected:** unittest reports `OK` and exits with code `0`.

## Build Asset Rules Test

Run this command in your terminal:

```powershell
node --test build/publicAssets.test.js
```

Checks that active assets are copied, disabled scroll-video frame directories
are excluded, and a project without a public directory can still build. Uses
temporary fixture directories rather than the original animation frames.

**Expected:** all asset-copy tests pass.

## All JavaScript Regression Tests

Run this command in your terminal:

```powershell
node --test "build/*.test.js" "src/**/*.test.js" "server/shared/*.test.js" "server/src/**/*.test.js"
```

Runs the JavaScript suites above together. Run the Python and browser commands
separately; this command does not include them.

**Expected:** no failed tests and exit code `0`.

## PostgreSQL integration tests

Use a dedicated test PostgreSQL database with a role allowed to create schemas.
The harness creates a unique `test_enhancements_...` schema, runs the real schema
and migrations, exercises API and database behavior, and removes that test schema.
It uses `TEST_DATABASE_URL` explicitly. The application `DATABASE_URL` is replaced
with an intercepted placeholder inside the test process.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/severino_test'
node --test server/src/db/orders.test.js server/src/db/migrations.test.js server/src/routes/google.test.js
Remove-Item Env:TEST_DATABASE_URL
```

For isolated validation without a PostgreSQL server, install PGlite in the ignored
temporary tools directory and point the same suites to its module.

```powershell
npm.cmd install --prefix tmp/validation @electric-sql/pglite --no-audit --no-fund --ignore-scripts
$env:TEST_PGLITE_MODULE = (Resolve-Path 'tmp/validation/node_modules/@electric-sql/pglite/dist/index.js').Path
node --test "build/*.test.js" "src/**/*.test.js" "server/shared/*.test.js" "server/src/**/*.test.js"
Remove-Item Env:TEST_PGLITE_MODULE
```

PGlite runs PostgreSQL in one embedded session. Its test adapter serializes
transactions. Use `TEST_DATABASE_URL` for multiple-session row-lock contention
verification. Both adapters test the actual SQL, constraints, triggers, rollback,
checkout retries, inventory lifecycle, payment/refund limits, ownership checks,
Google onboarding, and legacy migration behavior.

## Enhancement browser tests

```powershell
node tools/test_enhancements.mjs
```

Exercises registration acceptance, password-free Google onboarding, stock limits,
saved-address editing and checkout selection, uncertain-checkout recovery,
order-level tracking, explicit payment confirmation, inventory/reporting displays,
and speech controls at 1440, 768, 390, and 320 pixels. Uses production components
with synthetic API records and a stubbed speech engine. Screenshots and reports
are saved to `tmp/enhancement-qa/`.

Use `--width=390` for a focused check. `--previews-only` captures screenshots and
skips assertions, so it does not verify the scenarios. Selected maintained
screenshots are copied to `docs/images/` for the user manual after visual review.

## Browser UI Test

Requires Microsoft Edge at
`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. If installed
elsewhere, set its actual path for the current terminal first:

```powershell
$env:EDGE_PATH = 'C:\path\to\msedge.exe'
```

Run these commands in your terminal:

```powershell
node tools/test_frontend.mjs
node tools/test_storefront.mjs
```

The scripts bundle isolated React fixtures using esbuild from the root Vite
dependency tree and launch a headless browser. They replace account and catalog
requests with test data. No running API or OTP service is required.

- `test_frontend.mjs` checks frontend interactions at desktop and mobile widths;
  artifacts are written under `node_modules/.cache/frontend-qa/`.
- `test_storefront.mjs` checks storefront flows, public FAQ access, and FAQ
  management through the admin menu at 1440, 1024, 768, 390, and 320 pixels;
  reports and screenshots are written to `tmp/storefront-qa/`.

To check one storefront width, or exercise reduced-motion preferences:

```powershell
node tools/test_storefront.mjs --width=390
node tools/test_storefront.mjs --width=390 --reduced-motion
```

**Expected:** reported checks pass and each script exits with code `0`. Review
the generated screenshots for visual problems too. `--previews-only` skips the
storefront assertions, so it should not be used as proof that tests passed.

## Lint Check

Run this command in your terminal:

```powershell
npm run lint
```

Checks files covered by the existing ESLint configuration. It does not rewrite
files. **Expected:** exit code `0`; investigate any reported errors rather than
assuming this guide means the current code is lint-clean.

## Production Build Check

Run these commands in your terminal:

```powershell
npm run build
npm run preview
```

**Expected:** Vite builds successfully into `dist/`. Open the preview URL printed
in the terminal and check the affected screens. Preview keeps running until
`Ctrl+C`; API-backed features still need the configured backend services.

## Dependency Security Audit

Run these commands in your terminal:

```powershell
npm audit
npm --prefix server audit
```

Requires network access to the configured npm registry. These commands inspect
the frontend and backend dependency trees without applying fixes. A nonzero exit
code can mean vulnerabilities were found or the registry request failed; read
the output. This audit does not cover Python requirements.

## Local Service Health Check

Start the configured Node and Python services using the
[README setup instructions](README.md#local-setup), then run:

```powershell
Invoke-RestMethod -Uri 'http://localhost:4000/health'
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health'
```

**Expected:** the API returns `status: ok` and `database: connected`; Python
returns `status: ok`. These are live checks against your configured database,
separate from the mocked regression suites. They do not verify actual email
delivery; follow the [OTP verification guide](server/otp_service/README.md#verify-deployment)
for that flow.

[Documentation index](docs/README.md) | [Contributing](CONTRIBUTING.md)
