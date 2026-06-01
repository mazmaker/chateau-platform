// Single source of truth for lead (leads.status) display labels.
// The underlying DB enum values never change — only these Thai labels do — so any
// future wording tweak is a one-line edit here instead of hunting across ~8 files.
//
// NOTE: this is for leads.status only. lead_interests.status is a DIFFERENT enum
// (interested / viewing_scheduled / reserved / dropped …) — keep that separate.

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'negotiating'
  | 'won'
  | 'lost';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'ใหม่',
  contacted: 'ติดต่อแล้ว',
  qualified: 'มีคุณสมบัติ',
  negotiating: 'กำลังเจรจา',
  won: 'ปิดการขายสำเร็จ',
  lost: 'ปิดการขายไม่สำเร็จ',
};

/** Display label for a lead status. Falls back to the raw value for unknown statuses. */
export const leadStatusLabel = (status?: string | null): string =>
  (status && LEAD_STATUS_LABELS[status as LeadStatus]) || status || '-';

/** Canonical pipeline order (excludes lost — it's a dead-end, not a funnel stage). */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'new', 'contacted', 'qualified', 'negotiating', 'won',
];
