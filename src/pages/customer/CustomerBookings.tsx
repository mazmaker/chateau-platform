import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar, FileText, Loader2, CheckCircle2, Clock, XCircle, Home } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CustomerLayout from './CustomerLayout';

interface Booking {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  check_in_date: string;
  created_at: string;
  notes: any;
  property?: { id: string; name: string; thumbnail_url?: string | null };
}

const CustomerBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/customer/login'); return; }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customer } = await (supabase.from('customers') as any)
          .select('id').eq('auth_user_id', user.id).maybeSingle();
        if (!customer) { setLoading(false); return; }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from('bookings') as any)
          .select('id, status, total_amount, currency, check_in_date, created_at, notes, property:properties(id, name, thumbnail_url)')
          .eq('customer_id', (customer as any).id)
          .order('created_at', { ascending: false });
        setBookings((data || []) as Booking[]);
      } catch (err) {
        console.error('Load bookings error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const fmt = (n: number) => `${(n / 1_000_000).toFixed(2)} ล้าน`;
  const fmtTHB = (n: number) => `฿${n.toLocaleString('th-TH')}`;

  const filtered = bookings.filter((b) => {
    if (filter === 'active') return ['pending', 'confirmed'].includes(b.status);
    if (filter === 'completed') return ['checked_in', 'checked_out'].includes(b.status);
    return true;
  });

  const counts = {
    active: bookings.filter((b) => ['pending', 'confirmed'].includes(b.status)).length,
    completed: bookings.filter((b) => ['checked_in', 'checked_out'].includes(b.status)).length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  };

  const statusInfo = (s: string) => {
    switch (s) {
      case 'pending': return { label: 'รอชำระเงินจอง', icon: Clock, color: 'text-amber-700 bg-amber-50 border-amber-100' };
      case 'confirmed': return { label: 'ชำระแล้ว · ทำสัญญา', icon: CheckCircle2, color: 'text-blue-700 bg-blue-50 border-blue-100' };
      case 'checked_in': return { label: 'โอนกรรมสิทธิ์เรียบร้อย', icon: Home, color: 'text-green-700 bg-green-50 border-green-100' };
      case 'cancelled': return { label: 'ยกเลิก', icon: XCircle, color: 'text-gray-600 bg-gray-100 border-gray-200' };
      default: return { label: s, icon: FileText, color: 'text-gray-600 bg-gray-100 border-gray-200' };
    }
  };

  return (
    <CustomerLayout title="การจองของฉัน" subtitle={`${bookings.length} รายการ`} showBack backTo="/customer">
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">ยังไม่มีการจอง</p>
          <button
            onClick={() => navigate('/customer/properties')}
            className="text-sm font-medium text-chateau hover:underline"
          >
            ดูโครงการของเรา →
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatBlock value={counts.active} label="ดำเนินการ" />
            <StatBlock value={counts.completed} label="โอนแล้ว" tone="green" />
            <StatBlock value={counts.cancelled} label="ยกเลิก" tone="gray" />
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            <FilterPill active={filter === 'active'} onClick={() => setFilter('active')}>กำลังดำเนินการ</FilterPill>
            <FilterPill active={filter === 'completed'} onClick={() => setFilter('completed')}>โอนแล้ว</FilterPill>
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>ทั้งหมด</FilterPill>
          </div>

          {/* Booking list */}
          {filtered.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center text-sm text-gray-400">
              ไม่มีการจองในหมวดนี้
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => {
                const info = statusInfo(b.status);
                const Icon = info.icon;
                const depositAmount = b.notes?.deposit_amount;
                const unitNumber = b.notes?.unit_number;
                return (
                  <div key={b.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    {/* Header — status banner */}
                    <div className={`px-4 py-2.5 border-b ${info.color} flex items-center gap-2`}>
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-semibold">{info.label}</span>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                          {b.property?.thumbnail_url ? (
                            <img src={b.property.thumbnail_url} alt={b.property.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{b.property?.name || 'โครงการ'}</p>
                          {unitNumber && <p className="text-xs text-gray-500 mt-0.5">ยูนิต {unitNumber}</p>}
                          <p className="text-xs text-gray-400 mt-1">
                            จองเมื่อ {new Date(b.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-gray-500 mb-0.5">ราคารวม</p>
                          <p className="text-sm font-bold text-gray-900">{fmt(b.total_amount)}</p>
                        </div>
                        {depositAmount && (
                          <div>
                            <p className="text-[11px] text-gray-500 mb-0.5">เงินจอง</p>
                            <p className="text-sm font-semibold text-chateau">{fmtTHB(depositAmount)}</p>
                          </div>
                        )}
                      </div>

                      {b.status === 'pending' && depositAmount && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <p className="text-xs text-amber-900 font-semibold mb-0.5">รอชำระเงินจอง</p>
                          <p className="text-xs text-amber-700">
                            ติดต่อ Sales เพื่อชำระเงินจอง {fmtTHB(depositAmount)} ภายใน 7 วัน
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => navigate('/customer/payments')}
                        className="mt-3 w-full text-xs font-medium text-chateau hover:underline text-center py-2"
                      >
                        ดูประวัติการชำระเงิน →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </CustomerLayout>
  );
};

const StatBlock = ({ value, label, tone }: { value: number; label: string; tone?: 'green' | 'gray' }) => {
  const color = tone === 'green' ? 'text-green-600' : tone === 'gray' ? 'text-gray-500' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
};

const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
      active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    {children}
  </button>
);

export default CustomerBookings;
