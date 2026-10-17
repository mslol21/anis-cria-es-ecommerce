-- ==============================================================================
-- MIGRATION 002: TRANSACTIONAL FUNCTIONS, TRIGGERS, RLS POLICIES & STORAGE
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTOMATIC UPDATED_AT TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles', 'staff_roles', 'store_settings', 'categories', 'products',
      'product_variants', 'personalization_fields', 'customers', 'addresses',
      'coupons', 'pickup_locations', 'orders', 'design_approvals', 'payments', 'shipments'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. COMMERCIAL ORDER NUMBER GENERATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_commercial_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ANIS-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('public.order_commercial_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_commercial_number ON public.orders;
CREATE TRIGGER trg_orders_commercial_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.generate_commercial_order_number();

-- ------------------------------------------------------------------------------
-- 3. STAFF AUTHORIZATION HELPERS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_roles sr
    WHERE sr.user_id = auth.uid()
      AND sr.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(allowed_roles public.staff_role_type[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_roles sr
    WHERE sr.user_id = auth.uid()
      AND sr.is_active = TRUE
      AND sr.role = ANY(allowed_roles)
  );
$$;

-- ------------------------------------------------------------------------------
-- 4. CONCURRENT STOCK RESERVATION & EXPIRATION FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(
  p_order_id UUID,
  p_ttl_minutes INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_available INT;
  v_expires_at TIMESTAMPTZ := NOW() + (p_ttl_minutes || ' minutes')::INTERVAL;
BEGIN
  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.quantity, p.track_inventory, p.product_type
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    IF v_item.product_type = 'temporarily_unavailable' THEN
      RAISE EXCEPTION 'Product % is temporarily unavailable', v_item.product_id;
    END IF;

    IF v_item.track_inventory AND v_item.product_type <> 'made_to_order' THEN
      IF v_item.variant_id IS NOT NULL THEN
        SELECT (stock_quantity - reserved_quantity)
        INTO v_available
        FROM public.product_variants
        WHERE id = v_item.variant_id
        FOR UPDATE;

        IF v_available < v_item.quantity THEN
          RAISE EXCEPTION 'Insufficient variant stock for variant %', v_item.variant_id;
        END IF;

        UPDATE public.product_variants
        SET reserved_quantity = reserved_quantity + v_item.quantity
        WHERE id = v_item.variant_id;
      ELSE
        SELECT (stock_quantity - reserved_quantity)
        INTO v_available
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF v_available < v_item.quantity THEN
          RAISE EXCEPTION 'Insufficient product stock for product %', v_item.product_id;
        END IF;

        UPDATE public.products
        SET reserved_quantity = reserved_quantity + v_item.quantity
        WHERE id = v_item.product_id;
      END IF;

      INSERT INTO public.inventory_movements (
        product_id, variant_id, order_id, movement_type,
        quantity, previous_stock, new_stock, expires_at, notes
      ) VALUES (
        v_item.product_id, v_item.variant_id, p_order_id, 'reservation',
        v_item.quantity, v_available, v_available - v_item.quantity,
        v_expires_at, 'Stock reserved for pending order'
      );
    END IF;
  END LOOP;

  UPDATE public.orders
  SET stock_reservation_expires_at = v_expires_at
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

-- Release expired reservations safely
CREATE OR REPLACE FUNCTION public.release_expired_stock_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_mov RECORD;
  v_count INT := 0;
BEGIN
  FOR v_order IN
    SELECT id
    FROM public.orders
    WHERE financial_status = 'pending'
      AND stock_reservation_expires_at IS NOT NULL
      AND stock_reservation_expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    FOR v_mov IN
      SELECT id, product_id, variant_id, quantity
      FROM public.inventory_movements
      WHERE order_id = v_order.id
        AND movement_type = 'reservation'
        AND released_at IS NULL
    LOOP
      IF v_mov.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET reserved_quantity = GREATEST(0, reserved_quantity - v_mov.quantity)
        WHERE id = v_mov.variant_id;
      ELSE
        UPDATE public.products
        SET reserved_quantity = GREATEST(0, reserved_quantity - v_mov.quantity)
        WHERE id = v_mov.product_id;
      END IF;

      UPDATE public.inventory_movements
      SET released_at = NOW()
      WHERE id = v_mov.id;
    END LOOP;

    UPDATE public.orders
    SET financial_status = 'cancelled',
        operational_status = 'cancelled',
        cancelled_at = NOW(),
        cancel_reason = 'Expiração automática da reserva de estoque'
    WHERE id = v_order.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. IDEMPOTENT PAYMENT CONFIRMATION FUNCTION (INFINITEPAY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_order_payment_idempotent(
  p_order_nsu TEXT,
  p_transaction_nsu TEXT,
  p_invoice_slug TEXT,
  p_paid_amount_cents INT,
  p_capture_method TEXT,
  p_receipt_url TEXT,
  p_raw_payload JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_needs_art BOOLEAN := FALSE;
  v_next_op_status public.order_operational_status;
  v_item RECORD;
BEGIN
  -- 1. Check idempotency key first
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object(
      'already_processed', true,
      'order_nsu', p_order_nsu,
      'message', 'Event already processed via idempotency key'
    );
  END IF;

  -- 2. Lock payment row
  SELECT * INTO v_payment
  FROM public.payments
  WHERE order_nsu = p_order_nsu
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment with order_nsu % not found', p_order_nsu;
  END IF;

  -- 3. Lock order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  -- 4. If already paid, record duplicate event and return idempotently
  IF v_payment.status = 'paid' OR v_order.financial_status = 'paid' THEN
    INSERT INTO public.payment_events (
      payment_id, order_id, idempotency_key, event_type,
      order_nsu, transaction_nsu, raw_payload, processing_status
    ) VALUES (
      v_payment.id, v_order.id, p_idempotency_key, 'duplicate_webhook_ignored',
      p_order_nsu, p_transaction_nsu, p_raw_payload, 'ignored_already_paid'
    );

    RETURN jsonb_build_object(
      'already_processed', true,
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'order_nsu', p_order_nsu
    );
  END IF;

  -- 5. Verify paid amount is not less than expected amount
  IF p_paid_amount_cents < v_payment.amount_cents THEN
    INSERT INTO public.payment_events (
      payment_id, order_id, idempotency_key, event_type,
      order_nsu, transaction_nsu, raw_payload, processing_status, error_message
    ) VALUES (
      v_payment.id, v_order.id, p_idempotency_key, 'amount_mismatch_error',
      p_order_nsu, p_transaction_nsu, p_raw_payload, 'rejected_amount_mismatch',
      format('Expected %s cents, got %s cents', v_payment.amount_cents, p_paid_amount_cents)
    );
    RAISE EXCEPTION 'Divergent payment amount: expected %, received %', v_payment.amount_cents, p_paid_amount_cents;
  END IF;

  -- 6. Commit stock reservation into permanent stock deduction
  FOR v_item IN
    SELECT oi.product_id, oi.variant_id, oi.quantity, oi.requires_art_approval, p.track_inventory, p.product_type
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id
  LOOP
    IF v_item.requires_art_approval THEN
      v_needs_art := TRUE;
    END IF;

    IF v_item.track_inventory AND v_item.product_type <> 'made_to_order' THEN
      IF v_item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock_quantity = GREATEST(0, stock_quantity - v_item.quantity),
            reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity)
        WHERE id = v_item.variant_id;
      ELSE
        UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - v_item.quantity),
            reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity)
        WHERE id = v_item.product_id;
      END IF;
    END IF;
  END LOOP;

  v_next_op_status := CASE WHEN v_needs_art THEN 'awaiting_art_approval'::public.order_operational_status
                           ELSE 'in_production'::public.order_operational_status END;

  -- 7. Update payment record
  UPDATE public.payments
  SET status = 'paid',
      transaction_nsu = p_transaction_nsu,
      invoice_slug = COALESCE(p_invoice_slug, invoice_slug),
      paid_amount_cents = p_paid_amount_cents,
      capture_method = p_capture_method,
      receipt_url = p_receipt_url,
      paid_at = NOW(),
      provider_payload = p_raw_payload
  WHERE id = v_payment.id;

  -- 8. Update order record
  UPDATE public.orders
  SET financial_status = 'paid',
      operational_status = v_next_op_status,
      paid_at = NOW(),
      stock_reservation_expires_at = NULL
  WHERE id = v_order.id;

  -- 9. Log event & status history & audit
  INSERT INTO public.payment_events (
    payment_id, order_id, idempotency_key, event_type,
    order_nsu, transaction_nsu, raw_payload, processing_status
  ) VALUES (
    v_payment.id, v_order.id, p_idempotency_key, 'payment_confirmed',
    p_order_nsu, p_transaction_nsu, p_raw_payload, 'processed'
  );

  INSERT INTO public.order_status_history (
    order_id, previous_financial_status, new_financial_status,
    previous_operational_status, new_operational_status, reason, metadata
  ) VALUES (
    v_order.id, v_order.financial_status, 'paid',
    v_order.operational_status, v_next_op_status,
    'Pagamento confirmado via InfinitePay',
    jsonb_build_object('order_nsu', p_order_nsu, 'transaction_nsu', p_transaction_nsu)
  );

  INSERT INTO public.audit_logs (
    actor_role, action, entity_table, entity_id, new_data
  ) VALUES (
    'system_webhook', 'PAYMENT_CONFIRMED', 'orders', v_order.id::TEXT,
    jsonb_build_object('order_nsu', p_order_nsu, 'transaction_nsu', p_transaction_nsu, 'paid_amount_cents', p_paid_amount_cents)
  );

  RETURN jsonb_build_object(
    'already_processed', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'financial_status', 'paid',
    'operational_status', v_next_op_status
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. LGPD CUSTOMER ANONYMIZATION FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anonymize_customer_lgpd(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]) THEN
    RAISE EXCEPTION 'Unauthorized LGPD anonymization request';
  END IF;

  UPDATE public.customers
  SET full_name = 'CLIENTE ANONIMIZADO LGPD',
      email = 'anonimizado+' || p_customer_id::TEXT || '@aniscriacoes.local',
      phone = '00000000000',
      document_cpf_cnpj = '00000000000',
      anonymized_at = NOW(),
      deleted_at = NOW()
  WHERE id = p_customer_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_table, entity_id)
  VALUES (auth.uid(), 'admin', 'LGPD_ANONYMIZE_CUSTOMER', 'customers', p_customer_id::TEXT);

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ENABLE ROW LEVEL SECURITY (RLS) ON ALL 22 TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalization_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read access ONLY for active catalog & public store settings
CREATE POLICY "Public read store_settings" ON public.store_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "Public read active categories" ON public.categories
  FOR SELECT USING ((is_active = TRUE AND deleted_at IS NULL) OR public.is_staff_member());

CREATE POLICY "Public read visible products" ON public.products
  FOR SELECT USING ((is_visible = TRUE AND deleted_at IS NULL) OR public.is_staff_member());

CREATE POLICY "Public read active product variants" ON public.product_variants
  FOR SELECT USING (deleted_at IS NULL OR public.is_staff_member());

CREATE POLICY "Public read product images" ON public.product_images
  FOR SELECT USING (TRUE);

CREATE POLICY "Public read active personalization fields" ON public.personalization_fields
  FOR SELECT USING (is_active = TRUE OR public.is_staff_member());

CREATE POLICY "Public read active pickup locations" ON public.pickup_locations
  FOR SELECT USING (is_active = TRUE OR public.is_staff_member());

-- Profiles: user can read/update own profile; staff can read all
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_staff_member());

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Staff roles: ONLY super_admin or service_role can mutate; staff can view own role
CREATE POLICY "Users view own staff role" ON public.staff_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Only super_admin manages staff roles" ON public.staff_roles
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin']::public.staff_role_type[]));

-- Admin write policies for catalog & store management
CREATE POLICY "Staff manage categories" ON public.categories
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Staff manage products" ON public.products
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Staff manage variants" ON public.product_variants
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Staff manage images" ON public.product_images
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Staff manage personalization fields" ON public.personalization_fields
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Staff manage coupons" ON public.coupons
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Staff manage pickup locations" ON public.pickup_locations
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

CREATE POLICY "Staff manage store settings" ON public.store_settings
  FOR ALL USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]))
  WITH CHECK (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

-- Orders & Customer data: authenticated user can read own orders; staff can read/manage
CREATE POLICY "Authenticated users read own orders" ON public.orders
  FOR SELECT USING ((auth.uid() IS NOT NULL AND profile_id = auth.uid()) OR public.is_staff_member());

CREATE POLICY "Staff update orders" ON public.orders
  FOR UPDATE USING (public.is_staff_member()) WITH CHECK (public.is_staff_member());

CREATE POLICY "Authenticated users read own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND ((auth.uid() IS NOT NULL AND o.profile_id = auth.uid()) OR public.is_staff_member())
    )
  );

CREATE POLICY "Authenticated users read own customizations" ON public.order_item_customizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_customizations.order_item_id
        AND ((auth.uid() IS NOT NULL AND o.profile_id = auth.uid()) OR public.is_staff_member())
    )
  );

-- Payments & Payment Events: NO client mutation allowed! Only staff can read, only service_role writes
CREATE POLICY "Staff read payments" ON public.payments
  FOR SELECT USING (public.is_staff_member());

CREATE POLICY "Staff read payment events" ON public.payment_events
  FOR SELECT USING (public.is_staff_member());

-- Inventory, Shipments, Design Approvals, Audit Logs: staff access
CREATE POLICY "Staff read inventory movements" ON public.inventory_movements
  FOR SELECT USING (public.is_staff_member());

CREATE POLICY "Staff manage shipments" ON public.shipments
  FOR ALL USING (public.is_staff_member()) WITH CHECK (public.is_staff_member());

CREATE POLICY "Staff manage design approvals" ON public.design_approvals
  FOR ALL USING (public.is_staff_member()) WITH CHECK (public.is_staff_member());

CREATE POLICY "Staff read customers" ON public.customers
  FOR SELECT USING ((auth.uid() IS NOT NULL AND profile_id = auth.uid()) OR public.is_staff_member());

CREATE POLICY "Staff read addresses" ON public.addresses
  FOR SELECT USING (public.is_staff_member());

CREATE POLICY "Staff read order status history" ON public.order_status_history
  FOR SELECT USING (public.is_staff_member());

CREATE POLICY "Staff read shipping quotes" ON public.shipping_quotes
  FOR SELECT USING (public.is_staff_member());

CREATE POLICY "Staff read audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_staff_role(ARRAY['super_admin', 'admin']::public.staff_role_type[]));

-- ------------------------------------------------------------------------------
-- 8. SUPABASE STORAGE BUCKETS (PUBLIC CATALOG VS PRIVATE SENSITIVE UPLOADS)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('catalog-public', 'catalog-public', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('custom-uploads-private', 'custom-uploads-private', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('design-previews-private', 'design-previews-private', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
