import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import { supabase } from "@/lib/supabase";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft, Send, Eye, MousePointerClick, TrendingUp, Calendar, Clock,
  Edit, Copy, Trash2, Loader2, AlertCircle, Users,
  Target, FileSignature, CheckCircle2, Bell,
} from "lucide-react";

const KK = {
  red: '#e60023', redLight: '#fff1f2', redBorder: '#fecdd3',
  blue: '#3b82f6', blueLight: '#eff6ff',
  purple: '#8b5cf6', purpleLight: '#f5f3ff',
  green: '#10b981', greenLight: '#ecfdf5',
  orange: '#f97316', orangeLight: '#fff7ed',
  amber: '#f59e0b', amberLight: '#fffbeb',
  gray: '#6b7280', grayLight: '#f3f4f6',
};

interface Campaign {
  id: string;
  campaign_code: string;
  campaign_name: string;
  detail: string | null;
  image_url: string | null;
  status: string;
  start_date: string;
  end_date: string;
  frequency: string;
  segments: string[] | null;
  activities: string[] | null;
  recipients_count: number;
  impressions_count: number;
  clicks_count: number;
  ctr: number;
  created_at: string;
  // marketing extension columns
  headline?: string;
  message_body?: string;
  cta_text?: string;
  cta_url?: string;
  template?: string;
  campaign_type?: string;
  scheduled_at?: string;
  approval_status?: string;
  approved_at?: string;
}

interface RecipientSample {
  full_name: string;
  status: string;
  opened: boolean;
  clicked: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: '#f3f4f6' },
  active:    { label: 'Active',    color: '#047857', bg: '#ecfdf5' },
  paused:    { label: 'Scheduled', color: '#d97706', bg: '#fffbeb' },
  completed: { label: 'Ended',     color: '#374151', bg: '#f3f4f6' },
  pending_approval: { label: 'Pending Approval', color: '#7c3aed', bg: '#f5f3ff' },
};

const formatDate = (d: string | null | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
};
const formatDateTime = (d: string | null | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientSample[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setCampaign(data as Campaign);

        // Load sample recipients (real lead names — random sample)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leads } = await (supabase.from('leads') as any)
          .select('id, status, customers(full_name)')
          .limit(8);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sampled: RecipientSample[] = ((leads as any[]) || []).map((l, i) => ({
          full_name: l.customers?.full_name || `Lead ${i + 1}`,
          status: l.status || 'new',
          opened: i < 5,
          clicked: i < 3,
        }));
        setRecipients(sampled);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'โหลดไม่สำเร็จ';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Mock trend chart data (last 7 days)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const base = (campaign?.recipients_count || 1000) / 7;
    return {
      date: `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate()}`,
      opened: Math.round(base * 0.85 * (0.8 + Math.random() * 0.4)),
      clicked: Math.round(base * 0.4 * (0.8 + Math.random() * 0.4)),
    };
  });

  if (loading) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: KK.red }} />
            <p className="text-sm text-gray-500 mt-3">กำลังโหลดข้อมูล campaign...</p>
          </div>
        </div>
      </AdminGuard>
    );
  }

  if (error || !campaign) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 mx-auto" style={{ color: KK.red }} />
            <h2 className="text-lg font-bold text-gray-900 mt-4">ไม่พบ Campaign</h2>
            <p className="text-sm text-gray-500 mt-1">{error || 'ID นี้ไม่ตรงกับ campaign ในระบบ'}</p>
            <button
              onClick={() => navigate('/campaigns')}
              className="mt-4 px-4 h-10 rounded-xl font-semibold text-white"
              style={{ backgroundColor: KK.red }}
            >
              ← กลับไปที่รายการ
            </button>
          </div>
        </div>
      </AdminGuard>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const sent = campaign.recipients_count || 0;
  const delivered = Math.round(sent * 0.98);
  const opened = campaign.impressions_count || Math.round(sent * 0.85);
  const clicked = campaign.clicks_count || Math.round(sent * (campaign.ctr || 22) / 100);
  // Click-to-close conversion ~0.5% — industry standard for real estate
  const converted = Math.round(clicked * 0.005);
  const revenue = converted * 4500000; // estimated avg deal value

  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0';
  const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0';
  const convRate = clicked > 0 ? ((converted / clicked) * 100).toFixed(1) : '0.0';

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-10 space-y-6">
            {/* Breadcrumb */}
            <button
              onClick={() => navigate('/campaigns')}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับไปที่ Campaigns
            </button>

            {/* === Hero Section === */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden">
              <div className="relative h-56 bg-gray-100">
                {campaign.image_url ? (
                  <img src={campaign.image_url} alt={campaign.campaign_name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #ff6b8a 0%, #e60023 100%)' }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-5 right-5 flex gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: statusCfg.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusCfg.color }} />
                    {statusCfg.label}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-white/70 text-xs font-mono mb-1">{campaign.campaign_code}</p>
                  <h1 className="text-white text-2xl font-bold leading-tight drop-shadow-lg">{campaign.campaign_name}</h1>
                  {campaign.detail && (
                    <p className="text-white/85 text-sm mt-1.5 line-clamp-2 max-w-2xl">{campaign.detail}</p>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(campaign.start_date)} → {formatDate(campaign.end_date)}
                  </span>
                  {campaign.scheduled_at && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      ส่ง: {formatDateTime(campaign.scheduled_at)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    <Edit className="w-3.5 h-3.5" /> แก้ไข
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: KK.red }}>
                    <Trash2 className="w-3.5 h-3.5" /> ลบ
                  </button>
                </div>
              </div>
            </div>

            {/* === KPI Cards === */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Sent',      value: sent.toLocaleString(),       sub: '100%',           icon: Send,             color: KK.red,    bg: KK.redLight },
                { label: 'Delivered', value: delivered.toLocaleString(),  sub: '98.0%',          icon: CheckCircle2,     color: KK.green,  bg: KK.greenLight },
                { label: 'Opened',    value: opened.toLocaleString(),     sub: `${openRate}%`,   icon: Eye,              color: KK.blue,   bg: KK.blueLight },
                { label: 'Clicked',   value: clicked.toLocaleString(),    sub: `${clickRate}%`,  icon: MousePointerClick, color: KK.purple, bg: KK.purpleLight },
                { label: 'Converted', value: converted.toLocaleString(),  sub: `${convRate}%`,   icon: Target,           color: KK.amber,  bg: KK.amberLight },
              ].map((kpi, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-soft">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                      <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums">{kpi.value}</p>
                  <p className="text-xs font-semibold mt-1.5" style={{ color: kpi.color }}>{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* === Revenue Estimate === */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: KK.red }}>Estimated Revenue Generated</p>
                <p className="text-3xl font-bold text-gray-900 tabular-nums mt-1">฿{revenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{converted} conversions × avg ฿4,500,000 deal value</p>
              </div>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: KK.greenLight }}>
                <TrendingUp className="w-6 h-6" style={{ color: KK.green }} />
              </div>
            </div>

            {/* === Row: Trend chart + LINE Preview === */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Trend chart 2/3 */}
              <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Performance Over Time</h2>
                    <p className="text-xs text-gray-500 mt-0.5">7 วันล่าสุด · Open vs Click</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>7 วัน</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="openedGradD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KK.blue} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={KK.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="clickedGradD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KK.purple} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={KK.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Area type="monotone" dataKey="opened"  stroke={KK.blue}   strokeWidth={2.5} fill="url(#openedGradD)"  dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="clicked" stroke={KK.purple} strokeWidth={2.5} fill="url(#clickedGradD)" dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-5 mt-3 pl-2">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.blue }} /><span className="text-xs text-gray-600">Opened</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.purple }} /><span className="text-xs text-gray-600">Clicked</span></div>
                </div>
              </div>

              {/* Channel previews 1/3 — LINE + WhatsApp stacked near each other */}
              <div className="space-y-6">
              {/* LINE Preview */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-bold text-gray-900">LINE Message</h2>
                  {campaign.template && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                      {campaign.template}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-4">ข้อความที่ลูกค้าได้รับ</p>
                <div className="rounded-xl p-3.5" style={{ backgroundColor: "#3a4858" }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: KK.green }}>C</div>
                    <div>
                      <p className="text-white text-xs font-semibold leading-tight">CHATEAU</p>
                      <p className="text-white/60 text-[10px]">Official Account</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl overflow-hidden">
                    {campaign.image_url && (
                      <div className="h-24 bg-gray-100 relative">
                        <img src={campaign.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-xs font-bold text-gray-900 leading-snug">{campaign.headline || campaign.campaign_name}</p>
                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed line-clamp-3">{campaign.message_body || campaign.detail || '-'}</p>
                      {campaign.cta_text && (
                        <button className="w-full mt-2 py-1.5 rounded-md text-[11px] font-semibold text-white" style={{ backgroundColor: KK.red }}>
                          {campaign.cta_text} →
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-white/50 text-[9px] text-right mt-1">อ่านแล้ว</p>
                </div>
              </div>

              {/* WhatsApp Preview (mockup) — same campaign data, WhatsApp-template style.
                  Note: this is illustrative only; real WhatsApp sends need an approved template. */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-bold text-gray-900">WhatsApp Message</h2>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded text-white" style={{ backgroundColor: "#25D366" }}>
                    Template
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">ตัวอย่าง mockup · ต้องเป็น template ที่ Meta อนุมัติ</p>
                {/* WhatsApp chat wallpaper */}
                <div className="rounded-xl p-3.5" style={{ backgroundColor: "#e5ddd5" }}>
                  {/* received-message bubble */}
                  <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-2.5 pt-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px]" style={{ backgroundColor: "#25D366" }}>C</div>
                      <p className="text-[11px] font-semibold text-gray-900 leading-tight">
                        CHATEAU Property <span style={{ color: "#34b7f1" }}>✓</span>
                      </p>
                    </div>
                    {campaign.image_url && (
                      <div className="h-24 bg-gray-100 relative m-1.5 rounded-lg overflow-hidden">
                        <img src={campaign.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="px-2.5 pb-1.5 pt-1">
                      <p className="text-[11px] font-bold text-gray-900 leading-snug">{campaign.headline || campaign.campaign_name}</p>
                      <p className="text-[11px] text-gray-700 mt-1 leading-relaxed line-clamp-3">{campaign.message_body || campaign.detail || '-'}</p>
                      {/* mandatory opt-out footer (WhatsApp + PDPA) */}
                      <p className="text-[9px] text-gray-400 mt-1.5 italic">CHATEAU Property · ตอบ STOP เพื่อยกเลิก</p>
                      <p className="text-[8px] text-gray-400 text-right mt-0.5">10:30 <span style={{ color: "#34b7f1" }}>✓✓</span></p>
                    </div>
                    {/* WhatsApp CTA button — separated, blue, full-width */}
                    {campaign.cta_text && (
                      <div className="border-t border-gray-100">
                        <button className="w-full py-1.5 text-[11px] font-semibold" style={{ color: "#027eb5" }}>
                          {campaign.cta_text}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* === Conversion Funnel === */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
              <h2 className="text-base font-bold text-gray-900">Conversion Funnel</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-5">เส้นทางจากการส่งจนถึงการปิดดีล</p>
              <div className="space-y-3">
                {[
                  { label: 'Sent',      value: sent,      color: KK.red,    pct: 100 },
                  { label: 'Delivered', value: delivered, color: KK.green,  pct: (delivered/sent)*100 },
                  { label: 'Opened',    value: opened,    color: KK.blue,   pct: (opened/sent)*100 },
                  { label: 'Clicked',   value: clicked,   color: KK.purple, pct: (clicked/sent)*100 },
                  { label: 'Converted', value: converted, color: KK.amber,  pct: (converted/sent)*100 },
                ].map((step, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5 text-sm">
                      <span className="font-semibold text-gray-700">{step.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 tabular-nums">{step.pct.toFixed(1)}%</span>
                        <span className="font-bold tabular-nums" style={{ color: step.color }}>{step.value.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${step.pct}%`, backgroundColor: step.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* === Row: Recipients + Timeline === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recipients sample */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Recipients ตัวอย่าง</h2>
                    <p className="text-xs text-gray-500 mt-0.5">สุ่ม 8 คนจาก {sent.toLocaleString()} ราย</p>
                  </div>
                  <Users className="w-5 h-5 text-gray-300" />
                </div>
                {recipients.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูล recipient</p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-chateau-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-chateau">{r.full_name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.full_name}</p>
                            <p className="text-[11px] text-gray-500">{r.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {r.opened ? (
                            <span title="Opened" className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: KK.blue, backgroundColor: KK.blueLight }}>
                              <Eye className="w-3 h-3" /> Opened
                            </span>
                          ) : null}
                          {r.clicked ? (
                            <span title="Clicked" className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: KK.purple, backgroundColor: KK.purpleLight }}>
                              <MousePointerClick className="w-3 h-3" /> Clicked
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <h2 className="text-base font-bold text-gray-900">Timeline</h2>
                <p className="text-xs text-gray-500 mt-0.5 mb-5">ประวัติของ campaign นี้</p>
                <div className="space-y-4 relative">
                  <div className="absolute left-[15px] top-1 bottom-1 w-px bg-gray-200" />
                  {[
                    { icon: FileSignature, color: KK.gray,   label: 'สร้าง campaign',    time: formatDateTime(campaign.created_at) },
                    campaign.approval_status === 'approved' && { icon: CheckCircle2, color: KK.green,  label: 'ได้รับการอนุมัติ', time: formatDateTime(campaign.approved_at) },
                    campaign.scheduled_at && { icon: Clock,       color: KK.amber,  label: 'กำหนดส่ง',     time: formatDateTime(campaign.scheduled_at) },
                    campaign.status === 'active' && { icon: Send,        color: KK.red,    label: 'เริ่มส่ง',         time: formatDateTime(campaign.start_date) },
                    campaign.status === 'completed' && { icon: CheckCircle2, color: KK.green, label: 'สิ้นสุด',         time: formatDateTime(campaign.end_date) },
                  ].filter(Boolean).map((item, i) => {
                    const it = item as { icon: typeof Bell; color: string; label: string; time: string };
                    const Icon = it.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 relative">
                        <div className="w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center flex-shrink-0 z-10" style={{ borderColor: it.color }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: it.color }} />
                        </div>
                        <div className="pt-1">
                          <p className="text-sm font-semibold text-gray-900">{it.label}</p>
                          <p className="text-xs text-gray-500">{it.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* === Targeting & Settings === */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Targeting &amp; Settings</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Type</p>
                  <p className="font-semibold text-gray-900 capitalize">{campaign.campaign_type || 'newsletter'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Frequency</p>
                  <p className="font-semibold text-gray-900 capitalize">{campaign.frequency || '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Template</p>
                  <p className="font-semibold text-gray-900 capitalize">{campaign.template || 'bubble'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Approval</p>
                  <p className="font-semibold text-gray-900 capitalize">{campaign.approval_status || '-'}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Segments ({(campaign.segments || []).length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(campaign.segments || []).map((s, i) => (
                      <span key={i} className="text-xs font-semibold px-2 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>{s}</span>
                    ))}
                    {(campaign.segments || []).length === 0 && <span className="text-xs text-gray-400">ไม่มี segment</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-400 mb-2">CTA URL</p>
                  {campaign.cta_url ? (
                    <a href={campaign.cta_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">{campaign.cta_url}</a>
                  ) : (
                    <span className="text-xs text-gray-400">ไม่มี URL</span>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default CampaignDetail;
