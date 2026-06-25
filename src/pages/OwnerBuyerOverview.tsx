import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { Users, Flame, Percent, Banknote, Brain, Activity, ChevronRight } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────
// ภาพรวมผู้ซื้อ (Buyer Overview) — Owner-lens LAUNCHPAD for the buyer/CDP group.
// Scope = ONLY what the detail page doesn't already own, so it doesn't duplicate:
//   • OwnerCustomers (/owner-customers) owns buyer-base demographics (occupation,
//     purpose, age, income, customer table).
// (OwnerFunnel removed 2026-06-24 — its KPIs duplicated this page and its funnel was
//  tenant-operational; the score→close-rate PROOF lives here, stronger than a donut.)
// This page proves the PRODUCT works: AI score → actual close-rate, and showcases
// what the CDP auto-builds per lead — then links into the buyer database.
// Scoring engine is REAL (src/lib/leadScoring.ts + loanEstimation.ts). Sourced
// from `leads` (the live CDP), aggregate-only, no PII.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8',
  border: '#e5e7eb',
};

// Compact THB — Thai convention "X ล้าน" / "K" (NOT M/B). Canonical (Index.tsx).
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    if (m >= 1000) return `${sign}฿${Math.round(m).toLocaleString('en-US')} ล้าน`;
    if (m >= 100) return `${sign}฿${Math.round(m)} ล้าน`;
    if (m >= 10) return `${sign}฿${m.toFixed(1)} ล้าน`;
    return `${sign}฿${m.toFixed(2)} ล้าน`;
  }
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(0)}K`;
  return `${sign}฿${abs.toFixed(0)}`;
};

// AGGREGATE-ONLY — read the rich CDP/scoring fields off leads, no full_name / PII.
interface LeadRow {
  tenant_id: string;
  status: string | null;
  estimated_value: number | null;
  potential_score: number | null;
  financing_approved: boolean | null;
  max_loan_amount: number | null;
  website_visits: number | null;
  site_visit_attended: boolean | null;
}

const OwnerBuyerOverview = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id').eq('is_platform' as any, false);
      const ids = ((tenants || []) as { id: string }[]).map((t) => t.id);
      if (ids.length > 0) {
        const { data } = await supabase
          .from('leads')
          .select('tenant_id, status, estimated_value, potential_score, financing_approved, max_loan_amount, website_visits, site_visit_attended')
          .in('tenant_id', ids);
        setLeads((data || []) as LeadRow[]);
      }
    } catch (e) {
      console.error('OwnerBuyerOverview fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── KPIs — glance summary (detail lives on ฐานข้อมูลผู้สนใจ /owner-customers) ──
  const kpis = useMemo(() => {
    const total = leads.length;
    const tenantsActive = new Set(leads.map((l) => l.tenant_id)).size;
    const won = leads.filter((l) => l.status === 'won').length;
    const conversion = total ? Math.round((won / total) * 100) : 0;
    const hot = leads.filter((l) => (l.potential_score ?? -1) >= 70).length;
    const pipeline = leads
      .filter((l) => l.status !== 'won' && l.status !== 'lost')
      .reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
    return { total, tenantsActive, won, conversion, hot, pipeline };
  }, [leads]);

  // ── HERO: AI score band → actual close-rate (proves the engine predicts) ──
  // This page's UNIQUE value — score band vs actual close-rate (the score-vs-outcome
  // proof, not just a score distribution).
  const bands = useMemo(() => {
    const scored = leads.filter((l) => l.potential_score != null);
    const def = [
      { key: 'hot', label: 'HOT', range: 'สกอร์ 70+', color: KK.red, test: (s: number) => s >= 70 },
      { key: 'warm', label: 'WARM', range: 'สกอร์ 40–69', color: KK.amber, test: (s: number) => s >= 40 && s < 70 },
      { key: 'cold', label: 'COOL', range: 'สกอร์ < 40', color: KK.gray, test: (s: number) => s < 40 },
    ];
    return def.map((b) => {
      const rows = scored.filter((l) => b.test(Number(l.potential_score)));
      const won = rows.filter((l) => l.status === 'won').length;
      return { ...b, leads: rows.length, won, winPct: rows.length ? Math.round((won / rows.length) * 100) : 0 };
    });
  }, [leads]);

  // ── CDP depth — what the platform auto-builds per lead ────────────────────
  const cdp = useMemo(() => {
    const withLoan = leads.filter((l) => l.max_loan_amount != null && Number(l.max_loan_amount) > 0);
    const avgMaxLoan = withLoan.length ? withLoan.reduce((s, l) => s + Number(l.max_loan_amount), 0) / withLoan.length : 0;
    const financingApproved = leads.filter((l) => l.financing_approved).length;
    const withVisits = leads.filter((l) => l.website_visits != null);
    const avgVisits = withVisits.length ? withVisits.reduce((s, l) => s + Number(l.website_visits), 0) / withVisits.length : 0;
    const siteVisits = leads.filter((l) => l.site_visit_attended).length;
    return { avgMaxLoan, financingApproved, avgVisits, siteVisits };
  }, [leads]);

  const renderKpiCard = (k: any, i: number) => {
    const clickable = Boolean(k.href);
    return (
      <div
        key={i}
        onClick={clickable ? () => navigate(k.href) : undefined}
        role={clickable ? 'button' : undefined}
        className={`bg-white border border-gray-100 rounded-2xl shadow-soft p-6 transition-all duration-200 ${clickable ? 'cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5' : ''}`}
      >
        <div className="flex items-start justify-between mb-5">
          <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5 pr-1 flex-1">{k.label}</p>
          <k.icon className="w-5 h-5 flex-shrink-0" style={{ color: k.color }} strokeWidth={2} />
        </div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none tracking-tight">{k.value}</p>
        {k.sub ? <p className="text-sm text-gray-400 mt-3.5 leading-snug line-clamp-2">{k.sub}</p> : null}
      </div>
    );
  };

  if (loading) {
    return (
      <OwnerGuard>
        <div className="min-h-screen bg-gray-50">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="lg:ml-[260px] min-h-screen">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          </div>
        </div>
      </OwnerGuard>
    );
  }

  const hot = bands.find((b) => b.key === 'hot');
  const cold = bands.find((b) => b.key === 'cold');

  // CDP capability cards (full-width showcase row).
  const capabilities = [
    {
      icon: Banknote, color: KK.green, bg: KK.greenLight,
      title: 'ประเมินสินเชื่ออัตโนมัติ',
      value: `${cdp.financingApproved.toLocaleString()} รายอนุมัติได้`,
      desc: `วงเงินเฉลี่ย ${fmtCompact(cdp.avgMaxLoan)}/ราย · คำนวณ DTI/LTV ตามเกณฑ์ธนาคารไทย`,
    },
    {
      icon: Activity, color: KK.blue, bg: KK.blueLight,
      title: 'ติดตามพฤติกรรมผู้ซื้อ',
      value: `เข้าเว็บเฉลี่ย ${cdp.avgVisits.toFixed(1)} ครั้ง/ราย`,
      desc: `${cdp.siteVisits.toLocaleString()} รายมาดูโครงการ · เข้าชม·หน้า·โบรชัวร์·นัดชม`,
    },
    {
      icon: Brain, color: KK.red, bg: KK.redLight,
      title: 'สกอร์ AI 4 ปัจจัย',
      value: 'การเงิน · การมีส่วนร่วม · ความเร่งด่วน · ความเหมาะสม',
      desc: 'รวมเป็นคะแนนรวม + โอกาสปิด · คำนวณสดทุกครั้งที่บันทึกลีด',
    },
  ];

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-6">
            {/* PAGE TITLE */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-2 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>Analytics</span>
              <h1 className="text-2xl font-bold text-gray-900">ภาพรวมผู้ซื้อ</h1>
              <p className="text-sm text-gray-500 mt-1.5">หลักฐานว่า CDP &amp; AI scoring ของแพลตฟอร์มทำงานจริง · จาก {kpis.tenantsActive} บริษัทที่ใช้ระบบ — กดเข้าดู<span className="font-medium text-gray-600">ฐานข้อมูลผู้สนใจ</span>เชิงลึก</p>
            </div>

            {leads.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีข้อมูลลีด</p>
              </div>
            ) : (
              <>
                {/* KPI strip — glance summary, each drills into the owning detail page */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'ผู้สนใจในระบบ', value: kpis.total.toLocaleString(), icon: Users, color: KK.blue, href: '/owner-customers', sub: `${kpis.tenantsActive} บริษัทที่ใช้ระบบ · ระบบให้สกอร์อัตโนมัติ` },
                    { label: 'ลีดคุณภาพสูง (AI ประเมิน)', value: kpis.hot.toLocaleString(), icon: Flame, color: KK.red, sub: 'สกอร์ ≥ 70 (กลุ่ม HOT)' },
                    { label: 'อัตราปิดการขาย', value: `${kpis.conversion}%`, icon: Percent, color: KK.green, sub: 'ปิดได้ / ลีดทั้งหมด' },
                    { label: 'มูลค่าดีลที่ยังเปิด', value: fmtCompact(kpis.pipeline), icon: Banknote, color: KK.amber, sub: 'ลีดที่ยังไม่ปิด' },
                  ].map(renderKpiCard)}
                </div>

                {/* HERO — AI score band vs actual close-rate (this page's unique proof) */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 flex-shrink-0" style={{ color: KK.red }} />
                    <h2 className="text-base font-bold text-gray-900">AI ให้คะแนนแม่นแค่ไหน</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">สกอร์ที่ระบบให้แต่ละลีด เทียบ<span className="font-semibold text-gray-700">อัตราปิดจริง</span> · ยิ่งสกอร์สูง ยิ่งปิดได้ = สมองที่เราขาย</p>
                  <div className="space-y-4">
                    {bands.map((b) => (
                      <div key={b.key}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-medium text-gray-700">
                            <span className="font-bold tracking-wide" style={{ color: b.color }}>{b.label}</span> <span className="text-xs text-gray-400">· {b.range} · {b.leads.toLocaleString()} ลีด</span>
                          </span>
                          <span className="tabular-nums font-bold" style={{ color: b.color }}>{b.winPct}% <span className="text-xs font-normal text-gray-400">ปิดได้</span></span>
                        </div>
                        <div className="h-7 rounded-lg bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-700"
                            style={{ width: `${Math.max(b.winPct, 4)}%`, background: `linear-gradient(90deg, ${b.color}cc 0%, ${b.color} 100%)` }}>
                            <span className="text-xs font-semibold text-white tabular-nums">{b.won}/{b.leads}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hot && cold && (
                    <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                      ลีดที่ระบบบอกว่า <span className="font-semibold" style={{ color: KK.red }}>HOT ปิดได้ {hot.winPct}%</span> เทียบ <span className="font-semibold text-gray-600">COOL {cold.winPct}%</span> — ทีมขายโฟกัสถูกตัว ไม่เสียเวลา = คุณค่าที่ลูกค้าจ่ายค่าระบบ
                    </p>
                  )}
                </div>

                {/* CDP depth — what the platform auto-builds per lead (full-width showcase) */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 flex-shrink-0" style={{ color: KK.blue }} />
                      <div>
                        <h2 className="text-base font-bold text-gray-900">ความลึกของข้อมูลที่ CDP สร้าง</h2>
                        <p className="text-xs text-gray-500 mt-0.5">ระบบสร้างให้อัตโนมัติทุกลีด — ของที่ CRM ทั่วไปไม่มี</p>
                      </div>
                    </div>
                    <button onClick={() => navigate('/owner-customers')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                      ดูฐานข้อมูลผู้สนใจ <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {capabilities.map((c, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 p-4">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: c.bg }}>
                          <c.icon className="w-4 h-4" style={{ color: c.color }} />
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{c.title}</p>
                        <p className="text-sm text-gray-700 mt-1.5 font-medium">{c.value}</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerBuyerOverview;
