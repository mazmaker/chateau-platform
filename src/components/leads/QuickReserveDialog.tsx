import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface QuickReserveInterest {
  id: string;
  lead_id: string;
  property_id: string;
  unit_id: string;
  property?: { id: string; name: string };
  unit?: { id: string; unit_number: string; price?: number };
}

interface QuickReserveLead {
  id: string;
  customer_id: string;
  tenant_id: string;
}

interface QuickReserveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: QuickReserveLead | null;
  interest: QuickReserveInterest | null;
  customerName: string;
  customerPhone?: string;
  userId: string;
  // Agent has a lower discount cap; Sales/Admin/Owner unrestricted.
  // External agents typically can only lock the unit for 24h (Sales gets 14 days default).
  isAgent?: boolean;
  onSuccess: () => void;
}

const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
  }).format(n);

export default function QuickReserveDialog({
  open,
  onOpenChange,
  lead,
  interest,
  customerName,
  customerPhone,
  userId,
  isAgent = false,
  onSuccess,
}: QuickReserveDialogProps) {
  const unitPrice = Number(interest?.unit?.price || 0);
  // Industry-standard ค่าจอง (booking fee): fixed token of ฿5,000-10,000 baht to lock
  // the unit. This is NOT ค่ามัดจำ (the 10-15% down payment, which comes later at
  // contract signing). The dialog previously suggested 1% of price (e.g. ฿35K on
  // ฿3.5M), which mixed the two concepts and confused customers reading the timeline.
  const suggestedDeposit = 10000;

  const [depositAmount, setDepositAmount] = useState('');
  const [expiryDays, setExpiryDays] = useState(isAgent ? 2 : 14);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form whenever the dialog (re)opens for a new interest
  useEffect(() => {
    if (open) {
      setDepositAmount(suggestedDeposit > 0 ? String(suggestedDeposit) : '');
      setExpiryDays(isAgent ? 2 : 14);
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, interest?.id]);

  const handleSave = async () => {
    if (!lead || !interest?.unit_id) {
      toast.error('ข้อมูลไม่ครบ');
      return;
    }
    const amt = parseFloat(depositAmount);
    // Booking fee is OPTIONAL: a positive amount = a paid reservation; blank/0 =
    // a money-free hold ("กันยูนิตเฉยๆ"), now available to Sales/Admin too — the
    // same as the agent courtesy hold. Agents are always money-free.
    const collectingFee = !isAgent && amt > 0;

    setSaving(true);
    try {
      const nowDate = new Date();
      const lockedUntil = new Date(
        nowDate.getTime() + expiryDays * 86400000,
      ).toISOString();

      // 1) Lock the unit (reserved).
      //    • Agent = money-free courtesy hold: no deposit_amount recorded.
      //    • Sales/Admin = paid reservation: records ค่าจอง.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unitUpdate: Record<string, any> = {
        status: 'reserved',
        locked_by: userId,
        locked_until: lockedUntil,
        reservation_date: nowDate.toISOString(),
        reserved_customer_name: customerName,
        reserved_customer_phone: customerPhone || null,
        reserved_customer_lead_id: lead.id,
        reservation_notes: notes.trim() || null,
      };
      if (collectingFee) unitUpdate.deposit_amount = amt;

      // Atomic availability guard:
      //    • Agent may only hold a fresh 'available' unit.
      //    • Sales may ALSO convert an existing agent courtesy-hold for the SAME
      //      lead into a paid reservation (status already 'reserved' by the agent).
      // RLS still enforces tenant + role + assignment underneath either path.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let unitQuery = (supabase.from('units') as any).update(unitUpdate).eq('id', interest.unit_id);
      unitQuery = isAgent
        ? unitQuery.eq('status', 'available')
        : unitQuery.or(`status.eq.available,and(status.eq.reserved,reserved_customer_lead_id.eq.${lead.id})`);
      const { data: unitData, error: unitErr } = await unitQuery.select('id, status');
      if (unitErr) throw unitErr;
      if (!unitData || unitData.length === 0) {
        // Two reasons we land here:
        //   (a) RLS rejected (no UPDATE permission) — Agent not assigned, Sales not designated
        //   (b) Unit was no longer 'available' (someone else reserved/sold it first)
        // Disambiguate with a quick re-read so the user gets a useful message.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: probe } = await (supabase.from('units') as any)
          .select('status')
          .eq('id', interest.unit_id)
          .maybeSingle();
        if (probe && probe.status && probe.status !== 'available') {
          throw new Error(`ยูนิตนี้ถูกจองไปแล้ว (สถานะ: ${probe.status})`);
        }
        throw new Error('ไม่มีสิทธิ์บันทึกการจองยูนิตนี้ (ตรวจสอบ allotment กับ Admin)');
      }

      // 2) Lead status → negotiating
      // Reservation/hold = customer committed enough to lock a unit (NOT yet contracted).
      // 'won' is reserved for after contract+transfer; setting it here breaks pipeline conversion reports.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('leads') as any)
        .update({ status: 'negotiating' })
        .eq('id', lead.id);

      // 3) lead_interests → reserved
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('lead_interests') as any)
        .update({ status: 'reserved', updated_at: nowDate.toISOString() })
        .eq('id', interest.id);

      // 4) Paid reservations only: create customer-facing booking record.
      // Agent courtesy holds record NO money — Sales collects ค่าจอง later, which
      // creates the booking at that point.
      if (collectingFee && lead.customer_id && unitPrice > 0) {
        const reservationDay = nowDate.toISOString().slice(0, 10);
        const transferEstimate = new Date(
          nowDate.getTime() + 90 * 86400000,
        ).toISOString().slice(0, 10);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('bookings') as any).insert({
          tenant_id: lead.tenant_id,
          property_id: interest.property_id,
          customer_id: lead.customer_id,
          check_in_date: reservationDay,
          check_out_date: transferEstimate,
          total_amount: unitPrice,
          currency: 'THB',
          status: 'pending',
          notes: {
            unit_id: interest.unit_id,
            unit_number: interest.unit?.unit_number,
            lead_id: lead.id,
            // Two-payment model: booking_fee (ค่าจอง 5-10K) is collected now to lock
            // the unit; deposit_amount (ค่ามัดจำ 10-15%) is collected later at contract
            // signing via UnitDetail's "ยืนยันรับเงิน" flow. Keep deposit_amount unset
            // until then so the customer timeline doesn't prematurely show ค่ามัดจำ ✓.
            booking_fee: amt,
            booking_fee_paid_at: nowDate.toISOString(),
            deposit_amount: null,
            remaining_amount: Math.max(0, unitPrice - amt),
            source: 'quick_reserve',
          },
          created_by: userId,
        });
      }

      // 5) Activity log
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('activity_logs') as any).insert({
        tenant_id: lead.tenant_id,
        user_id: userId,
        activity_type: 'unit_reserved',
        description: collectingFee
          ? `รับค่าจองยูนิต ${interest.unit?.unit_number || ''} (${interest.property?.name || ''}) จาก ${customerName} · ค่าจอง ${formatTHB(amt)}`
          : `กันยูนิต ${interest.unit?.unit_number || ''} (${interest.property?.name || ''}) ให้ ${customerName} · จองไว้ ${expiryDays} วัน (ยังไม่เก็บค่าจอง)`,
        metadata: {
          lead_id: lead.id,
          unit_id: interest.unit_id,
          interest_id: interest.id,
          ...(collectingFee ? { deposit_amount: amt } : { hold: true }),
        },
      });

      toast.success(
        collectingFee
          ? `รับค่าจองยูนิต ${interest.unit?.unit_number || ''} สำเร็จ`
          : `กันยูนิต ${interest.unit?.unit_number || ''} สำเร็จ`,
      );
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-chateau" />
            {isAgent ? 'จองชั่วคราว' : 'จองยูนิต'}
          </DialogTitle>
          <DialogDescription>
            {isAgent
              ? 'จองยูนิตไว้ชั่วคราว — นายหน้าไม่เก็บเงิน ให้ Lead ไปวางค่าจองกับทีมขายเพื่อยืนยัน'
              : 'ใส่ "ค่าจอง" = ล็อกยูนิตแบบเก็บเงิน · เว้นว่าง = กันยูนิตให้ลูกค้าเฉยๆ (ไม่เก็บเงิน)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pre-filled summary card */}
          <div className="p-3 rounded-lg border border-chateau/20 bg-chateau/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
                <Building2 className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {interest?.property?.name || '-'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                  <span>
                    ยูนิต{' '}
                    <span className="font-semibold text-gray-800">
                      {interest?.unit?.unit_number || '-'}
                    </span>
                  </span>
                  {unitPrice > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-bold tabular-nums text-gray-900">
                        {formatTHB(unitPrice)}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {isAgent ? 'Lead' : 'ลูกค้า'}: <span className="font-medium text-gray-700">{customerName}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ค่าจอง (booking fee) — OPTIONAL for Sales/Admin: blank = money-free
              hold. Hidden entirely for agents (always money-free). */}
          {!isAgent && (
            <div>
              <Label htmlFor="qr-deposit" className="text-sm">
                ค่าจอง (฿) <span className="text-gray-400 font-normal">— ไม่บังคับ</span>
              </Label>
              <Input
                id="qr-deposit"
                type="number"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="เช่น 10000"
                className="mt-1"
                disabled={saving}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                เว้นว่าง = กันยูนิตเฉยๆ ไม่เก็บเงิน · ถ้าเก็บ มาตรฐาน ฿5,000-10,000 (ค่ามัดจำ 10-15% รับตอนเซ็นสัญญา)
              </p>
            </div>
          )}

          {/* Expiry */}
          <div>
            <Label htmlFor="qr-expiry" className="text-sm">
              {isAgent ? 'จองไว้ (วัน)' : 'ล็อกยูนิต (วัน)'}
            </Label>
            <Input
              id="qr-expiry"
              type="number"
              min="1"
              max={isAgent ? 3 : 30}
              value={expiryDays}
              onChange={(e) => setExpiryDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="mt-1"
              disabled={saving}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              {isAgent
                ? 'จองชั่วคราวได้สูงสุด 3 วัน — ให้ Lead ไปวางค่าจองกับทีมขายภายในกำหนด'
                : 'ค่าเริ่มต้น 14 วัน ก่อนทำสัญญา/รับค่ามัดจำ'}
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="qr-notes" className="text-sm">
              หมายเหตุ
            </Label>
            <Textarea
              id="qr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น โอนผ่าน K-Bank, ขอผ่อนดาวน์ 6 งวด"
              rows={2}
              className="mt-1"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : isAgent ? 'ยืนยันจองชั่วคราว' : 'ยืนยันจอง'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
