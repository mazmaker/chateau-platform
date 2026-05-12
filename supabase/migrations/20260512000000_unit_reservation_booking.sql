-- Add booking/reservation fields to units (PROPERTY HUB-style: post-deposit tracking)
-- Existing fields reused:
--   locked_by      → user (sales/admin) who recorded the booking
--   locked_until   → expiration date (when contract must complete or reservation voids)

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS reserved_customer_name text,
  ADD COLUMN IF NOT EXISTS reserved_customer_phone text,
  ADD COLUMN IF NOT EXISTS reserved_customer_lead_id uuid,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS reservation_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reservation_notes text;

-- Optional FK to leads (deferred — leads table may have RLS that complicates)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='leads') THEN
    BEGIN
      ALTER TABLE public.units
        ADD CONSTRAINT units_reserved_lead_fkey
        FOREIGN KEY (reserved_customer_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

COMMENT ON COLUMN public.units.reserved_customer_name IS 'Buyer full name (for booking record)';
COMMENT ON COLUMN public.units.reserved_customer_phone IS 'Buyer phone number';
COMMENT ON COLUMN public.units.reserved_customer_lead_id IS 'Optional FK to leads if customer already in CRM';
COMMENT ON COLUMN public.units.deposit_amount IS 'Deposit/booking fee paid (THB)';
COMMENT ON COLUMN public.units.reservation_date IS 'When the deposit was paid / booking recorded';
COMMENT ON COLUMN public.units.reservation_notes IS 'Internal sales notes about the booking';
