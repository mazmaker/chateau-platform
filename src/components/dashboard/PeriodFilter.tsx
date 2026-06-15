// Shared period / date-range filter for Owner console pages.
//
// From the dashboard-tier audit (strategic vs analytical vs operational):
//   • strategic   — Executive, Tenant Health: trend-level, NO single-day. (30วัน/เดือน/ไตรมาส/ปี/ทั้งหมด)
//   • analytical  — Sales Overview, Customer, Funnel, Geography, Company/Sales Perf: flexible range,
//                   default เดือน, can go down to day.
//   • operational — Payments, Support, Sales Pipeline, Marketing: need day-level (วันนี้/7วัน/...).
//
// Pure UI control + range helpers. Pages own how they apply the resolved range to their data.

export type PeriodKey = 'today' | '7d' | '30d' | 'mtd' | 'qtd' | 'ytd' | 'all';
export type PeriodTier = 'strategic' | 'analytical' | 'operational';

const ALL_PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d',    label: '7 วัน' },
  { key: '30d',   label: '30 วัน' },
  { key: 'mtd',   label: 'เดือนนี้' },
  { key: 'qtd',   label: 'ไตรมาสนี้' },
  { key: 'ytd',   label: 'ปีนี้' },
  { key: 'all',   label: 'ทั้งหมด' },
];

// Which keys each tier exposes (order preserved from ALL_PERIODS).
const TIER_KEYS: Record<PeriodTier, PeriodKey[]> = {
  strategic:   ['30d', 'mtd', 'qtd', 'ytd', 'all'],          // no วันนี้/7วัน — too operational for an exec view
  analytical:  ['7d', '30d', 'mtd', 'qtd', 'ytd', 'all'],
  operational: ['today', '7d', '30d', 'mtd', 'all'],         // day-level matters; ปี/ไตรมาส less so
};

export const DEFAULT_PERIOD: Record<PeriodTier, PeriodKey> = {
  strategic: '30d',
  analytical: '30d',
  operational: '30d',
};

// Resolve a period key to a [from, to] window. `from === null` means "no lower bound" (ทั้งหมด).
export const periodToRange = (period: PeriodKey): { from: Date | null; to: Date } => {
  const to = new Date();
  if (period === 'all') return { from: null, to };
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (period === 'today') { /* from = start of today */ }
  else if (period === '7d') from.setDate(from.getDate() - 6);
  else if (period === '30d') from.setDate(from.getDate() - 29);
  else if (period === 'mtd') from.setDate(1);
  else if (period === 'qtd') { from.setMonth(Math.floor(from.getMonth() / 3) * 3); from.setDate(1); }
  else if (period === 'ytd') { from.setMonth(0); from.setDate(1); }
  return { from, to };
};

// Thai human label of the resolved range — e.g. "17 พ.ค. – 15 มิ.ย. 69".
export const periodRangeLabel = (period: PeriodKey): string => {
  if (period === 'all') return 'ทั้งหมด';
  const { from, to } = periodToRange(period);
  const f = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  if (period === 'today' || !from) return f(to);
  return `${f(from)} – ${f(to)}`;
};

const RED = '#ef4444';
const GRAY = '#94a3b8';

interface PeriodFilterProps {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
  tier?: PeriodTier;
  className?: string;
}

const PeriodFilter = ({ value, onChange, tier = 'analytical', className = '' }: PeriodFilterProps) => {
  const options = TIER_KEYS[tier].map((k) => ALL_PERIODS.find((p) => p.key === k)!);
  return (
    <div className={`flex items-center gap-0.5 bg-white border border-gray-200 rounded-xl p-1 flex-wrap ${className}`}>
      {options.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
          style={value === p.key ? { backgroundColor: RED, color: '#fff' } : { color: GRAY }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};

export default PeriodFilter;
