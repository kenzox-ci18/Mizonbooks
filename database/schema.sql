-- MizonBooks database schema (PostgreSQL / Neon)
-- DIQQAT: server ishga tushganda jadvallarni o'zi yaratadi (backend/server.js -> ensureSchema).
-- Bu fayl faqat ma'lumot uchun; qo'lda ishga tushirish shart emas.

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(150) NOT NULL,
    username      VARCHAR(24)  NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    phone         VARCHAR(30)  NOT NULL,
    email         VARCHAR(255),
    avatar        TEXT,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    won_at             TIMESTAMPTZ,          -- 4 ta bo'lakni yig'gan vaqt
    prize_status       VARCHAR(20),          -- 'pending' | 'delivered'
    prize_delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS books (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    author      VARCHAR(255) NOT NULL,
    price       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    category    VARCHAR(100),
    image       TEXT,
    description TEXT,
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Xatcho'p orqasidagi promo-kodlar (6 belgi, masalan 2N3B3B).
-- piece = kod xatcho'pning qaysi bo'lagini (1-4) ochishini bildiradi.
CREATE TABLE IF NOT EXISTS promo_codes (
    id         SERIAL PRIMARY KEY,
    code       VARCHAR(6) NOT NULL UNIQUE,
    batch      VARCHAR(50),
    piece      SMALLINT NOT NULL DEFAULT 1,
    used_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_used_by ON promo_codes(used_by);

-- Kitob buyurtmalari
CREATE TABLE IF NOT EXISTS orders (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    book_id       INTEGER REFERENCES books(id) ON DELETE SET NULL,
    book_name     VARCHAR(255) NOT NULL,
    book_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
    customer_name VARCHAR(150) NOT NULL,
    phone         VARCHAR(30)  NOT NULL,
    note          TEXT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'new',  -- new | contacted | delivered | cancelled
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Sayt sozlamalari (masalan, admin yuklagan xatcho'p rasmi)
CREATE TABLE IF NOT EXISTS site_settings (
    key   VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- Admin qilish: .env dagi ADMIN_USERNAME yoki qo'lda:
-- UPDATE users SET role = 'admin' WHERE username = 'your_username';
