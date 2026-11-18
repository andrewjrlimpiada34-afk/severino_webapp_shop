ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE UNIQUE INDEX users_normalized_email ON users(lower(email)) WHERE email IS NOT NULL;
UPDATE users SET email = lower(trim(email)) WHERE email IS NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD CONSTRAINT products_reserved_stock_check CHECK (reserved_stock >= 0 AND reserved_stock <= stock);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference VARCHAR(32);
UPDATE orders SET reference = 'SV-' || UPPER(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)) WHERE reference IS NULL;
ALTER TABLE orders ALTER COLUMN reference SET NOT NULL;
CREATE UNIQUE INDEX orders_reference_key ON orders(reference);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_key VARCHAR(100);
CREATE UNIQUE INDEX orders_checkout_key ON orders(user_id, checkout_key) WHERE checkout_key IS NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_snapshot JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_total NUMERIC(12,2);
UPDATE orders SET original_total = total WHERE original_total IS NULL;
ALTER TABLE orders ALTER COLUMN original_total SET NOT NULL;
UPDATE orders SET address_snapshot = jsonb_build_object('formatted', address, 'name', contact_name, 'phone', phone, 'email', email) WHERE address_snapshot IS NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'Unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gross_collected NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gross_collected >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_total >= 0 AND refunded_total <= gross_collected);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('Unpaid', 'Pending Verification', 'Paid', 'Failed', 'Partially Refunded', 'Refunded'));
ALTER TABLE orders DROP CONSTRAINT orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE sales DROP CONSTRAINT sales_order_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

CREATE TABLE auth_identities (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL CHECK (provider = 'google'),
  subject VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, subject), UNIQUE(user_id, provider)
);
CREATE TABLE terms_acceptances (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version VARCHAR(40) NOT NULL,
  privacy_version VARCHAR(40) NOT NULL,
  method VARCHAR(30) NOT NULL CHECK (method IN ('email', 'google')),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, terms_version)
);
CREATE TABLE oauth_onboarding (
  token_hash VARCHAR(64) PRIMARY KEY,
  subject VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  name VARCHAR(150) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE customer_addresses (
  id VARCHAR(24) PRIMARY KEY,
  user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address_line VARCHAR(255) NOT NULL DEFAULT '',
  barangay VARCHAR(150) NOT NULL,
  city VARCHAR(150) NOT NULL,
  province VARCHAR(150) NOT NULL,
  zip VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX customer_addresses_user ON customer_addresses(user_id);
CREATE UNIQUE INDEX customer_addresses_default ON customer_addresses(user_id) WHERE is_default;
INSERT INTO customer_addresses(id, user_id, label, name, phone, address_line, barangay, city, province, zip, country, is_default)
SELECT id, id, 'Home', name, COALESCE(phone, ''), COALESCE(address_line, ''), barangay, city, province, zip, country, TRUE
FROM users WHERE role = 'customer' AND COALESCE(barangay, '') <> '' AND COALESCE(city, '') <> '' AND COALESCE(province, '') <> '' AND COALESCE(zip, '') <> '' AND COALESCE(country, '') <> '';

CREATE TABLE payments (
  id VARCHAR(24) PRIMARY KEY,
  order_id VARCHAR(24) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  kind VARCHAR(15) NOT NULL CHECK (kind IN ('collection', 'refund')),
  status VARCHAR(30) NOT NULL CHECK (status IN ('Pending Verification', 'Paid', 'Failed')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(40) NOT NULL,
  transaction_reference VARCHAR(150) NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  items_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  request_key VARCHAR(100) NOT NULL,
  verified_by VARCHAR(24) REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, request_key),
  CHECK ((status = 'Paid') = (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (kind <> 'refund' OR status = 'Paid')
);
CREATE UNIQUE INDEX payments_one_collection ON payments(order_id) WHERE kind = 'collection';
CREATE UNIQUE INDEX payments_verified_reference ON payments(order_id, kind, method, transaction_reference) WHERE status = 'Paid';
CREATE INDEX payments_verified_at ON payments(verified_at) WHERE status = 'Paid';
CREATE TABLE admin_audit_logs (
  id VARCHAR(24) PRIMARY KEY,
  admin_id VARCHAR(24) REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(80) NOT NULL,
  order_id VARCHAR(24) REFERENCES orders(id) ON DELETE RESTRICT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX admin_audit_logs_order ON admin_audit_logs(order_id, created_at);
CREATE TABLE inventory_logs (
  id VARCHAR(24) PRIMARY KEY,
  product_id VARCHAR(24) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_id VARCHAR(24) REFERENCES orders(id) ON DELETE RESTRICT,
  item_key VARCHAR(250),
  action VARCHAR(40) NOT NULL,
  stock_delta INTEGER NOT NULL,
  reserved_delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  reserved_after INTEGER NOT NULL CHECK (reserved_after >= 0 AND reserved_after <= stock_after),
  actor_id VARCHAR(24) REFERENCES users(id) ON DELETE RESTRICT,
  operation_key VARCHAR(300) NOT NULL UNIQUE,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX inventory_logs_product ON inventory_logs(product_id, created_at);

-- Reserve only pending legacy items. Advanced records need existing deduction
-- evidence or explicit administrator reconciliation before further stock changes.
DO $$
DECLARE pending RECORD; changed_items JSONB; entry JSONB; product_row RECORD; canonical_id VARCHAR(24);
BEGIN
  FOR pending IN SELECT id, items, status FROM orders WHERE status NOT IN ('Cancelled', 'Removed') ORDER BY created_at, id LOOP
    changed_items := '[]'::JSONB;
    FOR entry IN SELECT value FROM jsonb_array_elements(pending.items) LOOP
      IF COALESCE(entry->>'trackingStatus', pending.status) IN ('Pending', 'Pending COD') AND NOT (entry ? 'stockDeductedAt') THEN
        SELECT id, stock, reserved_stock INTO product_row FROM products WHERE id = entry->>'productId' OR legacy_id = entry->>'productId' LIMIT 1;
        IF NOT FOUND OR (entry->>'quantity')::INTEGER < 1 OR product_row.stock - product_row.reserved_stock < (entry->>'quantity')::INTEGER THEN
          RAISE EXCEPTION 'Pending orders require inventory reconciliation before migration. Order %', pending.id;
        END IF;
        canonical_id := product_row.id;
        UPDATE products SET reserved_stock = reserved_stock + (entry->>'quantity')::INTEGER WHERE id = canonical_id;
        entry := entry || jsonb_build_object('productId', canonical_id, 'reservationActive', TRUE);
      ELSIF COALESCE(entry->>'trackingStatus', pending.status) IN ('Approved', 'Verified', 'To Ship', 'To Receive', 'To Review', 'Delivered', 'Completed') AND NOT (entry ? 'stockDeductedAt') THEN
        entry := entry || jsonb_build_object('inventoryReviewRequired', TRUE);
      END IF;
      changed_items := changed_items || jsonb_build_array(entry);
    END LOOP;
    UPDATE orders SET items = changed_items WHERE id = pending.id;
  END LOOP;
END $$;
INSERT INTO inventory_logs(id, product_id, action, stock_delta, reserved_delta, stock_after, reserved_after, operation_key, reason)
SELECT id, id, 'opening_balance', 0, reserved_stock, stock, reserved_stock, 'opening:' || id, 'Physical balance preserved at migration; pending commitments reserved' FROM products;

-- Relational projection supports foreign keys while preserving the established
-- JSON item API during the staged migration. One trigger owns synchronization.
CREATE TABLE order_items (
  order_id VARCHAR(24) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  item_key VARCHAR(250) NOT NULL,
  product_id VARCHAR(24) REFERENCES products(id) ON DELETE RESTRICT,
  product_reference VARCHAR(191) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  tracking_status VARCHAR(60) NOT NULL,
  snapshot JSONB NOT NULL,
  PRIMARY KEY(order_id, item_key)
);
CREATE INDEX order_items_product ON order_items(product_id);
CREATE FUNCTION sync_order_items() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO order_items(order_id, item_key, product_id, product_reference, name, quantity, unit_price, tracking_status, snapshot)
  SELECT NEW.id, COALESCE(e.value->>'itemId', (e.ordinality - 1)::TEXT || '-' || (e.value->>'productId')),
    p.id, e.value->>'productId', COALESCE(e.value->>'name', p.name, 'Unavailable product'),
    (e.value->>'quantity')::INTEGER, (e.value->>'price')::NUMERIC,
    COALESCE(e.value->>'trackingStatus', NEW.status), e.value
  FROM jsonb_array_elements(NEW.items) WITH ORDINALITY AS e(value, ordinality)
  LEFT JOIN products p ON p.id = e.value->>'productId' OR p.legacy_id = e.value->>'productId'
  ON CONFLICT(order_id, item_key) DO UPDATE SET tracking_status = EXCLUDED.tracking_status, snapshot = EXCLUDED.snapshot;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_sync_items AFTER INSERT OR UPDATE OF items, status ON orders FOR EACH ROW EXECUTE FUNCTION sync_order_items();
UPDATE orders SET items = items;

ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
