-- ============================================================
-- Order & Pay — Schema initial PostgreSQL
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- RESTAURANTS (tenant root)
-- ============================================================
CREATE TABLE restaurants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,   -- used as tenant key
    address         TEXT,
    phone           VARCHAR(30),
    email           VARCHAR(150),
    logo_url        VARCHAR(500),
    currency        VARCHAR(3)  NOT NULL DEFAULT 'EUR',
    timezone        VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    siret           VARCHAR(20),
    tva_intra       VARCHAR(20),
    subscription_plan VARCHAR(30) NOT NULL DEFAULT 'STARTER', -- STARTER|PRO|ENTERPRISE
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS (staff + admins, scoped to restaurant)
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    email           VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(80),
    last_name       VARCHAR(80),
    role            VARCHAR(30) NOT NULL DEFAULT 'WAITER', -- OWNER|MANAGER|WAITER|KITCHEN|CASHIER
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(restaurant_id, email)
);

-- ============================================================
-- FLOOR LAYOUT (salles)
-- ============================================================
CREATE TABLE floor_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,             -- "Salle principale", "Terrasse"…
    grid_cols       SMALLINT NOT NULL DEFAULT 12,
    grid_rows       SMALLINT NOT NULL DEFAULT 8,
    background_url  VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tables (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    floor_plan_id   UUID REFERENCES floor_plans(id) ON DELETE SET NULL,
    label           VARCHAR(20) NOT NULL,             -- "T1", "Bar 3"…
    capacity        SMALLINT NOT NULL DEFAULT 4,
    grid_x          SMALLINT NOT NULL DEFAULT 0,      -- col dans la grille
    grid_y          SMALLINT NOT NULL DEFAULT 0,      -- row dans la grille
    grid_w          SMALLINT NOT NULL DEFAULT 1,      -- largeur (cases)
    grid_h          SMALLINT NOT NULL DEFAULT 1,      -- hauteur (cases)
    shape           VARCHAR(20) NOT NULL DEFAULT 'RECT', -- RECT|ROUND|BAR
    status          VARCHAR(20) NOT NULL DEFAULT 'FREE',  -- FREE|OCCUPIED|RESERVED|DIRTY
    qr_token        VARCHAR(100) UNIQUE,              -- token pour QR code
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATALOGUE (catégories + produits)
-- ============================================================
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),
    -- Prix HT
    price_ht        NUMERIC(10,4) NOT NULL,
    -- Taux de TVA applicable (5.5 | 10 | 20)
    vat_rate        NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    -- Coût matière pour calcul marge
    cost_price      NUMERIC(10,4),
    allergens       TEXT[],
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    is_upsell       BOOLEAN NOT NULL DEFAULT FALSE,   -- suggéré en upselling
    stock_managed   BOOLEAN NOT NULL DEFAULT FALSE,
    stock_qty       INTEGER,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Options / variantes (taille, cuisson…)
CREATE TABLE product_options (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,            -- "Cuisson", "Taille"
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    max_choices     SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE product_option_values (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    option_id       UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
    label           VARCHAR(80) NOT NULL,
    price_delta_ht  NUMERIC(10,4) NOT NULL DEFAULT 0  -- surcoût HT
);

-- ============================================================
-- COMMANDES
-- ============================================================
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id        UUID REFERENCES tables(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,  -- serveur
    order_number    SERIAL,                           -- numéro lisible par table
    status          VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
                    -- DRAFT|CONFIRMED|IN_PROGRESS|READY|DELIVERED|PAID|CANCELLED
    source          VARCHAR(20) NOT NULL DEFAULT 'WAITER', -- WAITER|CLIENT_APP|KIOSK
    guest_count     SMALLINT,
    notes           TEXT,
    -- Montants calculés (dénormalisés pour perf stats)
    total_ht        NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_vat_55    NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_vat_10    NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_vat_20    NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_ttc       NUMERIC(12,4) NOT NULL DEFAULT 0,
    confirmed_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_lines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    product_snapshot JSONB NOT NULL,                 -- snapshot nom+prix au moment de la commande
    quantity        SMALLINT NOT NULL DEFAULT 1,
    unit_price_ht   NUMERIC(10,4) NOT NULL,
    vat_rate        NUMERIC(5,2) NOT NULL,
    line_total_ht   NUMERIC(12,4) NOT NULL,
    line_total_ttc  NUMERIC(12,4) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    -- PENDING|COOKING|READY|SERVED|CANCELLED
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_line_options (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_line_id   UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
    option_value_id UUID NOT NULL REFERENCES product_option_values(id),
    label           VARCHAR(80) NOT NULL,
    price_delta_ht  NUMERIC(10,4) NOT NULL DEFAULT 0
);

-- ============================================================
-- PAIEMENTS
-- ============================================================
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES orders(id),
    amount_ttc      NUMERIC(12,4) NOT NULL,
    method          VARCHAR(30) NOT NULL,  -- CASH|CARD|TICKET_RESTO|LYDIA|SPLIT
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING|COMPLETED|REFUNDED|FAILED
    external_ref    VARCHAR(200),          -- référence TPE / Stripe
    tip_amount      NUMERIC(10,4) NOT NULL DEFAULT 0,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HISTORISATION STATS JOURNALIÈRES (agrégats)
-- ============================================================
CREATE TABLE daily_stats (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    stat_date       DATE NOT NULL,
    total_orders    INTEGER NOT NULL DEFAULT 0,
    total_covers    INTEGER NOT NULL DEFAULT 0,       -- nb couverts
    revenue_ht      NUMERIC(14,4) NOT NULL DEFAULT 0,
    revenue_ttc     NUMERIC(14,4) NOT NULL DEFAULT 0,
    cost_materials  NUMERIC(14,4) NOT NULL DEFAULT 0,
    gross_margin    NUMERIC(14,4) NOT NULL DEFAULT 0,
    avg_basket_ttc  NUMERIC(10,4) NOT NULL DEFAULT 0,
    top_products    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(restaurant_id, stat_date)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_restaurant      ON users(restaurant_id);
CREATE INDEX idx_tables_restaurant     ON tables(restaurant_id);
CREATE INDEX idx_tables_qr_token       ON tables(qr_token);
CREATE INDEX idx_products_restaurant   ON products(restaurant_id);
CREATE INDEX idx_products_category     ON products(category_id);
CREATE INDEX idx_orders_restaurant     ON orders(restaurant_id);
CREATE INDEX idx_orders_table          ON orders(table_id);
CREATE INDEX idx_orders_status         ON orders(restaurant_id, status);
CREATE INDEX idx_orders_created_at     ON orders(restaurant_id, created_at);
CREATE INDEX idx_order_lines_order     ON order_lines(order_id);
CREATE INDEX idx_payments_order        ON payments(order_id);
CREATE INDEX idx_daily_stats_date      ON daily_stats(restaurant_id, stat_date);
