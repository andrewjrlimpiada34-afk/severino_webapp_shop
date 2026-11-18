# PostgreSQL database reference

Generated from the base schema and enhancement migration 001 on November 19, 2026. Attribute names, keys, indexes, and defaults reflect PostgreSQL metadata.

## admin_audit_logs

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| admin_id | character varying(24) | YES | FK |  |
| action | character varying(80) | NO |  |  |
| order_id | character varying(24) | YES | FK |  |
| details | jsonb | NO |  | '{}'::jsonb |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## app_settings

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| setting_key | character varying(100) | NO | PK |  |
| setting_value | jsonb | NO |  |  |
| updated_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## auth_identities

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| user_id | character varying(24) | NO | UQ2, FK |  |
| provider | character varying(30) | NO | UQ1, UQ2 |  |
| subject | character varying(255) | NO | UQ1 |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## carts

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| user_id | character varying(24) | NO | UQ1, FK |  |
| items | jsonb | NO |  | '[]'::jsonb |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## customer_addresses

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| user_id | character varying(24) | NO | FK |  |
| label | character varying(60) | NO |  |  |
| name | character varying(150) | NO |  |  |
| phone | character varying(30) | NO |  |  |
| address_line | character varying(255) | NO |  | ''::character varying |
| barangay | character varying(150) | NO |  |  |
| city | character varying(150) | NO |  |  |
| province | character varying(150) | NO |  |  |
| zip | character varying(20) | NO |  |  |
| country | character varying(100) | NO |  |  |
| is_default | boolean | NO |  | false |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## feedback

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| user_id | character varying(24) | YES | FK |  |
| order_id | character varying(24) | YES | FK |  |
| rating | smallint | NO |  |  |
| message | text | NO |  |  |
| attachment | jsonb | YES |  |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## inventory_logs

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| product_id | character varying(24) | NO | FK |  |
| order_id | character varying(24) | YES | FK |  |
| item_key | character varying(250) | YES |  |  |
| action | character varying(40) | NO |  |  |
| stock_delta | integer | NO |  |  |
| reserved_delta | integer | NO |  |  |
| stock_after | integer | NO |  |  |
| reserved_after | integer | NO |  |  |
| actor_id | character varying(24) | YES | FK |  |
| operation_key | character varying(300) | NO | UQ1 |  |
| reason | character varying(500) | NO |  | ''::character varying |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## oauth_onboarding

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| token_hash | character varying(64) | NO | PK |  |
| subject | character varying(255) | NO |  |  |
| email | character varying(320) | NO |  |  |
| name | character varying(150) | NO |  |  |
| expires_at | timestamp with time zone | NO |  |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## order_items

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| order_id | character varying(24) | NO | PK, FK |  |
| item_key | character varying(250) | NO | PK |  |
| product_id | character varying(24) | YES | FK |  |
| product_reference | character varying(191) | NO |  |  |
| name | character varying(255) | NO |  |  |
| quantity | integer | NO |  |  |
| unit_price | numeric(12,2) | NO |  |  |
| tracking_status | character varying(60) | NO |  |  |
| snapshot | jsonb | NO |  |  |

## orders

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| user_id | character varying(24) | NO | FK |  |
| items | jsonb | NO |  | '[]'::jsonb |
| total | numeric(12,2) | NO |  | 0 |
| status | character varying(60) | NO |  |  |
| address | text | NO |  |  |
| contact_name | character varying(150) | NO |  |  |
| phone | character varying(30) | NO |  |  |
| email | character varying(320) | NO |  |  |
| payment_method | character varying(30) | NO |  |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |
| reference | character varying(32) | NO |  |  |
| checkout_key | character varying(100) | YES |  |  |
| request_fingerprint | character varying(64) | YES |  |  |
| address_snapshot | jsonb | YES |  |  |
| original_total | numeric(12,2) | NO |  |  |
| payment_status | character varying(30) | NO |  | 'Unpaid'::character varying |
| gross_collected | numeric(12,2) | NO |  | 0 |
| refunded_total | numeric(12,2) | NO |  | 0 |
| paid_at | timestamp with time zone | YES |  |  |
| archived_at | timestamp with time zone | YES |  |  |

## otps

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(384) | NO | PK |  |
| user_id | character varying(24) | YES | FK |  |
| email | character varying(320) | YES |  |  |
| phone | character varying(30) | YES |  |  |
| code | character varying(20) | NO |  |  |
| type | character varying(50) | NO |  | 'register'::character varying |
| expires_at | bigint | NO |  |  |
| attempts | integer | NO |  | 0 |
| verified_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## payments

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| order_id | character varying(24) | NO | UQ1, FK |  |
| kind | character varying(15) | NO |  |  |
| status | character varying(30) | NO |  |  |
| amount | numeric(12,2) | NO |  |  |
| method | character varying(40) | NO |  |  |
| transaction_reference | character varying(150) | NO |  |  |
| reason | character varying(500) | NO |  | ''::character varying |
| items_snapshot | jsonb | NO |  | '[]'::jsonb |
| request_key | character varying(100) | NO | UQ1 |  |
| verified_by | character varying(24) | YES | FK |  |
| verified_at | timestamp with time zone | YES |  |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## products

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| legacy_id | character varying(191) | YES | UQ1 |  |
| name | character varying(255) | NO |  |  |
| price | numeric(12,2) | NO |  | 0 |
| stock | integer | NO |  | 0 |
| notes | text | YES |  |  |
| description | text | YES |  |  |
| image_url | text | YES |  |  |
| image_urls | jsonb | NO |  | '[]'::jsonb |
| size | character varying(50) | YES |  |  |
| category | character varying(100) | YES |  |  |
| active | boolean | NO |  | true |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |
| reserved_stock | integer | NO |  | 0 |

## reviews

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| product_id | character varying(24) | NO | FK |  |
| user_id | character varying(24) | YES | FK |  |
| user_name | character varying(150) | YES |  |  |
| user_email | character varying(320) | YES |  |  |
| rating | smallint | NO |  |  |
| comment | text | NO |  |  |
| attachment | jsonb | YES |  |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## sales

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| order_id | character varying(24) | NO | FK |  |
| total | numeric(12,2) | NO |  |  |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## schema_migrations

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| version | character varying(100) | NO | PK |  |
| applied_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## terms_acceptances

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| user_id | character varying(24) | NO | UQ1, FK |  |
| terms_version | character varying(40) | NO | UQ1 |  |
| privacy_version | character varying(40) | NO |  |  |
| method | character varying(30) | NO |  |  |
| accepted_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |

## users

| Attribute | Type | Nullable | Keys | Default |
| --- | --- | --- | --- | --- |
| id | character varying(24) | NO | PK |  |
| name | character varying(150) | NO |  |  |
| email | character varying(320) | YES | UQ1 |  |
| phone | character varying(30) | YES | UQ2 |  |
| password_hash | character varying(255) | YES |  |  |
| role | character varying(30) | NO |  | 'customer'::character varying |
| verified | boolean | NO |  | false |
| address | text | YES |  |  |
| address_line | character varying(255) | YES |  |  |
| barangay | character varying(150) | YES |  |  |
| city | character varying(150) | YES |  |  |
| province | character varying(150) | YES |  |  |
| zip | character varying(20) | YES |  |  |
| country | character varying(100) | YES |  |  |
| backup_address | text | YES |  |  |
| profile_image | text | YES |  |  |
| preferred_theme | character varying(100) | NO |  | 'Default'::character varying |
| created_at | timestamp with time zone | NO |  | CURRENT_TIMESTAMP |
| deleted_at | timestamp with time zone | YES |  |  |

## Indexes

```sql
CREATE INDEX admin_audit_logs_order ON public.admin_audit_logs USING btree (order_id, created_at);
CREATE UNIQUE INDEX admin_audit_logs_pkey ON public.admin_audit_logs USING btree (id);
CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (setting_key);
CREATE UNIQUE INDEX auth_identities_pkey ON public.auth_identities USING btree (id);
CREATE UNIQUE INDEX auth_identities_provider_subject_key ON public.auth_identities USING btree (provider, subject);
CREATE UNIQUE INDEX auth_identities_user_id_provider_key ON public.auth_identities USING btree (user_id, provider);
CREATE UNIQUE INDEX carts_pkey ON public.carts USING btree (id);
CREATE UNIQUE INDEX carts_user_id_key ON public.carts USING btree (user_id);
CREATE UNIQUE INDEX customer_addresses_default ON public.customer_addresses USING btree (user_id) WHERE is_default;
CREATE UNIQUE INDEX customer_addresses_pkey ON public.customer_addresses USING btree (id);
CREATE INDEX customer_addresses_user ON public.customer_addresses USING btree (user_id);
CREATE UNIQUE INDEX feedback_pkey ON public.feedback USING btree (id);
CREATE INDEX idx_feedback_created ON public.feedback USING btree (created_at);
CREATE UNIQUE INDEX inventory_logs_operation_key_key ON public.inventory_logs USING btree (operation_key);
CREATE UNIQUE INDEX inventory_logs_pkey ON public.inventory_logs USING btree (id);
CREATE INDEX inventory_logs_product ON public.inventory_logs USING btree (product_id, created_at);
CREATE UNIQUE INDEX oauth_onboarding_pkey ON public.oauth_onboarding USING btree (token_hash);
CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (order_id, item_key);
CREATE INDEX order_items_product ON public.order_items USING btree (product_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at);
CREATE UNIQUE INDEX orders_checkout_key ON public.orders USING btree (user_id, checkout_key) WHERE (checkout_key IS NOT NULL);
CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id);
CREATE UNIQUE INDEX orders_reference_key ON public.orders USING btree (reference);
CREATE INDEX idx_otps_email_type_created ON public.otps USING btree (email, type, created_at);
CREATE INDEX idx_otps_phone_type_created ON public.otps USING btree (phone, type, created_at);
CREATE UNIQUE INDEX otps_pkey ON public.otps USING btree (id);
CREATE UNIQUE INDEX payments_one_collection ON public.payments USING btree (order_id) WHERE ((kind)::text = 'collection'::text);
CREATE UNIQUE INDEX payments_order_id_request_key_key ON public.payments USING btree (order_id, request_key);
CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);
CREATE INDEX payments_verified_at ON public.payments USING btree (verified_at) WHERE ((status)::text = 'Paid'::text);
CREATE UNIQUE INDEX payments_verified_reference ON public.payments USING btree (order_id, kind, method, transaction_reference) WHERE ((status)::text = 'Paid'::text);
CREATE INDEX idx_products_active ON public.products USING btree (active);
CREATE INDEX idx_products_category ON public.products USING btree (category);
CREATE UNIQUE INDEX products_legacy_id_key ON public.products USING btree (legacy_id);
CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);
CREATE INDEX idx_reviews_product_created ON public.reviews USING btree (product_id, created_at);
CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id);
CREATE INDEX idx_sales_order ON public.sales USING btree (order_id);
CREATE UNIQUE INDEX sales_pkey ON public.sales USING btree (id);
CREATE UNIQUE INDEX schema_migrations_pkey ON public.schema_migrations USING btree (version);
CREATE UNIQUE INDEX terms_acceptances_pkey ON public.terms_acceptances USING btree (id);
CREATE UNIQUE INDEX terms_acceptances_user_id_terms_version_key ON public.terms_acceptances USING btree (user_id, terms_version);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX users_normalized_email ON public.users USING btree (lower((email)::text)) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
```

## Snapshot and lifecycle fields

- `orders.items` preserves the established API representation. The `orders_sync_items` trigger maintains relational `order_items` on every item/status write. Item quantity and price are immutable after placement.
- `orders.address_snapshot` preserves the selected shipping components, recipient, phone, delivery email, formatted address, and optional delivery notes.
- Item snapshots contain `itemId`, `productId`, `name`, `quantity`, `price`, `trackingStatus`, and timestamped `trackingEvents`. Inventory fields include `reservationActive`, `stockDeductedAt`, `stockDeductedQuantity`, `stockRestoredAt`, `returnedQuantity`, and `inventoryReviewRequired` where applicable.
- `payments.items_snapshot` fixes the products used for collection/refund allocations at verification.
- `sales` retains historical placement entries. Verified revenue queries use `payments`.
- `schema_migrations` records completed upgrades. New business tables enable RLS and are accessed through the Express database connection.
