import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Shield, Search, Clock } from 'lucide-react';

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

interface LogRow {
  id: string; tenant_id: string | null; user_id: string | null;
  activity_type: string; description: string | null; created_at: string;
}

const OwnerAudit = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [tenantName, setTenantName] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [logRes, tRes, uRes] = await Promise.all([
        supabase.from('activity_logs').select('id, tenant_id, user_id, activity_type, description, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('tenants').select('id, name'),
        supabase.from('users').select('id, full_name'),
      ]);
      setLogs((logRes.data || []) as LogRow[]);
      const tmap: Record<string, string> = {};
      (tRes.data || []).forEach((t: any) => { tmap[t.id] = t.name; });
      setTenantName(tmap);
      const umap: Record<string, string> = {};
      (uRes.data || []).forEach((u: any) => { umap[u.id] = u.full_name; });
      setUserName(umap);
    } catch (e) {
      console.error('OwnerAudit fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (cat !== 'all' && categoryOf(l.activity_type) !== cat) return false;
      if (!q) return true;
      const hay = `${l.description || ''} ${TYPE_TH[l.activity_type] || l.activity_type} ${tenantName[l.tenant_id || ''] || ''} ${userName[l.user_id || ''] || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search, cat, tenantName, userName]);

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
                { label: 'เหตุการณ์ล่าสุด', value: stats.total, sub: 'สูงสุด 200 รายการ' },
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
                      onClick={() => setCat(c.key)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                      style={cat === c.key
                        ? { backgroundColor: KK.red, color: '#fff' }
                        : { backgroundColor: KK.grayLight, color: KK.slate }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="ค้นหา บริษัท / รายละเอียด" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
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
                        <TableHead>บริษัท</TableHead>
                        <TableHead>รายละเอียด</TableHead>
                        <TableHead>โดย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((l) => {
                        const c = CAT_COLOR[categoryOf(l.activity_type)];
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="text-gray-500 whitespace-nowrap">
                              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-gray-400" />{fmtTimeAgo(l.created_at)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ color: c.color, backgroundColor: c.bg }}>
                                {TYPE_TH[l.activity_type] || l.activity_type}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-700">{tenantName[l.tenant_id || ''] || '–'}</TableCell>
                            <TableCell className="text-gray-600 max-w-[360px] truncate">{l.description || '–'}</TableCell>
                            <TableCell className="text-gray-500">{userName[l.user_id || ''] || '–'}</TableCell>
                          </TableRow>
                        );
                      })}
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
