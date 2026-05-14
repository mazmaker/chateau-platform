-- Customer Cancel Booking
-- Allows a customer to cancel their own pending booking via the Customer Portal.
-- Adds cancellation metadata columns and a SECURITY DEFINER RPC that performs
-- an atomic 3-step rollback: bookings → units → lead_interests.

-- 1. Add cancellation metadata columns to bookings (idempotent)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by         uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason  text,
  ADD COLUMN IF NOT EXISTS cancellation_source  text;  -- 'customer' | 'admin' | 'sales' | 'system_expired'

COMMENT ON COLUMN public.bookings.cancellation_source
  IS 'Who triggered the cancellation: customer / admin / sales / system_expired';


-- 2. Helper: lookup customer by current auth user
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


-- 3. Main RPC: customer cancels their own booking
CREATE OR REPLACE FUNCTION public.customer_cancel_booking(
  p_booking_id uuid,
  p_reason     text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id   uuid;
  v_booking       record;
  v_unit_id       uuid;
  v_lead_id       uuid;
BEGIN
  -- Auth: must be a logged-in customer
  v_customer_id := public.current_customer_id();
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- Load booking (must belong to this customer)
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
    AND customer_id = v_customer_id
  LIMIT 1;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND_OR_NOT_OWNED' USING ERRCODE = '42501';
  END IF;

  -- Status gate: only 'pending' bookings (not yet paid) are customer-cancellable
  -- confirmed/checked_in require refund flow → must go through Sales
  IF v_booking.status <> 'pending' THEN
    RAISE EXCEPTION 'CANNOT_CANCEL_STATUS_%', v_booking.status USING ERRCODE = '22023';
  END IF;

  -- Step 1: Mark booking cancelled
  UPDATE public.bookings
  SET status              = 'cancelled',
      cancelled_at        = NOW(),
      cancelled_by        = auth.uid(),
      cancellation_reason = p_reason,
      cancellation_source = 'customer',
      updated_at          = NOW()
  WHERE id = v_booking.id;

  -- Step 2: Revert unit if booking is tied to one (via notes.unit_id JSON or matching reserved unit)
  v_unit_id := NULLIF(v_booking.notes->>'unit_id', '')::uuid;

  IF v_unit_id IS NOT NULL THEN
    UPDATE public.units
    SET status                       = 'available',
        locked_by                    = NULL,
        locked_until                 = NULL,
        reservation_date             = NULL,
        reserved_customer_name       = NULL,
        reserved_customer_phone      = NULL,
        reserved_customer_lead_id    = NULL,
        deposit_amount               = NULL,
        reservation_notes            = NULL,
        updated_at                   = NOW()
    WHERE id = v_unit_id
      AND tenant_id = v_booking.tenant_id
    RETURNING reserved_customer_lead_id INTO v_lead_id;
  END IF;

  -- Step 3: Revert lead interest (if any) so the timeline shows the rollback
  IF v_lead_id IS NOT NULL AND v_unit_id IS NOT NULL THEN
    UPDATE public.lead_interests
    SET status     = 'interested',
        updated_at = NOW()
    WHERE lead_id = v_lead_id
      AND unit_id = v_unit_id
      AND status IN ('reserved', 'won');
  END IF;

  RETURN json_build_object(
    'success',     true,
    'booking_id',  v_booking.id,
    'unit_id',     v_unit_id,
    'cancelled_at', NOW()
  );
END;
$$;


-- 4. Grant execute to authenticated users (only customers will pass the auth check inside)
REVOKE ALL ON FUNCTION public.customer_cancel_booking(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_cancel_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_customer_id() TO authenticated;
