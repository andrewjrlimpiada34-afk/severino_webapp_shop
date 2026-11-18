# Enhancement implementation and validation

Revision date: November 19, 2026. Database release: `001_system_enhancements`.

## Completed behavior

Email registration and first-time Google onboarding require versioned policy acceptance. Google identities use verified provider information; a new Google customer needs no application password. Linking to an existing password account requires that existing account's authenticated session. Saved addresses support owned CRUD, a default, checkout selection, and immutable order delivery snapshots.

Catalog and cart controls respect available inventory and existing cart quantities. The backend resolves product identities and prices, checks whole quantities, and reserves stock inside checkout's transaction. A persistent checkout key recovers an uncertain submission without placing another order. Cart purchases remove only the purchased quantities in that same transaction. Older invalid cart entries can be adjusted together.

One checkout produces one customer order with prominent product names, a public reference, expandable product details, and tracking. Fulfillment and payment have separate badges. Approval retains reservations; dispatch deducts physical stock and consumes the reservation once. Eligible cancellations release commitments or restore documented legacy deductions. Inspected goods returns restore accepted quantities separately from financial refunds.

Administrators review and confirm actual COD collections. Collections and refunds record evidence, verifier, time, and audit entries. Requests are repeat-safe and refunds cannot exceed the remaining collection. Reports use verified payment events and show gross collections, refunds, and net collections. Unpaid orders and historical placement-only sales contribute no verified collections. A canceled order with retained collected money remains visible as a refund liability until reconciled.

Current user state and role are checked on protected requests. Cookie-authenticated mutations require the application's request header. Customer ownership is enforced independently of order references. Disabled users lose access while their transaction history remains. Customer order/review responses omit unnecessary internal user identifiers. Optional speech controls avoid overlapping readings, and weather has a visible action label.

## Verification results

| Check | Result | Evidence and scope |
| --- | --- | --- |
| JavaScript unit, route, migration, and database tests | 124 passed; 0 failed; 0 skipped | Node test runner, with a temporary PGlite PostgreSQL engine for actual migration SQL, constraints, triggers, and transactional domain tests |
| Python OTP tests | 11 passed | Existing isolated unittest suite; delivery calls are mocked |
| ESLint | Passed | Full configured repository lint |
| Production build | Passed | Vite, 126 modules; generated output remains ignored |
| Existing frontend/browser regression | 10 scenario groups passed | Five groups each at 1440 and 390 pixels |
| Storefront/browser regression | 100 scenario groups passed | Twenty groups each at 1440, 1024, 768, 390, and 320 pixels |
| Enhancement/browser verification | 36 scenario groups passed | Nine groups each at 1440, 768, 390, and 320 pixels; no recorded browser errors |
| Configured database preflight | Passed, read-only | Zero normalized-email duplicates, unresolved product references, legacy items requiring review, or insufficient-stock commitments in the checked database |
| Credential-pattern review | No high-confidence supported-pattern candidates found | Tracked source and selected Git-history patterns; frontend configuration names checked for privileged secrets |
| Documentation figures | 18 screenshots and 3 diagrams | Implemented React components with synthetic demonstration records; diagrams and database reference derived from the migrated schema |

Browser scenario-group totals count each viewport execution. They are interaction checks with assertions, rather than counts of individual assertions. The three browser suites total 146 successful scenario-group executions.

### Commands used

Run from the repository root in PowerShell. The PostgreSQL tests require an isolated engine. The temporary PGlite installation used during this revision is ignored by Git; contributors can instead set `TEST_DATABASE_URL` to a dedicated test database as described in [TESTCMD.md](../TESTCMD.md).

```powershell
$env:TEST_PGLITE_MODULE = (Resolve-Path 'tmp/validation/node_modules/@electric-sql/pglite/dist/index.js').Path
node --test "build/*.test.js" "src/**/*.test.js" "server/shared/*.test.js" "server/src/**/*.test.js"
.\.venv-otp\Scripts\python.exe -m unittest discover -s server/otp_service -p 'test_*.py' -v
npm.cmd run lint
npm.cmd run build
node tools/test_frontend.mjs
node tools/test_storefront.mjs
node tools/test_enhancements.mjs
npm.cmd --prefix server run db:preflight
git diff --check
```

`db:preflight` reads the database selected by the server environment. The automated database test helper deliberately does not use the application's `DATABASE_URL`.

## Acceptance coverage

| Requirement | Verification |
| --- | --- |
| Google users need no Google password | Provider-state and verified-email route tests; password-free onboarding browser check; secure existing-account linking tests |
| Registration requires explicit acceptance | Backend rejects missing/current-version mismatches; browser checks initially unchecked consent and disabled completion |
| Stock limits are enforced | Cart API validation, authoritative checkout prices and quantities, duplicate identity consolidation, reservation constraints, stock-limited stepper and old-cart repair checks |
| Addresses persist and work at checkout | SQL-backed owned CRUD/default checks, order snapshot preservation, edit/default/selection browser checks |
| Customers track whole orders | Browser verifies one card with two distinct named products, a public reference, expandable details, and independent payment status |
| Unpaid orders are excluded from sales | Database payment/history checks and reporting fixtures verify gross, refunds, net, and unpaid/pending metrics |
| Only administrators confirm payments | HTTP role/ownership checks; current-user authorization; administrator payment dialog checks |
| Payment/inventory actions resist duplicates | SQL-backed repeated checkout, collection, refund, dispatch, cancellation, return, and cart-consumption checks; repeated-submit browser checks |
| Cancellations and refunds preserve balances | Reservation release/restoration tests, partial/full refund bounds, accepted-return quantities, and audit checks |
| Credentials and private IDs stay protected | Safe serializers, authorization checks with references, CSRF/origin regressions, logging whitelist, source/history secret-pattern review |
| Desktop/tablet/mobile remain usable | Browser assertions at five widths; keyboard/modal interaction checks; reviewed documentation screenshots |
| Documentation matches implementation | Migrated-schema attribute/index reference, schema-derived ERD, implementation-based architecture and lifecycle diagrams, final component screenshots |

The database test suite injects a mid-transaction event-publication failure and confirms that the order, reservation, and related writes roll back. Migration tests also verify that insufficient legacy commitment stock aborts the migration without partially applying it.

## Database and deployment changes

The [migration](../server/sql/migrations/001_system_enhancements.sql) adds identities, acceptance evidence, onboarding tokens, addresses, relational order items, verified payments, inventory logs, and administrator audits. It also adds reservation balances, safe references, checkout idempotency, historical snapshots, and constraints/indexes. Existing JSON order items remain the compatibility representation; a database trigger maintains the relational projection.

The migration runner applies the change atomically and records its version. `db:schema` includes ordered migrations; legacy MongoDB imports must use the base schema before enhancement migration. Backend startup requires migration 001. The existing Render blueprint's pre-deploy schema hook executes the migration; manually configured services need the equivalent hook. Vercel's whitelist includes the shared policy-version module.

The configured database received read-only preflight checks during this work. Applying the migration and deploying the services are rollout actions that remain to be performed. Follow [ENHANCEMENT_ROLLOUT.md](ENHANCEMENT_ROLLOUT.md), including backup, maintenance coordination, and release verification, before an auto-deploying push.

## Remaining verification and operating limits

- Run a real Google authorization round trip and Gmail OTP delivery check with deployed provider credentials and callback URLs. Automated tests substitute the provider and delivery boundaries.
- The PGlite adapter serializes access through one SQL session. It exercises real PostgreSQL SQL, transactions, and constraints, but cannot prove multi-session lock contention. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database to exercise the same integration cases using independent pool connections.
- Verify production cookies, CORS, SSE refresh, provider callbacks, and speech behavior on the intended browsers/devices after rollout. Browser fixture tests supply synthetic API responses.
- Email changes require support verification. Existing password-account linking uses the customer's original Severino password; new Google-only accounts have no extra password requirement.
- Secret-pattern scans are bounded checks and do not establish a complete credential or penetration audit. No confirmed exposed credential required rotation during this revision.
- The maintained manual is Markdown with committed PNG screenshots. Editable diagram sources are DOT with shareable SVG output. Historical ignored Word submissions are separate artifacts.
- Historical payment and consent evidence is not invented by the migration. Administrators reconcile any genuine legacy inventory exception with supporting records.

## Changed files

The inventory below contains the source, tests, configuration, and maintained documentation changed for this revision. Temporary engines, dependencies, generated build output, browser profiles, and environment files are excluded.

<!-- changed-file-inventory -->

```text
.vercelignore
README.md
TESTCMD.md
docs/DATABASE_SCHEMA.md
docs/ENHANCEMENT_ROLLOUT.md
docs/IMPLEMENTATION_VALIDATION.md
docs/README.md
docs/REPOSITORY_MAP.md
docs/SYSTEM_DESIGN.md
docs/USER_MANUAL.md
docs/diagrams/entity_relationships.dot
docs/diagrams/entity_relationships.svg
docs/diagrams/order_payment_inventory.dot
docs/diagrams/order_payment_inventory.svg
docs/diagrams/system_architecture.dot
docs/diagrams/system_architecture.svg
docs/images/1440-admin-orders.png
docs/images/1440-checkout-review.png
docs/images/1440-checkout-saved.png
docs/images/1440-google-onboarding.png
docs/images/1440-inventory.png
docs/images/1440-order-tracking.png
docs/images/1440-payment-confirmation.png
docs/images/1440-payment-review.png
docs/images/1440-product-detail.png
docs/images/1440-quantity.png
docs/images/1440-registration-terms.png
docs/images/1440-registration.png
docs/images/1440-sales.png
docs/images/1440-saved-addresses.png
docs/images/1440-shop.png
docs/images/390-order-tracking.png
docs/images/390-payment-review.png
docs/images/768-checkout-saved.png
eslint.config.js
server/RENDER_DEPLOYMENT.md
server/package.json
server/scripts/apply-schema.js
server/scripts/migrate-enhancements.js
server/scripts/migrate-mongo-to-postgres.js
server/shared/orderWorkflow.js
server/shared/policyVersions.js
server/sql/migrations/001_system_enhancements.sql
server/src/db/addresses.js
server/src/db/audit.js
server/src/db/googleIdentity.js
server/src/db/index.js
server/src/db/inventory.js
server/src/db/migrations.test.js
server/src/db/orders.js
server/src/db/orders.test.js
server/src/db/payments.js
server/src/db/products.js
server/src/db/testDatabase.js
server/src/db/users.js
server/src/index.js
server/src/lib/clientOrigins.test.js
server/src/lib/inventoryEvents.js
server/src/lib/logging.js
server/src/middleware/auth.js
server/src/middleware/csrf.js
server/src/middleware/csrf.test.js
server/src/routes/addresses.js
server/src/routes/admin.js
server/src/routes/auth.js
server/src/routes/auth.test.js
server/src/routes/cart.js
server/src/routes/faqs.test.js
server/src/routes/feedback.js
server/src/routes/google.test.js
server/src/routes/orders.js
server/src/routes/products.js
server/src/routes/resilience.test.js
server/src/routes/reviews.js
server/src/routes/users.js
server/src/routes/users.test.js
src/App.jsx
src/components/AdaptiveScentFloating.jsx
src/components/AddressBook.jsx
src/components/HomeScrollVideo.jsx
src/components/InventoryLog.jsx
src/components/Modal.jsx
src/components/PaymentDialog.jsx
src/components/PolicyModal.jsx
src/components/QuantityControl.jsx
src/components/SpeechControls.jsx
src/components/StatusBadge.jsx
src/components/TermsAcceptance.jsx
src/context/AuthContext.jsx
src/data/policies.js
src/enhancements.css
src/index.css
src/lib/api.js
src/lib/apiClient.js
src/lib/apiClient.test.js
src/lib/registration.js
src/lib/registration.test.js
src/pages/Account.jsx
src/pages/AdminDashboard.jsx
src/pages/AdminProducts.jsx
src/pages/AdminSalesReport.jsx
src/pages/AdminViewOrders.jsx
src/pages/AdminViewUsers.jsx
src/pages/Billing.jsx
src/pages/Cart.jsx
src/pages/Checkout.jsx
src/pages/CreateAccount.jsx
src/pages/FAQs.jsx
src/pages/Favorites.jsx
src/pages/Feedback.jsx
src/pages/GoogleOnboarding.jsx
src/pages/Login.jsx
src/pages/Notifications.jsx
src/pages/OrderHistory.jsx
src/pages/ProductDetail.jsx
src/pages/Shop.jsx
src/utils/adminSales.js
src/utils/adminSales.test.js
src/utils/salesReportPdf.js
tools/test_enhancements.mjs
tools/test_frontend.mjs
tools/test_storefront.mjs
```
