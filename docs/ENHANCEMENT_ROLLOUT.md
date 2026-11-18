# Enhancement migration and deployment

Enhancement migration **001_system_enhancements** adds account identities and policy acceptance, saved addresses, payment evidence, inventory reservations, audit logs, and relational order items. The application release requires this migration.

## Existing PostgreSQL installation

1. Prepare a database backup or provider snapshot and confirm how to restore it.
2. Use the release checkout's `server/.env` or server environment to target the intended database. Keep private values server-side.
3. Run the read-only preflight from the repository root.

```powershell
npm.cmd --prefix server run db:preflight
```

The result reports normalized-email collisions, unresolved product references, historical items requiring stock review, and insufficient stock for pending commitments. Resolve collisions or commitment shortages before migration. Historical advanced items can retain an inventory-review flag for administrator reconciliation.

4. Coordinate a maintenance interval that pauses order placement, inventory changes, and account creation. Coordinate frontend/backend auto-deployment so the migration and the corresponding services can be released together.
5. Apply the ordered migration using the release checkout.

```powershell
npm.cmd --prefix server run db:enhance
```

6. Deploy the matching Node backend and React frontend. The existing Python OTP service contract continues to supply registration verification.
7. Verify API health, both authentication methods, registration acceptance, saved addresses, checkout, dispatch, cancellation, COD verification, refunds, inventory history, and sales reports. Reopen writes after the checks pass.

Migration changes run in one PostgreSQL transaction under an advisory migration lock. Migration history makes a repeated application safe. DDL or backfill failures roll back the migration. The preflight is read-only.

The tracked Render blueprint already declares `preDeployCommand: npm run db:schema`, which applies the same versioned migration. Services configured from that blueprint can use the hook during the coordinated deployment. Services configured manually need the equivalent pre-deploy command or the explicit `db:enhance` step. The backend startup checks migration history before accepting requests. Vercel's source rules include the shared policy-version module used by registration.

## New installation

After configuring a development PostgreSQL database, initialize the base schema and ordered migrations together.

```powershell
npm.cmd --prefix server run db:schema
```

## Legacy MongoDB import

Import MongoDB data into a base-schema target before applying migration 001. This preserves the upgrade's opportunity to backfill reservations, snapshots, addresses, and relational items consistently.

```powershell
npm.cmd --prefix server run db:schema -- --base-only
npm.cmd --prefix server run db:migrate
npm.cmd --prefix server run db:preflight
npm.cmd --prefix server run db:enhance
```

The legacy importer checks migration history and refuses an upgraded target. The existing MongoDB configuration is required only for that legacy import.

## Data preservation and reconciliation

- Existing order and customer identifiers remain the internal relationship keys. New random public references are assigned to historical orders.
- Pending undeducted order items receive reservations when stock supports their commitments. A shortage aborts the migration.
- Historical deduction markers retain their recorded evidence. Advanced items without deduction evidence receive `inventoryReviewRequired` and use the administrator reconciliation action before relevant stock changes.
- Complete structured profile addresses become default saved addresses. Historical backup text remains accessible on the account page for conversion into a structured saved address.
- Existing order addresses and purchased item details become historical snapshots. A trigger synchronizes the relational order-item projection with the established JSON representation.
- Historical placement sales remain stored. Verified payments and terms acceptance require actual evidence and administrator/customer actions.
- User and sales foreign keys preserve transaction history. Account removal disables access and active sessions are checked against current user state.

## Configuration and external checks

Keep `JWT_SECRET`, database credentials, `GOOGLE_CLIENT_SECRET`, Cloudinary credentials, `OTP_SERVICE_KEY`, and Gmail credentials in their server environments. The frontend uses public `VITE_API_URL` configuration. Set the exact allowed frontend origins and the matching Google callback URL for the deployed services.

Verify the real Google provider round trip and email delivery using the configured deployment. Verify browser/platform speech behavior on the intended customer devices. Source and history pattern scans found no high-confidence private-key or supported provider-secret candidates during this revision. Provider-console access remains the source for credential rotation when an exposure is confirmed.

## Recovery

If the migration fails, inspect its preflight findings and database constraints, correct the underlying data or connection issue, and retry. If release verification fails after migration, keep writes paused and reconcile the code/database release together. After new payments, refunds, or inventory events have been recorded, preserve those events during recovery. Use the verified backup/restore procedure when reverting the complete release.

Keep exported database backups, local environments, temporary browser profiles, and test engine installations outside Git. Maintained documentation figures and screenshots are under `docs/`.
