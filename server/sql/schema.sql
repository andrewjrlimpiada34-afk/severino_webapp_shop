CREATE TABLE IF NOT EXISTS users (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(320) NULL,
    phone VARCHAR(30) NULL,
    password_hash VARCHAR(255) NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'customer',
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    address TEXT NULL,
    address_line VARCHAR(255) NULL,
    barangay VARCHAR(150) NULL,
    city VARCHAR(150) NULL,
    province VARCHAR(150) NULL,
    zip VARCHAR(20) NULL,
    country VARCHAR(100) NULL,
    backup_address TEXT NULL,
    profile_image TEXT NULL,
    preferred_theme VARCHAR(100) NOT NULL DEFAULT 'Default',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    legacy_id VARCHAR(191) NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    notes TEXT NULL,
    description TEXT NULL,
    image_url TEXT NULL,
    image_urls JSON NOT NULL,
    size VARCHAR(50) NULL,
    category VARCHAR(100) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE KEY uq_products_legacy_id (legacy_id),
    INDEX idx_products_active (active),
    INDEX idx_products_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS carts (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    items JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE KEY uq_carts_user (user_id),
    CONSTRAINT fk_carts_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    items JSON NOT NULL,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(60) NOT NULL,
    address TEXT NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(320) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_orders_user_created (user_id, created_at),
    INDEX idx_orders_status (status),
    CONSTRAINT fk_orders_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    product_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    user_name VARCHAR(150) NULL,
    user_email VARCHAR(320) NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    attachment JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_reviews_product_created (product_id, created_at),
    CONSTRAINT fk_reviews_product
      FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_reviews_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE SET NULL,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feedback (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    order_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    rating TINYINT UNSIGNED NOT NULL,
    message TEXT NOT NULL,
    attachment JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_feedback_created (created_at),
    CONSTRAINT fk_feedback_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE SET NULL,
    CONSTRAINT fk_feedback_order
      FOREIGN KEY (order_id) REFERENCES orders(id)
      ON DELETE SET NULL,
    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
    id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    order_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_sales_order (order_id),
    CONSTRAINT fk_sales_order
      FOREIGN KEY (order_id) REFERENCES orders(id)
      ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS otps (
    id VARCHAR(384) PRIMARY KEY,
    user_id CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
    email VARCHAR(320) NULL,
    phone VARCHAR(30) NULL,
    code VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'register',
    expires_at BIGINT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    verified_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_otps_email_type_created (email, type, created_at),
    INDEX idx_otps_phone_type_created (phone, type, created_at),
    CONSTRAINT fk_otps_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSON NOT NULL,
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
