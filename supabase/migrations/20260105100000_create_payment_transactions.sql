-- Create payment_transactions table for tracking lead payment installments
-- This table stores all payment transactions for each lead

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Payment details
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  notes TEXT,

  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure tenant isolation
  CONSTRAINT fk_tenant CHECK (tenant_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_lead_id ON public.payment_transactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_id ON public.payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_date ON public.payment_transactions(payment_date DESC);

-- RLS Policies
-- Policy: Users can view payment transactions in their tenant
CREATE POLICY "Users can view payment_transactions in their tenant"
ON public.payment_transactions FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

-- Policy: Users can insert payment transactions in their tenant
CREATE POLICY "Users can insert payment_transactions in their tenant"
ON public.payment_transactions FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

-- Policy: Users can update payment transactions in their tenant
CREATE POLICY "Users can update payment_transactions in their tenant"
ON public.payment_transactions FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

-- Policy: Users can delete payment transactions in their tenant
CREATE POLICY "Users can delete payment_transactions in their tenant"
ON public.payment_transactions FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  )
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get payment summary for a lead
CREATE OR REPLACE FUNCTION public.get_lead_payment_summary(p_lead_id UUID)
RETURNS TABLE (
  total_amount DECIMAL,
  total_paid DECIMAL,
  total_outstanding DECIMAL,
  payment_count INTEGER,
  unit_number TEXT,
  property_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(u.price, l.estimated_value, 0) as total_amount,
    COALESCE(SUM(pt.amount), 0) as total_paid,
    COALESCE(u.price, l.estimated_value, 0) - COALESCE(SUM(pt.amount), 0) as total_outstanding,
    COUNT(pt.id)::INTEGER as payment_count,
    u.unit_number,
    p.name as property_name
  FROM public.leads l
  LEFT JOIN public.units u ON l.unit_id = u.id
  LEFT JOIN public.properties p ON l.property_id = p.id
  LEFT JOIN public.payment_transactions pt ON pt.lead_id = l.id
  WHERE l.id = p_lead_id
  GROUP BY l.id, l.estimated_value, u.price, u.unit_number, p.name;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_payment_summary TO authenticated;

-- Add comment
COMMENT ON TABLE public.payment_transactions IS 'Stores payment installment transactions for leads';
COMMENT ON FUNCTION public.get_lead_payment_summary IS 'Returns payment summary (total, paid, outstanding) for a specific lead';
