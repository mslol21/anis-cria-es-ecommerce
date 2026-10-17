-- ==============================================================================
-- MIGRATION 001: INITIAL RELATIONAL SCHEMA FOR ANIS CRIAÇÕES E-COMMERCE
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.staff_role_type AS ENUM ('super_admin', 'admin', 'production', 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_type AS ENUM (
    'regular_stock',
    'personalized',
    'made_to_order',
    'with_variants',
    'gift_kit',
    'temporarily_unavailable'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.personalization_field_type AS ENUM (
    'short_text',
    'long_text',
    'date',
    'option_select',
    'color_select',
    'image_upload',
    'art_upload',
    'additional_notes'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_movement_type AS ENUM (
    'initial',
    'manual_adjustment',
    'reservation',
    'reservation_release',
    'sale_commit',
    'return_restock'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_method AS ENUM (
    'melhor_envio',
    'local_pickup',
    'own_delivery'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_financial_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'cancelled',
    'refunded',
    'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_operational_status AS ENUM (
    'awaiting_payment',
    'awaiting_art_approval',
    'in_production',
    'ready_for_shipping',
    'ready_for_pickup',
    'out_for_own_delivery',
    'shipped',
    'delivered',
    'picked_up',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM (
    'pending_preview',
    'awaiting_customer',
    'approved',
    'revision_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'cancelled',
    'refunded',
    'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shipment_status AS ENUM (
    'pending',
    'cart_inserted',
    'label_purchased',
    'label_generated',
    'posted',
    'in_transit',
    'out_for_delivery',
    'ready_for_pickup',
    'delivered',
    'picked_up',
    'cancelled',
    'manual_required'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.coupon_discount_type AS ENUM ('percentage', 'fixed_cents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence for human-friendly order numbers
CREATE SEQUENCE IF NOT EXISTS public.order_commercial_seq START WITH 1001 INCREMENT BY 1;

-- ------------------------------------------------------------------------------
-- 2. TABLES (ALL 22 MANDATORY TABLES)
-- ------------------------------------------------------------------------------

-- 2.1 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  document_cpf_cnpj TEXT,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  lgpd_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2.2 staff_roles
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.staff_role_type NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_roles_user_active ON public.staff_roles(user_id, is_active);

-- 2.3 store_settings
CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'Anis Criações',
  legal_name TEXT NOT NULL DEFAULT 'Anis Criações Presentes Personalizados LTDA',
  cnpj TEXT NOT NULL DEFAULT '00.000.000/0001-00',
  support_email TEXT NOT NULL DEFAULT 'contato@aniscriacoes.com.br',
  support_whatsapp TEXT NOT NULL DEFAULT '5511999999999',
  origin_postal_code TEXT NOT NULL DEFAULT '01310100',
  address_line TEXT NOT NULL DEFAULT 'Av. Paulista, 1000 - Bela Vista, São Paulo/SP',
  theme_config JSONB NOT NULL DEFAULT '{
    "primaryColor": "#9E473B",
    "secondaryColor": "#5E7153",
    "accentColor": "#D4A359",
    "backgroundColor": "#FAF7F2",
    "fontHeading": "Playfair Display",
    "fontBody": "Plus Jakarta Sans",
    "logoUrl": "/logo-anis.svg"
  }'::jsonb,
  infinitepay_config JSONB NOT NULL DEFAULT '{
    "handle": "aniscriacoes",
    "enabled": true
  }'::jsonb,
  melhor_envio_config JSONB NOT NULL DEFAULT '{
    "sandbox": true,
    "autoPurchaseEnabled": false,
    "defaultInsurance": true
  }'::jsonb,
  own_delivery_config JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "regions": [
      { "name": "São Paulo - Centro/Zona Sul", "cepPrefixStart": "01000", "cepPrefixEnd": "04999", "feeCents": 1500, "estimatedDays": 1, "driverName": "Equipe Interna Anis" },
      { "name": "São Paulo - Zona Oeste/Leste", "cepPrefixStart": "05000", "cepPrefixEnd": "08999", "feeCents": 2200, "estimatedDays": 2, "driverName": "Equipe Interna Anis" }
    ]
  }'::jsonb,
  banners_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo_config JSONB NOT NULL DEFAULT '{
    "defaultTitle": "Anis Criações | Presentes Criativos & Personalizados Exclusivos",
    "defaultDescription": "Presentes afetivos, kits corporativos e produtos personalizados feitos artesanalmente com entrega para todo o Brasil."
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug) WHERE deleted_at IS NULL;

-- 2.5 products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  product_type public.product_type NOT NULL DEFAULT 'regular_stock',
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  promotional_price_cents INT CHECK (promotional_price_cents IS NULL OR (promotional_price_cents >= 0 AND promotional_price_cents <= price_cents)),
  internal_cost_cents INT CHECK (internal_cost_cents IS NULL OR internal_cost_cents >= 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  weight_grams INT NOT NULL DEFAULT 300 CHECK (weight_grams > 0),
  height_cm NUMERIC(6,2) NOT NULL DEFAULT 10.00 CHECK (height_cm > 0),
  width_cm NUMERIC(6,2) NOT NULL DEFAULT 15.00 CHECK (width_cm > 0),
  length_cm NUMERIC(6,2) NOT NULL DEFAULT 20.00 CHECK (length_cm > 0),
  production_days INT NOT NULL DEFAULT 0 CHECK (production_days >= 0),
  requires_art_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  occasions TEXT[] NOT NULL DEFAULT '{}',
  kit_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_visibility ON public.products(is_visible, is_available) WHERE deleted_at IS NULL;

-- 2.6 product_variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_override_cents INT CHECK (price_override_cents IS NULL OR price_override_cents >= 0),
  promotional_price_override_cents INT CHECK (promotional_price_override_cents IS NULL OR promotional_price_override_cents >= 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  weight_grams INT CHECK (weight_grams IS NULL OR weight_grams > 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id) WHERE deleted_at IS NULL;

-- 2.7 product_images
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  storage_path TEXT,
  public_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id, display_order);

-- 2.8 personalization_fields
CREATE TABLE IF NOT EXISTS public.personalization_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  field_type public.personalization_field_type NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  max_length INT CHECK (max_length IS NULL OR max_length > 0),
  allowed_mime_types TEXT[] NOT NULL DEFAULT ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  max_file_size_bytes INT NOT NULL DEFAULT 10485760,
  price_addition_cents INT NOT NULL DEFAULT 0 CHECK (price_addition_cents >= 0),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_personalization_fields_product ON public.personalization_fields(product_id, display_order);

-- 2.9 customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  document_cpf_cnpj TEXT NOT NULL,
  lgpd_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anonymized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_document ON public.customers(document_cpf_cnpj);

-- 2.10 addresses
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  reference TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON public.addresses(customer_id);

-- 2.11 coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type public.coupon_discount_type NOT NULL,
  discount_value INT NOT NULL CHECK (discount_value > 0),
  min_order_cents INT NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
  max_discount_cents INT CHECK (max_discount_cents IS NULL OR max_discount_cents > 0),
  usage_limit INT CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count INT NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(UPPER(code)) WHERE deleted_at IS NULL;

-- 2.12 pickup_locations
CREATE TABLE IF NOT EXISTS public.pickup_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  operating_hours TEXT NOT NULL DEFAULT 'Segunda a Sexta das 09h às 18h, Sábado das 09h às 13h',
  available_days TEXT[] NOT NULL DEFAULT ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'],
  min_prep_days INT NOT NULL DEFAULT 1 CHECK (min_prep_days >= 0),
  instructions TEXT NOT NULL DEFAULT 'Apresente o código de retirada e um documento com foto na recepção do ateliê.',
  fee_cents INT NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.13 shipping_quotes
CREATE TABLE IF NOT EXISTS public.shipping_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_postal_code TEXT NOT NULL,
  cart_hash TEXT NOT NULL,
  delivery_method public.delivery_method NOT NULL DEFAULT 'melhor_envio',
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  delivery_days INT NOT NULL CHECK (delivery_days >= 0),
  packages_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_quote JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_lookup ON public.shipping_quotes(customer_postal_code, cart_hash);

-- 2.14 orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  lookup_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  shipping_address_snapshot JSONB NOT NULL,
  delivery_method public.delivery_method NOT NULL,
  pickup_location_id UUID REFERENCES public.pickup_locations(id) ON DELETE SET NULL,
  shipping_quote_id UUID REFERENCES public.shipping_quotes(id) ON DELETE SET NULL,
  financial_status public.order_financial_status NOT NULL DEFAULT 'pending',
  operational_status public.order_operational_status NOT NULL DEFAULT 'awaiting_payment',
  subtotal_cents INT NOT NULL CHECK (subtotal_cents >= 0),
  personalization_total_cents INT NOT NULL DEFAULT 0 CHECK (personalization_total_cents >= 0),
  shipping_cents INT NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  discount_cents INT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents INT NOT NULL CHECK (total_cents >= 0),
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_code_snapshot TEXT,
  production_days INT NOT NULL DEFAULT 0 CHECK (production_days >= 0),
  estimated_shipping_days INT NOT NULL DEFAULT 0 CHECK (estimated_shipping_days >= 0),
  stock_reservation_expires_at TIMESTAMPTZ,
  pickup_code TEXT,
  customer_notes TEXT,
  internal_notes TEXT,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_statuses ON public.orders(financial_status, operational_status);

-- 2.15 order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT,
  sku_snapshot TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_base_price_cents INT NOT NULL CHECK (unit_base_price_cents >= 0),
  unit_personalization_price_cents INT NOT NULL DEFAULT 0 CHECK (unit_personalization_price_cents >= 0),
  unit_final_price_cents INT NOT NULL CHECK (unit_final_price_cents >= 0),
  total_price_cents INT NOT NULL CHECK (total_price_cents >= 0),
  production_days_snapshot INT NOT NULL DEFAULT 0,
  requires_art_approval BOOLEAN NOT NULL DEFAULT FALSE,
  kit_items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 2.16 order_item_customizations (Immutable snapshot of customer personalization)
CREATE TABLE IF NOT EXISTS public.order_item_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  field_id UUID REFERENCES public.personalization_fields(id) ON DELETE SET NULL,
  field_key_snapshot TEXT NOT NULL,
  field_label_snapshot TEXT NOT NULL,
  field_type_snapshot public.personalization_field_type NOT NULL,
  text_value TEXT,
  selected_option_snapshot JSONB,
  storage_bucket TEXT,
  storage_path TEXT,
  file_original_name TEXT,
  file_mime_type TEXT,
  file_size_bytes INT,
  price_addition_cents_snapshot INT NOT NULL DEFAULT 0 CHECK (price_addition_cents_snapshot >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_item_customizations_item ON public.order_item_customizations(order_item_id);

-- 2.17 inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  movement_type public.inventory_movement_type NOT NULL,
  quantity INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order ON public.inventory_movements(order_id);

-- 2.18 order_status_history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_financial_status public.order_financial_status,
  new_financial_status public.order_financial_status,
  previous_operational_status public.order_operational_status,
  new_operational_status public.order_operational_status,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id, created_at DESC);

-- 2.19 design_approvals
CREATE TABLE IF NOT EXISTS public.design_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1 CHECK (version > 0),
  status public.approval_status NOT NULL DEFAULT 'pending_preview',
  preview_storage_bucket TEXT DEFAULT 'design-previews-private',
  preview_storage_path TEXT,
  designer_notes TEXT,
  customer_feedback TEXT,
  internal_deadline TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_customer_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_design_approvals_order ON public.design_approvals(order_id, version DESC);

-- 2.20 payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'infinitepay',
  order_nsu TEXT NOT NULL UNIQUE,
  transaction_nsu TEXT,
  invoice_slug TEXT,
  checkout_url TEXT,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  paid_amount_cents INT CHECK (paid_amount_cents IS NULL OR paid_amount_cents >= 0),
  installments INT DEFAULT 1,
  capture_method TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  receipt_url TEXT,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount_cents INT CHECK (refund_amount_cents IS NULL OR refund_amount_cents >= 0),
  refund_reason TEXT,
  reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_nsu ON public.payments(order_nsu);

-- 2.21 payment_events
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  order_nsu TEXT NOT NULL,
  transaction_nsu TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_nsu ON public.payment_events(order_nsu);

-- 2.22 shipments
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shipping_quote_id UUID REFERENCES public.shipping_quotes(id) ON DELETE SET NULL,
  delivery_method public.delivery_method NOT NULL,
  provider TEXT NOT NULL,
  melhor_envio_order_id TEXT,
  protocol TEXT,
  service_id TEXT,
  service_name TEXT NOT NULL,
  company_name TEXT,
  shipping_cost_cents INT NOT NULL DEFAULT 0 CHECK (shipping_cost_cents >= 0),
  declared_value_cents INT NOT NULL DEFAULT 0,
  weight_grams INT NOT NULL DEFAULT 300,
  height_cm NUMERIC(6,2) NOT NULL DEFAULT 10,
  width_cm NUMERIC(6,2) NOT NULL DEFAULT 15,
  length_cm NUMERIC(6,2) NOT NULL DEFAULT 20,
  tracking_code TEXT,
  tracking_url TEXT,
  label_url TEXT,
  status public.shipment_status NOT NULL DEFAULT 'pending',
  pickup_code TEXT,
  picked_up_at TIMESTAMPTZ,
  picked_up_by_name TEXT,
  picked_up_by_document TEXT,
  confirmed_by_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  own_delivery_driver TEXT,
  own_delivery_region TEXT,
  own_delivery_proof_path TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  raw_provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON public.shipments(tracking_code) WHERE tracking_code IS NOT NULL;

-- 2.23 audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_table, entity_id, created_at DESC);
