import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import { Zap, Plus, MoreHorizontal, Play, Pause, UserPlus, Calendar, ShoppingCart, AlertTriangle, Heart, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";

const KK = {
  red: '#e60023', redLight: '#fff1f2',
  blue: '#3b82f6', blueLight: '#eff6ff',
  purple: '#8b5cf6', purpleLight: '#f5f3ff',
  green: '#10b981', greenLight: '#ecfdf5',
  orange: '#f97316', orangeLight: '#fff7ed',
  amber: '#f59e0b', amberLight: '#fffbeb',
  gray: '#6b7280', grayLight: '#f3f4f6',
};

interface TriggerRow {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  action_type: string;
  is_active: boolean;
  fired_count: number;
}

// Map event_type → icon + color (display only, doesn't change data)
const EVENT_DISPLAY: Record<string, { icon: any; color: string; bg: string }> = {
  'lead.created':           { icon: UserPlus,        color: KK.blue,   bg: KK.blueLight },
  'customer.birthday':      { icon: Heart,           color: KK.red,    bg: KK.redLight },
  'booking.abandoned':      { icon: ShoppingCart,    color: KK.orange, bg: KK.orangeLight },
  'lead.inactive_7d':       { icon: AlertTriangle,   color: KK.amber,  bg: KK.amberLight },
  'lead.inactive_30d':      { icon: Clock,           color: KK.gray,   bg: KK.grayLight },
  'customer.anniversary':   { icon: Calendar,        color: KK.purple, bg: KK.purpleLight },
};
const getEventDisplay = (eventType: string) => EVENT_DISPLAY[eventType] || { icon: Zap, color: KK.gray, bg: KK.grayLight };

const Triggers = () => {
  const { currentTenant } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!currentTenant?.id) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('triggers')
          .select('id, name, description, event_type, action_type, is_active, fired_count')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTriggers(data || []);
      } catch (e) {
        console.error('Failed to load triggers:', e);
        setTriggers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentTenant]);

  const filtered = triggers.filter((t) =>
    filter === "all" ? true : filter === "active" ? t.is_active : !t.is_active
  );

  const totalFired = triggers.reduce((sum, t) => sum + (t.fired_count || 0), 0);
  const activeCount = triggers.filter((t) => t.is_active).length;

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-10 space-y-7">
            {/* === Page Title === */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Marketing Automation
                </span>
                <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">Triggers</h1>
                <p className="text-[15px] text-gray-500 mt-1.5">Automation rules · ส่ง LINE / Voucher อัตโนมัติเมื่อเกิด event</p>
              </div>
              <Button style={{ backgroundColor: KK.red, color: "#fff", border: "none" }} className="rounded-xl text-sm h-11 px-5">
                <Plus className="w-4 h-4 mr-1.5" /> สร้าง Trigger ใหม่
              </Button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: "Triggers ทั้งหมด",    value: triggers.length.toString(), icon: Zap,     color: KK.red,    bg: KK.redLight },
                { title: "Active",              value: activeCount.toString(),     icon: Play,    color: KK.green,  bg: KK.greenLight },
                { title: "Paused",              value: (triggers.length - activeCount).toString(), icon: Pause, color: KK.gray, bg: KK.grayLight },
                { title: "ส่งทั้งหมด (เดือนนี้)", value: totalFired.toLocaleString(), icon: UserPlus, color: KK.purple, bg: KK.purpleLight },
              ].map((kpi, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft">
                  <div className="flex items-start justify-between mb-5">
                    <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{kpi.title}</p>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
                      <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Triggers List */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
              {/* Filter tabs */}
              <div className="flex gap-1 mb-5 border-b border-gray-100 -mx-6 px-6 overflow-x-auto">
                {[
                  { value: "all",    label: "ทั้งหมด", count: triggers.length },
                  { value: "active", label: "Active",  count: activeCount },
                  { value: "paused", label: "Paused",  count: triggers.length - activeCount },
                ].map((tab) => {
                  const isActive = filter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setFilter(tab.value as any)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
                      style={{ color: isActive ? KK.red : "#6b7280", borderColor: isActive ? KK.red : "transparent" }}
                    >
                      {tab.label}
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums" style={{ backgroundColor: isActive ? KK.redLight : "#f3f4f6", color: isActive ? KK.red : "#6b7280" }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Trigger cards */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: KK.red }} />
                  <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-1">ยังไม่มี Triggers</p>
                  <p className="text-xs text-gray-400">ใช้ migration <code className="font-mono">20260424000003_seed_marketing_demo_data.sql</code> เพื่อใส่ข้อมูลตัวอย่าง</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filtered.map((trigger) => {
                    const display = getEventDisplay(trigger.event_type);
                    const Icon = display.icon;
                    return (
                      <div key={trigger.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-soft-md transition-all">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: display.bg }}>
                              <Icon className="w-5 h-5" style={{ color: display.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-bold text-gray-900 truncate">{trigger.name}</h3>
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: trigger.is_active ? KK.greenLight : KK.grayLight, color: trigger.is_active ? "#047857" : KK.gray }}>
                                  {trigger.is_active ? "ACTIVE" : "PAUSED"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1">{trigger.description}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono pt-3 border-t border-gray-50">
                          <span className="px-2 py-1 rounded" style={{ backgroundColor: KK.grayLight, color: KK.gray }}>{trigger.event_type}</span>
                          <span className="text-gray-300">→</span>
                          <span className="px-2 py-1 rounded font-semibold" style={{ backgroundColor: display.bg, color: display.color }}>{trigger.action_type}</span>
                          <span className="ml-auto text-xs text-gray-500 tabular-nums">{(trigger.fired_count || 0).toLocaleString()} ครั้ง</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default Triggers;
