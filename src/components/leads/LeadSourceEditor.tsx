// Inline-editable Lead Source — replaces read-only badge with a dropdown.
// Used in Lead Detail views (LeadManagement, LeadCDP) so Sales/Admin can correct the source
// without opening the full Edit Modal.
import { useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui/popover';

// Source options — practical real-estate channels (Sales sees these in CRM)
// Keep label short; group online/offline visually via separator
const SOURCE_OPTIONS: Array<{ value: string; label: string; group: 'online' | 'offline' | 'other' }> = [
  // Online
  { value: 'website',          label: 'Website',          group: 'online' },
  { value: 'online_facebook',  label: 'Facebook',         group: 'online' },
  { value: 'online_line',      label: 'LINE OA',          group: 'online' },
  { value: 'online_google',    label: 'Google',           group: 'online' },
  { value: 'online_tiktok',    label: 'TikTok',           group: 'online' },
  { value: 'online_youtube',   label: 'YouTube',          group: 'online' },
  // Offline
  { value: 'walk_in',          label: 'Walk-in',          group: 'offline' },
  { value: 'event',            label: 'งานอีเว้นท์',       group: 'offline' },
  { value: 'billboard',        label: 'ป้ายโฆษณา',         group: 'offline' },
  { value: 'brochure',         label: 'แผ่นพับ/โบรชัวร์',  group: 'offline' },
  // Other
  { value: 'referral',         label: 'แนะนำ',            group: 'other' },
  { value: 'friend',           label: 'เพื่อน/ญาติ',      group: 'other' },
  { value: 'advertising',      label: 'โฆษณาอื่นๆ',        group: 'other' },
];

const GROUP_LABEL = {
  online:  '🌐 ออนไลน์',
  offline: '🏢 ออฟไลน์',
  other:   '👥 อื่นๆ',
};

interface Props {
  leadId: string;
  currentSource: string | null | undefined;
  onUpdated?: (newSource: string) => void;
  /** Compact pill style (default) or full-width button */
  variant?: 'pill' | 'block';
}

export function LeadSourceEditor({ leadId, currentSource, onUpdated, variant = 'pill' }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localSource, setLocalSource] = useState(currentSource || '');

  // Resolve current display label (handle legacy values like "online_facebook_other: xxx")
  const currentLabel = (() => {
    const exact = SOURCE_OPTIONS.find((o) => o.value === localSource);
    if (exact) return exact.label;
    for (const o of SOURCE_OPTIONS) {
      if (localSource.startsWith(o.value)) return o.label;
    }
    return localSource || 'ไม่ระบุ';
  })();

  const handleSelect = async (newValue: string) => {
    if (newValue === localSource) { setOpen(false); return; }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('leads') as any)
        .update({ source: newValue, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;
      setLocalSource(newValue);
      onUpdated?.(newValue);
      toast.success('อัปเดตแหล่งที่มาเรียบร้อย');
      setOpen(false);
    } catch (err: any) {
      console.error('Update lead source error:', err);
      toast.error('อัปเดตไม่สำเร็จ: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const triggerCls = variant === 'pill'
    ? 'inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors'
    : 'inline-flex items-center justify-between gap-1.5 w-full text-sm font-medium px-3 py-1.5 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerCls} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          <span>{currentLabel}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="max-h-72 overflow-y-auto">
          {(['online', 'offline', 'other'] as const).map((group) => {
            const items = SOURCE_OPTIONS.filter((o) => o.group === group);
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-1">
                  {GROUP_LABEL[group]}
                </p>
                {items.map((o) => {
                  const selected = o.value === localSource;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => handleSelect(o.value)}
                      className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-gray-100 transition-colors ${
                        selected ? 'bg-rose-50 text-chateau font-semibold' : 'text-gray-700'
                      }`}
                    >
                      <span>{o.label}</span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
