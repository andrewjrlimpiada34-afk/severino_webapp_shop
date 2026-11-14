# Repository Map

## Main directories

```text
.
|-- .github/                  Issue and pull request templates
|-- build/                    Vite public-asset plugin and its tests
|-- docs/                     Documentation index and repository map
|-- public/                   Static images, logos, fonts, and media
|-- server/
|   |-- otp_service/          Python FastAPI OTP service and unittest suite
|   |-- scripts/              Database checks, schema setup, legacy migration
|   |-- shared/               Helpers imported by both frontend and backend
|   |-- sql/                  PostgreSQL schema
|   |-- src/
|   |   |-- db/               PostgreSQL access and domain persistence
|   |   |-- lib/              Server helpers, schemas, cache, inventory events
|   |   |-- middleware/       Authentication and error handling
|   |   |-- routes/           Express API routes and route tests
|   |   `-- index.js          API startup and service health endpoint
|   |-- package.json          Backend dependencies and database/start commands
|   `-- RENDER_DEPLOYMENT.md  Backend deployment guide
|-- src/
|   |-- assets/               Frontend assets imported by source files
|   |-- components/           Reusable storefront and admin UI
|   |-- config/               Storefront feature flags
|   |-- context/              Authentication and shared UI state
|   |-- data/                 Catalog-related data and store policies
|   |-- hooks/                Shared React hooks
|   |-- lib/                  API clients, validation, state helpers, tests
|   |-- pages/                Customer and admin pages
|   |-- services/             Weather service integration
|   |-- utils/                Sales, order, scent, and PDF helpers
|   |-- App.jsx               Application routes and page composition
|   `-- main.jsx              React entry point
|-- tools/                    Browser QA scripts
|-- CONTRIBUTING.md           Contribution and review expectations
|-- README.md                 Project overview and local setup
|-- TESTCMD.md                Test and verification commands
|-- package.json              Frontend dependencies and Vite/lint commands
|-- render.yaml               Node API and Python OTP service configuration
|-- vercel.json               Frontend hosting and route rewrites
`-- vite.config.js            Frontend build configuration
```

## How the services connect

The React app sends `/api/...` requests to the Node API at `VITE_API_URL`.
Express handles authentication, catalog/cart/order operations, uploads, and
administration. It accesses PostgreSQL through `server/src/db/`.

For OTP operations, Node calls the internal Python service using
`OTP_SERVICE_URL` and `OTP_SERVICE_KEY`. Python stores verification state in
PostgreSQL and sends OTP email through Gmail API. Both services use the same
database and shared service key.

`server/shared/` contains dependency-free login validation, banner content,
and order workflow helpers used by both JavaScript applications. Its location
inside `server/` does not mean it is backend-only. Vercel deployment rules
explicitly include the shared runtime helpers.

## Tests and build inputs

- JavaScript regression tests use `*.test.js` beside their related code.
- Python OTP tests live in `server/otp_service/test_app.py`.
- Browser interaction and screenshot scripts live in `tools/`.
- `build/` contains tracked build source; generated frontend output is `dist/`.
- Stylesheets live at the top of `src/` and are used by the application and
  browser fixtures.
- Homepage animation frames, when present, use `public/desktop_homevideo/` and
  `public/mobile_homevideo/`. The current feature flag disables their production
  inclusion; see the [build overview](../README.md#build-and-deployment).

## Generated and local files

Local checkouts can also contain `node_modules/`, `server/node_modules/`,
`.venv-otp/`, `dist/`, `tmp/`, and `deliverables/`. These hold dependencies,
builds, browser QA artifacts, or school submissions and are ignored by Git.
Environment files and credentials remain local as well.

[Documentation index](README.md) | [Test commands](../TESTCMD.md)
