CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(24) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(320) UNIQUE,
    phone VARCHAR(30) UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(30) NOT NULL DEFAULT 'customer',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    address TEXT,
    address_line VARCHAR(255),
    barangay VARCHAR(150),
    city VARCHAR(150),
    province VARCHAR(150),
    zip VARCHAR(20),
    country VARCHAR(100),
    backup_address TEXT,
    profile_image TEXT,
    preferred_theme VARCHAR(100) NOT NULL DEFAULT 'Default',
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(24) PRIMARY KEY,
    legacy_id VARCHAR(191) UNIQUE,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    notes TEXT,
    description TEXT,
    image_url TEXT,
    image_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
    size VARCHAR(50),
    category VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

CREATE TABLE IF NOT EXISTS carts (
    id VARCHAR(24) PRIMARY KEY,
    user_id VARCHAR(24) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(24) PRIMARY KEY,
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(60) NOT NULL,
    address TEXT NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(320) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(24) PRIMARY KEY,
    product_id VARCHAR(24) NOT NULL REFERENCES products(id),
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(150),
    user_email VARCHAR(320),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    attachment JSONB,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON reviews (product_id, created_at);

CREATE TABLE IF NOT EXISTS feedback (
    id VARCHAR(24) PRIMARY KEY,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    order_id VARCHAR(24) REFERENCES orders(id) ON DELETE SET NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    message TEXT NOT NULL,
    attachment JSONB,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at);

CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(24) PRIMARY KEY,
    order_id VARCHAR(24) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    total NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_order ON sales (order_id);

CREATE TABLE IF NOT EXISTS otps (
    id VARCHAR(384) PRIMARY KEY,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(320),
    phone VARCHAR(30),
    code VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'register',
    expires_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ(3),
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otps_email_type_created ON otps (email, type, created_at);
CREATE INDEX IF NOT EXISTS idx_otps_phone_type_created ON otps (phone, type, created_at);

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
