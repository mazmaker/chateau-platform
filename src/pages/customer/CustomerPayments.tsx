import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle2, Loader2, Receipt, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CustomerLayout from './CustomerLayout';

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  notes?: string | null;
  created_at: string;
}

const CustomerPayments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/customer/login'); return; }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customer } = await (supabase.from('customers') as any)
          .select('id').eq('auth_user_id', user.id).maybeSingle();
        if (!customer) { setLoading(false); return; }

        // Get leads for this customer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leads } = await (supabase.from('leads') as any)
          .select('id').eq('customer_id', (customer as any).id);
        const leadIds = (leads || []).map((l: any) => l.id);

        if (leadIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase.from('payment_transactions') as any)
            .select('id, payment_date, amount, notes, created_at')
            .in('lead_id', leadIds)
            .order('payment_date', { ascending: false });
          setPayments((data || []) as Payment[]);
        }
      } catch (err) {
        console.error('Load payments error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const thisMonth = payments.filter((p) => {
    const d = new Date(p.payment_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, p) => sum + Number(p.amount), 0);

  const fmtBaht = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`;
  const fmtM = (n: number) => `${(n / 1_000_000).toFixed(2)} ล้าน`;

  // Group payments by month
  const grouped = payments.reduce((acc: Record<string, Payment[]>, p) => {
    const d = new Date(p.payment_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const sortedKeys = Object.keys(grouped).sort().reverse();
  const monthName = (key: string) => {
    const [y, m] = key.split('-');
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${months[parseInt(m) - 1]} ${parseInt(y) + 543}`;
  };

  return (
    <CustomerLayout title="การชำระเงิน" subtitle={`${payments.length} รายการ`} showBack backTo="/customer">
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : payments.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">ยังไม่มีประวัติการชำระเงิน</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-gradient-to-br from-chateau to-chateau-700 text-white rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-white/80 mb-1">ยอดชำระทั้งหมด</p>
                <p className="text-3xl font-bold">{fmtM(total)}</p>
                <p className="text-xs text-white/70 mt-1">{fmtBaht(total)} บาท</p>
              </div>
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            {thisMonth > 0 && (
              <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                <span className="text-xs text-white/80">เดือนนี้</span>
                <span className="text-sm font-semibold">{fmtBaht(thisMonth)}</span>
              </div>
            )}
          </div>

          {/* Payment list grouped by month */}
          <div className="space-y-5">
            {sortedKeys.map((key) => {
              const items = grouped[key];
              const monthTotal = items.reduce((s, p) => s + Number(p.amount), 0);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-sm font-semibold text-gray-900">{monthName(key)}</h3>
                    <span className="text-xs text-gray-500">{fmtBaht(monthTotal)}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.notes || 'ชำระเงิน'}</p>
                            <p className="text-sm font-bold text-gray-900 flex-shrink-0">{fmtBaht(Number(p.amount))}</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(p.payment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info note */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
            <div className="flex gap-2">
              <CreditCard className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 leading-relaxed">
                ต้องการใบเสร็จ ใบกำกับภาษี หรือสอบถามการชำระเงิน? <br />
                ติดต่อทีม Sales ของคุณได้ทันที
              </p>
            </div>
          </div>
        </>
      )}
    </CustomerLayout>
  );
};

export default CustomerPayments;
