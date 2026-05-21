// Inline-editable Lead Priority — pill dropdown so Sales/Admin can bump a lead's urgency
// (or de-escalate it) without opening the full Edit Modal.
// Mirrors LeadSourceEditor's pattern for visual consistency.
import { useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/popover';

type Priority = 'high' | 'medium' | 'low';

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string; emoji: string; description: string; pillClass: string }> = [
  { value: 'high',   emoji: '', label: 'ด่วน',  description: 'ติดตามก่อน — โอกาสปิดดีลสูง', pillClass: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300' },
  { value: 'medium', emoji: '', label: 'ปกติ',  description: 'ติดตามตามรอบปกติ',           pillClass: 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300' },
  { value: 'low',    emoji: '', label: 'ต่ำ',   description: 'รอลูกค้าตอบกลับ / ไม่เร่ง',  pillClass: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300' },
];

interface Props {
  leadId: string;
  currentPriority: string | null | undefined;
  onUpdated?: (newPriority: Priority) => void;
}

export function LeadPriorityEditor({ leadId, currentPriority, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPriority, setLocalPriority] = useState<Priority>(
    (currentPriority as Priority) || 'medium'
  );

  const current = PRIORITY_OPTIONS.find((o) => o.value === localPriority) || PRIORITY_OPTIONS[1];

  const handleSelect = async (newValue: Priority) => {
    if (newValue === localPriority) { setOpen(false); return; }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('leads') as any)
        .update({ priority: newValue, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;
      setLocalPriority(newValue);
      onUpdated?.(newValue);
      toast.success(`อัปเดตความสำคัญเป็น "${PRIORITY_OPTIONS.find((o) => o.value === newValue)?.label}" แล้ว`);
      setOpen(false);
    } catch (err: any) {
      console.error('Update priority error:', err);
      toast.error('อัปเดตไม่สำเร็จ: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md border transition-colors ${current.pillClass}`}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="text-sm leading-none">{current.emoji}</span>}
          <span>{current.label}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-1">
          ระดับความสำคัญ
        </p>
        {PRIORITY_OPTIONS.map((o) => {
          const selected = o.value === localPriority;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => handleSelect(o.value)}
              className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-md hover:bg-gray-100 transition-colors ${selected ? 'bg-rose-50' : ''}`}
            >
              <span className="text-base leading-none mt-0.5">{o.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${selected ? 'font-semibold text-chateau' : 'text-gray-800'}`}>{o.label}</p>
                <p className="text-[11px] text-gray-500">{o.description}</p>
              </div>
              {selected && <Check className="w-3.5 h-3.5 text-chateau flex-shrink-0 mt-1" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
