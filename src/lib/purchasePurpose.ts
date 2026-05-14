// Canonical purchase_purpose options — single source of truth for ALL forms (Customer, Lead, CDP).
// Old granular values (speculation/monthly_rent/daily_rent/flip/children/parents/own_residence)
// are mapped here for legacy data display, but new entries should only write the 5 canonical values.

export type PurchasePurpose =
  | 'residence'
  | 'investment'
  | 'vacation'
  | 'family'
  | 'other';

export const PURCHASE_PURPOSE_OPTIONS: Array<{ value: PurchasePurpose; label: string; emoji: string }> = [
  { value: 'residence',  emoji: '🏡', label: 'อยู่อาศัยเอง' },
  { value: 'investment', emoji: '💰', label: 'ลงทุน (เช่า / ขายต่อ)' },
  { value: 'vacation',   emoji: '🌴', label: 'บ้านที่สอง / พักผ่อน' },
  { value: 'family',     emoji: '👨‍👩‍👧', label: 'ครอบครัว (พ่อแม่ / บุตรหลาน)' },
  { value: 'other',      emoji: '❓', label: 'อื่นๆ / ยังไม่ตัดสินใจ' },
];

// Map legacy values → canonical (for displaying old records before migration completes)
const LEGACY_MAP: Record<string, PurchasePurpose> = {
  own_residence: 'residence',
  speculation:   'investment',
  monthly_rent:  'investment',
  daily_rent:    'investment',
  flip:          'investment',
  children:      'family',
  parents:       'family',
};

/** Get full label "🏡 อยู่อาศัยเอง" — handles legacy values and free-text "other:xxx" */
export function getPurchasePurposeLabel(value?: string | null): string {
  if (!value) return '-';
  // Handle free-text variant "other: ระยะยาว"
  if (value.startsWith('other:')) return '❓ อื่นๆ: ' + value.replace('other:', '').trim();
  if (value === 'other') return '❓ อื่นๆ / ยังไม่ตัดสินใจ';

  // Resolve legacy → canonical
  const canonical = (LEGACY_MAP[value] || value) as PurchasePurpose;
  const opt = PURCHASE_PURPOSE_OPTIONS.find((o) => o.value === canonical);
  return opt ? `${opt.emoji} ${opt.label}` : value;
}

/** Normalize incoming value (form field) to canonical — use before writing to DB */
export function normalizePurchasePurpose(value: string): PurchasePurpose | '' {
  if (!value) return '';
  if (value.startsWith('other')) return 'other';
  const canonical = (LEGACY_MAP[value] || value) as PurchasePurpose;
  return PURCHASE_PURPOSE_OPTIONS.some((o) => o.value === canonical) ? canonical : 'other';
}
