import { useState, useEffect, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Shield, Search, Clock, Building2, ChevronDown, ChevronRight } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────
// บันทึกการตรวจสอบ — platform-wide audit log over activity_logs (Owner RLS:
// sees all tenants). Read-only. PDPA: shows WHO/WHAT/WHEN at action level, no
// customer PII payloads. See documents/owner-hq-dashboard-plan.md.
// NOTE: the earlier "campaign_* audit fails silently" concern is NOT present in
// the live DB — activity_type has no CHECK constraint and campaign_* rows exist.
// So no migration is needed.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  slate: '#475569', slateLight: '#f1f5f9',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};

const TYPE_TH: Record<string, string> = {
  lead_created: 'สร้าง Lead', lead_updated: 'แก้ไข Lead', lead_deleted: 'ลบ Lead', lead_assigned: 'มอบหมาย Lead',
  lead_contacted: 'ติดต่อ Lead', lead_status_updated: 'อัปเดตสถานะ Lead', lead_qualified: 'Lead ผ่านคุณสมบัติ',
  lead_auto_qualified: 'คัดกรอง Lead อัตโนมัติ', lead_won: 'ปิดการขาย',
  lead_interest_created: 'เพิ่มความสนใจ', interest_added: 'เพิ่มความสนใจ', interest_cancelled: 'ยกเลิกความสนใจ',
  lead_interest_updated: 'แก้ไขความสนใจ', lead_interest_deleted: 'ลบความสนใจ', lead_interest_removed: 'นำความสนใจออก',
  viewing_scheduled: 'นัดชมโครงการ', viewing_completed: 'ชมโครงการแล้ว', site_visit_confirmed: 'ยืนยันเข้าชม',
  handoff_to_sales: 'ส่งต่อให้เซลล์', contract_signed: 'เซ็นสัญญา', booking_created: 'สร้างการจอง',
  soft_reserve: 'จองชั่วคราว', unit_reserved: 'จองยูนิต', unit_assigned: 'มอบหมายยูนิต', unit_updated: 'แก้ไขยูนิต',
  payment_received: 'รับชำระเงิน', promo_applied: 'ใช้โปรโมชัน', price_updated: 'ปรับราคา',
  property_added: 'เพิ่มโครงการ', property_deleted: 'ลบโครงการ', document_uploaded: 'อัปโหลดเอกสาร',
  brochure_downloaded: 'ดาวน์โหลดโบรชัวร์',
  campaign_launched: 'ยิงแคมเปญ', campaign_updated: 'แก้ไขแคมเปญ', campaign_created: 'สร้างแคมเปญ',
  campaign_deleted: 'ลบแคมเปญ', brand_colors_updated: 'ปรับสีแบรนด์',
  tenant_created: 'สร้างบริษัท', tenant_updated: 'แก้ไขบริษัท', tenant_deleted: 'ลบบริษัท',
  tenant_suspended: 'ระงับบริษัท', tenant_activated: 'เปิดใช้บริษัท',
  subscription_renewed: 'ต่ออายุแพ็กเกจ', plan_upgraded: 'อัปเกรดแพ็กเกจ',
  user_added: 'เพิ่มผู้ใช้', user_invited: 'เชิญผู้ใช้', user_updated: 'แก้ไขผู้ใช้', user_deleted: 'ลบผู้ใช้',
  agent_invited: 'เชิญนายหน้า',
};

const CATEGORIES = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'sales', label: 'ลูกค้า / ขาย' },
  { key: 'asset', label: 'ทรัพย์สิน' },
  { key: 'marketing', label: 'การตลาด' },
  { key: 'system', label: 'ระบบ / ผู้ใช้' },
];
const categoryOf = (t: string): string => {
  if (/^(lead|interest|viewing|handoff|site_visit|contract|booking|soft_reserve|payment)/.test(t)) return 'sales';
  if (/^(property|unit|price|promo|document)/.test(t)) return 'asset';
  if (/^(campaign|brand)/.test(t)) return 'marketing';
  if (/^(tenant|user|agent|subscription|plan)/.test(t)) return 'system';
  return 'other';
};
const CAT_COLOR: Record<string, { color: string; bg: string }> = {
  sales: { color: KK.green, bg: KK.greenLight },
  asset: { color: KK.blue, bg: KK.blueLight },
  marketing: { color: KK.red, bg: KK.redLight },
  system: { color: KK.amber, bg: KK.amberLight },
  other: { color: KK.gray, bg: KK.grayLight },
};

const fmtTimeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000), hr = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
  if (min < 1) return 'เมื่อสักครู่';
  if (min < 60) return `${min} นาทีที่แล้ว`;
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  if (day < 30) return `${day} วันที่แล้ว`;
  return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
};

const THAI_MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const ymOf = (ts: string) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthLabel = (ym: string) => { const [y, mo] = ym.split('-').map(Number); return `${THAI_MONTH_FULL[mo - 1]} ${y + 543}`; };

interface LogRow {
  id: string; tenant_id: string | null; user_id: string | null;
  activity_type: string; description: string | null; created_at: string;
  metadata: any;
}

const OwnerAudit = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [tenantName, setTenantName] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [month, setMonth] = useState('all');
  const [day, setDay] = useState('all');
  const [company, setCompany] = useState('all');
  const [type, setType] = useState('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [logRes, tRes, uRes] = await Promise.all([
        supabase.from('activity_logs').select('id, tenant_id, user_id, activity_type, description, created_at, metadata').order('created_at', { ascending: false }).limit(500),
        supabase.from('tenants').select('id, name'),
        supabase.from('users').select('id, full_name'),
      ]);
      const logRows = (logRes.data || []) as LogRow[];
      setLogs(logRows);
      const tmap: Record<string, string> = {};
      (tRes.data || []).forEach((t: any) => { tmap[t.id] = t.name; });
      setTenantName(tmap);
      const umap: Record<string, string> = {};
      (uRes.data || []).forEach((u: any) => { umap[u.id] = u.full_name; });
      setUserName(umap);
      // Resolve customer names for lead/interest events that only stored a customer_id
      // (e.g. bare "ปิดการขาย") — so the audit detail shows WHO the deal was with.
      const custIds = Array.from(new Set(
        logRows.map((l) => l.metadata?.customer_id).filter(Boolean)
      )) as string[];
      if (custIds.length > 0) {
        const { data: custs } = await supabase.from('customers').select('id, full_name').in('id', custIds);
        const cmap: Record<string, string> = {};
        (custs || []).forEach((c: any) => { cmap[c.id] = c.full_name; });
        setCustomerName(cmap);
      }
    } catch (e) {
      console.error('OwnerAudit fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const monthOptions = useMemo(() => {
    if (logs.length === 0) return [];
    const yms = logs.map((l) => ymOf(l.created_at));
    const newest = yms.reduce((a, b) => (a > b ? a : b));
    const oldest = yms.reduce((a, b) => (a < b ? a : b));
    // Fill EVERY month from newest → oldest (no gaps), newest first.
    // Months with no events still appear (selecting one shows the empty state).
    const out: string[] = [];
    let [y, m] = newest.split('-').map(Number);
    const [oy, om] = oldest.split('-').map(Number);
    while (y > oy || (y === oy && m >= om)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m -= 1;
      if (m === 0) { m = 12; y -= 1; }
    }
    return out;
  }, [logs]);

  // All days of the selected month, newest first (cascade month → day). For the current
  // month, stop at today (no future days). Days with no events show the empty state.
  const dayOptions = useMemo(() => {
    if (month === 'all') return [];
    const [y, mo] = month.split('-').map(Number);
    const now = new Date();
    const last = (y === now.getFullYear() && mo === now.getMonth() + 1)
      ? now.getDate()
      : new Date(y, mo, 0).getDate();
    const out: number[] = [];
    for (let d = last; d >= 1; d--) out.push(d);
    return out;
  }, [month]);

  const companyOptions = useMemo(() => {
    const ids = Array.from(new Set(logs.map((l) => l.tenant_id).filter(Boolean))) as string[];
    return ids.map((id) => ({ id, name: tenantName[id] || 'ไม่ทราบบริษัท' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [logs, tenantName]);

  // Event types present in the data — narrowed to the selected category (cascade ใหญ่→เล็ก).
  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (cat !== 'all' && categoryOf(l.activity_type) !== cat) return;
      set.add(l.activity_type);
    });
    return Array.from(set)
      .map((t) => ({ type: t, label: TYPE_TH[t] || t }))
      .sort((a, b) => a.label.localeCompare(b.label, 'th'));
  }, [logs, cat]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (cat !== 'all' && categoryOf(l.activity_type) !== cat) return false;
      if (type !== 'all' && l.activity_type !== type) return false;
      if (company !== 'all' && l.tenant_id !== company) return false;
      if (month !== 'all' && ymOf(l.created_at) !== month) return false;
      if (day !== 'all' && new Date(l.created_at).getDate() !== Number(day)) return false;
      if (!q) return true;
      const hay = `${l.description || ''} ${TYPE_TH[l.activity_type] || l.activity_type} ${tenantName[l.tenant_id || ''] || ''} ${userName[l.user_id || ''] || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search, cat, type, company, month, day, tenantName, userName]);

  // Group big→small: platform → company → its events (เฮีย: audit ต้องจัดใหญ่ไปเล็ก ระบุบริษัท ไม่ใช่ flat ยาวเป็นพืด).
  const grouped = useMemo(() => {
    const m = new Map<string, LogRow[]>();
    filtered.forEach((l) => {
      const key = l.tenant_id || '__none__';
      const arr = m.get(key) || []; arr.push(l); m.set(key, arr);
    });
    return Array.from(m.entries())
      .map(([tid, events]) => ({
        tid,
        name: tid === '__none__' ? 'ระบบ / ไม่ระบุบริษัท' : (tenantName[tid] || 'ไม่ทราบบริษัท'),
        events: events.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        latest: events.reduce((mx, e) => Math.max(mx, new Date(e.created_at).getTime()), 0),
      }))
      .sort((a, b) => b.events.length - a.events.length || b.latest - a.latest);
  }, [filtered, tenantName]);

  // Append the customer name to events that only logged a customer_id (no name in text).
  const descOf = (l: LogRow) => {
    const base = l.description || '–';
    const cid = l.metadata?.customer_id as string | undefined;
    const cname = cid ? customerName[cid] : undefined;
    if (cname && !base.includes(cname)) return `${base} — ลูกค้า: ${cname}`;
    return base;
  };

  const stats = useMemo(() => ({
    total: logs.length,
    companies: new Set(logs.map((l) => l.tenant_id).filter(Boolean)).size,
    types: new Set(logs.map((l) => l.activity_type)).size,
  }), [logs]);

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

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                Settings
              </span>
              <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
              <p className="text-[15px] text-gray-500 mt-1.5">ประวัติการเปลี่ยนแปลงข้อมูลทั้งแพลตฟอร์ม · เพื่อความปลอดภัยและความโปร่งใส</p>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'เหตุการณ์ล่าสุด', value: stats.total, sub: 'สูงสุด 500 รายการ' },
                { label: 'บริษัทที่มีกิจกรรม', value: stats.companies, sub: 'มีเหตุการณ์' },
                { label: 'ประเภทเหตุการณ์', value: stats.types, sub: 'ที่พบ' },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <p className="text-sm font-medium text-gray-500">{s.label}</p>
                  <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight mt-2">{s.value.toLocaleString()}</p>
                  <p className="text-[13px] text-gray-400 mt-2">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Filters + table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => { setCat(c.key); setType('all'); }}
                      className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                      style={cat === c.key
                        ? { backgroundColor: KK.red, color: '#fff' }
                        : { backgroundColor: KK.grayLight, color: KK.slate }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 max-w-[200px] focus:outline-none focus:ring-2 focus:ring-red-100"
                  >
                    <option value="all">ทุกบริษัท</option>
                    {companyOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 max-w-[190px] focus:outline-none focus:ring-2 focus:ring-red-100"
                  >
                    <option value="all">ทุกประเภท</option>
                    {typeOptions.map((t) => (
                      <option key={t.type} value={t.type}>{t.label}</option>
                    ))}
                  </select>
                  <select
                    value={month}
                    onChange={(e) => { setMonth(e.target.value); setDay('all'); }}
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-100"
                  >
                    <option value="all">ทุกเดือน</option>
                    {monthOptions.map((ym) => (
                      <option key={ym} value={ym}>{monthLabel(ym)}</option>
                    ))}
                  </select>
                  {month !== 'all' && dayOptions.length > 0 && (
                    <select
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-100"
                    >
                      <option value="all">ทุกวัน</option>
                      {dayOptions.map((d) => (
                        <option key={d} value={d}>วันที่ {d}</option>
                      ))}
                    </select>
                  )}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="ค้นหา บริษัท / รายละเอียด" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
                  </div>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">ไม่พบเหตุการณ์ที่ตรงเงื่อนไข</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">เวลา</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead>รายละเอียด</TableHead>
                        <TableHead>โดย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped.map((g) => (
                        <Fragment key={g.tid}>
                          {/* Company group header (big→small) — คลิกเพื่อย่อ/ขยาย */}
                          <TableRow
                            className="bg-gray-50 hover:bg-gray-100 border-t-2 border-gray-100 cursor-pointer"
                            onClick={() => setCollapsed((prev) => { const n = new Set(prev); if (n.has(g.tid)) n.delete(g.tid); else n.add(g.tid); return n; })}
                          >
                            <TableCell colSpan={4} className="py-2.5">
                              <span className="flex items-center gap-2">
                                {collapsed.has(g.tid)
                                  ? <ChevronRight className="w-4 h-4 text-gray-400" />
                                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="font-bold text-gray-900">{g.name}</span>
                                <span className="text-xs text-gray-400">· {g.events.length} เหตุการณ์</span>
                              </span>
                            </TableCell>
                          </TableRow>
                          {!collapsed.has(g.tid) && g.events.map((l) => {
                            const c = CAT_COLOR[categoryOf(l.activity_type)];
                            return (
                              <TableRow key={l.id}>
                                <TableCell className="text-gray-500 whitespace-nowrap pl-8">
                                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-gray-400" />{fmtTimeAgo(l.created_at)}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ color: c.color, backgroundColor: c.bg }}>
                                    {TYPE_TH[l.activity_type] || l.activity_type}
                                  </span>
                                </TableCell>
                                <TableCell className="text-gray-600 max-w-[460px] truncate">{descOf(l)}</TableCell>
                                <TableCell className="text-gray-500">{userName[l.user_id || ''] || '–'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerAudit;
