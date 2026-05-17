import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar, FileText, Loader2, CheckCircle2, Clock, XCircle, Home, AlertCircle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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

const CANCEL_REASONS = [
  { value: 'changed_mind', label: 'เปลี่ยนใจ' },
  { value: 'found_other', label: 'เจอโครงการอื่นที่ตรงกว่า' },
  { value: 'over_budget', label: 'เกินงบประมาณ' },
  { value: 'need_more_time', label: 'ขอเวลาตัดสินใจ' },
  { value: 'other', label: 'อื่นๆ' },
] as const;

const CustomerBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('changed_mind');
  const [cancelDetail, setCancelDetail] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const reloadBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: customer } = await (supabase.from('customers') as any)
        .select('id').eq('auth_user_id', user.id).maybeSingle();
      if (!customer) return;
      const { data } = await (supabase.from('bookings') as any)
        .select('id, status, total_amount, currency, check_in_date, created_at, notes, property:properties(id, name, thumbnail_url)')
        .eq('customer_id', (customer as any).id)
        .order('created_at', { ascending: false });
      setBookings((data || []) as Booking[]);
    } catch (err) {
      console.error('Reload bookings error:', err);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setSubmitting(true);
    try {
      const reasonLabel = CANCEL_REASONS.find((r) => r.value === cancelReason)?.label || cancelReason;
      const fullReason = cancelDetail.trim()
        ? `${reasonLabel}: ${cancelDetail.trim()}`
        : reasonLabel;
      const { error } = await (supabase as any).rpc('customer_cancel_booking', {
        p_booking_id: cancellingBooking.id,
        p_reason: fullReason,
      });
      if (error) throw error;
      toast.success('ยกเลิกการจองเรียบร้อย');
      setCancellingBooking(null);
      setCancelReason('changed_mind');
      setCancelDetail('');
      await reloadBookings();
    } catch (err: any) {
      console.error('Cancel booking error:', err);
      const msg: string = err?.message || '';
      if (msg.includes('CANNOT_CANCEL_STATUS')) {
        toast.error('ไม่สามารถยกเลิกได้ — booking นี้ผ่านขั้นชำระเงินแล้ว กรุณาติดต่อ Sales');
      } else if (msg.includes('BOOKING_NOT_FOUND_OR_NOT_OWNED')) {
        toast.error('ไม่พบการจองนี้');
      } else if (msg.includes('NOT_AUTHENTICATED')) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
      } else {
        toast.error('เกิดข้อผิดพลาด: ' + msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/customer/login'); return; }

        // Auto-revert any expired reservations so the customer sees up-to-date booking statuses
        try { await (supabase as any).rpc('revert_expired_unit_reservations'); } catch { /* ignore */ }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customer } = await (supabase.from('customers') as any)
          .select('id').eq('auth_user_id', user.id).maybeSingle();
        if (!customer) { setLoading(false); return; }
        const customerId = (customer as any).id;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from('bookings') as any)
          .select('id, status, total_amount, currency, check_in_date, created_at, notes, property:properties(id, name, thumbnail_url)')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });
        setBookings((data || []) as Booking[]);

        // Realtime: live-refresh this list when Sales/Admin updates any of THIS customer's bookings
        // (status pending → confirmed → checked_in / cancelled).
        channel = (supabase as any)
          .channel(`customer-bookings-list-${customerId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${customerId}` },
            () => { reloadBookings(); }
          )
          .subscribe();
      } catch (err) {
        console.error('Load bookings error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { if (channel) (supabase as any).removeChannel(channel); };
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

  // Labels follow standard Thai real estate purchase journey (Sansiri/AP/Origin):
  // pending = รอชำระมัดจำ (must match dashboard "💰 รอชำระมัดจำ" badge)
  const statusInfo = (s: string) => {
    switch (s) {
      case 'pending': return { label: '💰 รอชำระมัดจำ', icon: Clock, color: 'text-orange-700 bg-orange-50 border-orange-100' };
      case 'confirmed': return { label: '✓ ชำระแล้ว · รอทำสัญญา', icon: CheckCircle2, color: 'text-blue-700 bg-blue-50 border-blue-100' };
      case 'checked_in': return { label: '🏠 โอนกรรมสิทธิ์แล้ว', icon: Home, color: 'text-green-700 bg-green-50 border-green-100' };
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
            <StatBlock value={counts.active} label="การจองของฉัน" />
            <StatBlock value={counts.completed} label="โอนกรรมสิทธิ์แล้ว" tone="green" />
            <StatBlock value={counts.cancelled} label="ยกเลิก" tone="gray" />
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            <FilterPill active={filter === 'active'} onClick={() => setFilter('active')}>การจองของฉัน</FilterPill>
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
                const unitId = b.notes?.unit_id;
                const isClickable = !!unitId;
                return (
                  <div
                    key={b.id}
                    onClick={() => { if (unitId) navigate(`/customer/units/${unitId}`); }}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        navigate(`/customer/units/${unitId}`);
                      }
                    }}
                    className={`bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all ${
                      isClickable ? 'cursor-pointer hover:border-chateau hover:shadow-sm' : ''
                    }`}
                  >
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
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                          <p className="text-xs text-orange-900 font-semibold mb-0.5">💰 รอชำระมัดจำ</p>
                          <p className="text-xs text-orange-700">
                            ติดต่อ Sales เพื่อชำระเงินมัดจำ {fmtTHB(depositAmount)} ภายใน 7 วัน
                          </p>
                        </div>
                      )}

                      {b.status === 'pending' && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setCancellingBooking(b); }}
                            className="text-xs font-medium text-red-600 hover:bg-red-50 text-center py-2 px-3 rounded-lg border border-red-100"
                          >
                            ยกเลิกการจอง
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Cancel Booking Modal */}
      {cancellingBooking && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !submitting && setCancellingBooking(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-semibold text-gray-900">ยกเลิกการจอง</h3>
              </div>
              <button
                onClick={() => !submitting && setCancellingBooking(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={submitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Booking summary */}
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <p className="font-semibold text-gray-900">{cancellingBooking.property?.name || 'โครงการ'}</p>
                {cancellingBooking.notes?.unit_number && (
                  <p className="text-xs text-gray-600 mt-0.5">ยูนิต {cancellingBooking.notes.unit_number}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  จองเมื่อ {new Date(cancellingBooking.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                </p>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs text-amber-900">
                  ⚠️ <span className="font-semibold">การยกเลิกไม่สามารถกู้คืนได้</span> — ยูนิตจะถูกปล่อยให้ลูกค้าคนอื่นจองต่อทันที
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">เหตุผลในการยกเลิก</label>
                <div className="space-y-1.5">
                  {CANCEL_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        cancelReason === r.value
                          ? 'border-chateau bg-red-50/50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={r.value}
                        checked={cancelReason === r.value}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="accent-chateau"
                      />
                      <span className="text-sm text-gray-800">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Detail textarea */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  รายละเอียดเพิ่มเติม {cancelReason === 'other' ? <span className="text-red-500">*</span> : <span className="text-gray-400">(ไม่บังคับ)</span>}
                </label>
                <textarea
                  value={cancelDetail}
                  onChange={(e) => setCancelDetail(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="ระบุเพิ่มเติมถ้ามี..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{cancelDetail.length}/200</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => setCancellingBooking(null)}
                disabled={submitting}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ปิด
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={submitting || (cancelReason === 'other' && !cancelDetail.trim())}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังยกเลิก...</> : 'ยืนยันยกเลิก'}
              </button>
            </div>
          </div>
        </div>
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
