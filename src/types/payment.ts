// Payment Transaction Types

export interface PaymentTransaction {
  id: string;
  lead_id: string;
  tenant_id: string;
  payment_date: string;
  amount: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentSummary {
  total_amount: number;
  total_paid: number;
  total_outstanding: number;
  payment_count: number;
  unit_number?: string;
  property_name?: string;
}

export interface PaymentFormData {
  payment_date: string;
  amount: string;
  notes: string;
}
