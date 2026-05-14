import { useState, useEffect, useRef } from "react";
import {
  Bell, Menu, Settings, LogOut, Search, ChevronDown, Building2,
  CheckCircle2, AlertTriangle, UserPlus, Calendar, Megaphone, Users,
  Home, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { usePermissions } from "@/components/auth/PermissionGuard";
import { supabase } from "@/lib/supabase";

interface HeaderProps {
  onMenuClick: () => void;
}

type NotifType = 'approval' | 'lead' | 'trigger' | 'campaign' | 'inactive';
interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  link?: string;
}

const NOTIF_STYLES: Record<NotifType, { icon: typeof Bell; color: string; bg: string }> = {
  approval:  { icon: CheckCircle2,   color: '#10b981', bg: '#ecfdf5' },
  lead:      { icon: UserPlus,       color: '#3b82f6', bg: '#eff6ff' },
  trigger:   { icon: Megaphone,      color: '#8b5cf6', bg: '#f5f3ff' },
  campaign:  { icon: Calendar,       color: '#f59e0b', bg: '#fffbeb' },
  inactive:  { icon: AlertTriangle,  color: '#ef4444', bg: '#fef2f2' },
};

// Map activity_type → notification UI
const mapActivityToNotif = (activity_type: string, description: string): { type: NotifType; title: string; link?: string } => {
  const map: Record<string, { type: NotifType; title: string; link?: string }> = {
    lead_created:      { type: 'lead',     title: 'Lead ใหม่เข้ามา',                   link: '/leads' },
    lead_assigned:     { type: 'lead',     title: 'มอบหมาย Lead ใหม่',                  link: '/leads' },
    lead_contacted:    { type: 'lead',     title: 'ติดต่อ Lead เรียบร้อย',              link: '/leads' },
    lead_qualified:    { type: 'lead',     title: 'Lead ผ่านคุณสมบัติ',                 link: '/leads' },
    lead_won:          { type: 'approval', title: 'ปิดดีลสำเร็จ! 🎉',                  link: '/leads' },
    interest_added:    { type: 'lead',     title: 'มีคนสนใจยูนิตใหม่',                  link: '/leads' },
    viewing_scheduled: { type: 'campaign', title: 'นัดดูยูนิตใหม่',                     link: '/leads' },
    viewing_completed: { type: 'approval', title: 'พาดูยูนิตเสร็จ',                     link: '/leads' },
    soft_reserve:      { type: 'approval', title: 'จองชั่วคราวเรียบร้อย',                link: '/leads' },
    handoff_to_sales:  { type: 'lead',     title: 'Agent ส่งต่อ Lead',                  link: '/leads' },
    booking_created:   { type: 'approval', title: 'มีการจองยูนิตใหม่',                 link: '/payments' },
    payment_received:  { type: 'approval', title: 'รับเงินจองเรียบร้อย',                link: '/payments' },
    contract_signed:   { type: 'approval', title: 'เซ็นสัญญาสำเร็จ',                   link: '/payments' },
    unit_assigned:     { type: 'trigger',  title: 'มอบหมายยูนิตให้ Sales',              link: '/permissions' },
    agent_invited:     { type: 'trigger',  title: 'เชิญ Agent เข้าระบบ',                link: '/users' },
    campaign_launched: { type: 'campaign', title: 'เริ่ม Campaign การตลาด',             link: '/campaigns' },
    promo_applied:     { type: 'campaign', title: 'ใช้โปรโมชั่น',                       link: '/campaigns' },
    document_uploaded: { type: 'trigger',  title: 'อัปโหลดเอกสาร',                      link: '/settings' },
    price_updated:     { type: 'trigger',  title: 'ปรับราคายูนิต',                      link: '/properties' },
    property_added:    { type: 'trigger',  title: 'เพิ่มโครงการใหม่',                  link: '/properties' },
    user_invited:      { type: 'trigger',  title: 'เชิญผู้ใช้ใหม่',                     link: '/users' },
  };
  const found = map[activity_type] || { type: 'trigger', title: description || activity_type };
  return found;
};

const formatTimeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีก่อน`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงก่อน`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} วันก่อน`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
  return `${Math.floor(days / 30)} เดือนก่อน`;
};

// Search result types
type SearchEntity = 'lead' | 'property' | 'campaign' | 'segment';
interface SearchResult {
  id: string;
  type: SearchEntity;
  title: string;
  subtitle: string;
  link: string;
}

const ENTITY_LABEL: Record<SearchEntity, string> = {
  lead: 'Lead',
  property: 'โครงการ',
  campaign: 'Campaign',
  segment: 'Segment',
};

const ENTITY_ICON: Record<SearchEntity, typeof Bell> = {
  lead: Users,
  property: Home,
  campaign: Megaphone,
  segment: Users,
};

const Header = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, signOut, currentTenant, userRole, userProfile } = useSimpleAuth();
  const { isOwner } = usePermissions();

  // === Notifications state — fetched from activity_logs ===
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    if (!currentTenant?.id) return;
    const seenKey = `notifs_read_${currentTenant.id}`;
    const readRow = (id: string) => {
      try { return (JSON.parse(localStorage.getItem(seenKey) || '[]') as string[]).includes(id); } catch { return false; }
    };

    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('activity_logs') as any)
        .select('id, activity_type, description, created_at, metadata')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(15);
      if (cancelled) return;
      const items: NotifItem[] = ((data as any[]) || []).map((row: any) => {
        const m = mapActivityToNotif(row.activity_type, row.description);
        // If the activity carries a lead_id in metadata, deep-link to that specific lead's detail.
        const leadId = row.metadata?.lead_id;
        const link = leadId ? `/leads/${leadId}` : m.link;
        return {
          id: row.id,
          type: m.type,
          title: m.title,
          description: row.description || '',
          time: formatTimeAgo(row.created_at),
          unread: !readRow(row.id),
          link,
        };
      });
      setNotifications(items);
    })();

    // Realtime: prepend any new activity_logs row for this tenant
    const channel = supabase
      .channel(`activity_logs:${currentTenant.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `tenant_id=eq.${currentTenant.id}` },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          const m = mapActivityToNotif(row.activity_type, row.description);
          const leadId = row.metadata?.lead_id;
          const link = leadId ? `/leads/${leadId}` : m.link;
          const newItem: NotifItem = {
            id: row.id,
            type: m.type,
            title: m.title,
            description: row.description || '',
            time: formatTimeAgo(row.created_at),
            unread: !readRow(row.id),
            link,
          };
          setNotifications((prev) => {
            if (prev.some((p) => p.id === newItem.id)) return prev;
            return [newItem, ...prev].slice(0, 30);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id]);

  const persistRead = (ids: string[]) => {
    if (!currentTenant?.id) return;
    const key = `notifs_read_${currentTenant.id}`;
    try {
      const existing: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      const merged = Array.from(new Set([...existing, ...ids]));
      localStorage.setItem(key, JSON.stringify(merged));
    } catch { /* ignore */ }
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, unread: false } : n));
    persistRead([id]);
  };
  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    persistRead(allIds);
  };
  const clickNotif = (n: NotifItem) => {
    markAsRead(n.id);
    setNotifOpen(false);
    if (n.link) navigate(n.link);
  };

  // === Search state ===
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !currentTenant?.id) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const q = `%${searchQuery}%`;
        const tenantId = currentTenant.id;

        // Search across 4 entities in parallel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [campaignsRes, propertiesRes, leadsRes, segmentsRes] = await Promise.all([
          (supabase.from('campaigns') as any)
            .select('id, campaign_name, detail, status')
            .eq('tenant_id', tenantId).ilike('campaign_name', q).limit(5),
          (supabase.from('properties') as any)
            .select('id, name, type')
            .eq('tenant_id', tenantId).ilike('name', q).limit(5),
          (supabase.from('leads') as any)
            .select('id, customer_id, status, customers(full_name, email)')
            .eq('tenant_id', tenantId).limit(20),
          (supabase.from('segments') as any)
            .select('id, code, name, member_count')
            .eq('tenant_id', tenantId).ilike('name', q).limit(5),
        ]);

        const results: SearchResult[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (campaignsRes.data as any[] || []).forEach((c) => {
          results.push({ id: c.id, type: 'campaign', title: c.campaign_name, subtitle: c.status || 'campaign', link: `/campaigns/${c.id}` });
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (propertiesRes.data as any[] || []).forEach((p) => {
          results.push({ id: p.id, type: 'property', title: p.name, subtitle: p.type || 'property', link: `/properties/${p.id}` });
        });
        // Filter leads by customer name (client-side because joined query)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (leadsRes.data as any[] || []).filter((l) => {
          const name = l.customers?.full_name || '';
          const email = l.customers?.email || '';
          return name.toLowerCase().includes(searchQuery.toLowerCase()) || email.toLowerCase().includes(searchQuery.toLowerCase());
        }).slice(0, 5).forEach((l) => {
          results.push({
            id: l.id,
            type: 'lead',
            title: l.customers?.full_name || 'Unknown',
            subtitle: l.status || 'lead',
            link: `/leads/${l.id}`,
          });
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (segmentsRes.data as any[] || []).forEach((s) => {
          results.push({
            id: s.id,
            type: 'segment',
            title: s.name,
            subtitle: `${s.member_count || 0} คน · ${s.code}`,
            link: `/leads?segment=${s.code}`,
          });
        });

        setSearchResults(results);
      } catch (e) {
        console.error('Search failed:', e);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentTenant]);

  const handleResultClick = (r: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(r.link);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };

  const getUserInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  const getUserName = () => userProfile?.full_name || user?.email || "User";

  const getRoleLabel = () => {
    switch (userRole) {
      case "owner": return "เจ้าของแพลตฟอร์ม";
      case "admin": return "ผู้ดูแลบริษัท";
      case "sales": return "พนักงานขาย";
      default: return "ผู้ใช้";
    }
  };

  const getScopeLabel = () => {
    if (isOwner) return "ทั้งระบบ";
    return currentTenant?.name || "บริษัทของฉัน";
  };

  // Group search results by type
  const groupedResults = searchResults.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<SearchEntity, SearchResult[]>);

  return (
    <header className="h-[72px] bg-white border-b border-gray-100 flex items-center gap-3 px-5 lg:px-7 relative z-30">
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="lg:hidden flex-shrink-0 text-gray-500" onClick={onMenuClick}>
        <Menu className="w-5 h-5" />
      </Button>

      {/* Scope selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 h-11 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all flex-shrink-0 group">
            <Building2 className="w-4 h-4 text-chateau" />
            <span className="hidden sm:block text-sm font-medium text-gray-700">
              ขอบเขต:{" "}
              <span className="text-gray-900">{getScopeLabel()}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem className="text-sm">
            <Building2 className="w-4 h-4 mr-2 text-chateau" />
            {isOwner ? "ทั้งระบบ" : currentTenant?.name || "บริษัทของฉัน"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search bar with dropdown */}
      <div className="flex-1 min-w-0 max-w-sm lg:max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="ค้นหา leads / โครงการ / campaigns..."
            className="w-full h-11 pl-10 pr-9 rounded-xl border border-gray-200 bg-gray-50 text-[14.5px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-chateau/20 focus:border-chateau focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Search dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg max-h-[400px] overflow-y-auto z-40">
              {searchLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">กำลังค้นหา...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ไม่พบผลลัพธ์สำหรับ "{searchQuery}"</p>
                </div>
              ) : (
                <div>
                  {(Object.keys(groupedResults) as SearchEntity[]).map((entity) => {
                    const items = groupedResults[entity];
                    const Icon = ENTITY_ICON[entity];
                    return (
                      <div key={entity}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 pt-3 pb-1.5">{ENTITY_LABEL[entity]} ({items.length})</p>
                        {items.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => handleResultClick(r)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-chateau-50 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-chateau" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                              <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Notification dropdown */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-700">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[380px] p-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">การแจ้งเตือน</p>
                <p className="text-xs text-gray-500">{unreadCount} รายการใหม่</p>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-semibold text-chateau hover:underline">
                  อ่านทั้งหมด
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ไม่มีการแจ้งเตือน</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const style = NOTIF_STYLES[n.type];
                  const Icon = style.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => clickNotif(n)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-b-0 relative"
                    >
                      {n.unread && (
                        <span className="absolute right-3 top-4 w-2 h-2 bg-chateau rounded-full" />
                      )}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: style.bg }}>
                        <Icon className="w-4 h-4" style={{ color: style.color }} />
                      </div>
                      <div className="min-w-0 flex-1 pr-4">
                        <p className={`text-sm leading-snug ${n.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{n.description}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{n.time}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <button className="w-full text-xs font-semibold text-gray-600 hover:text-chateau text-center">
                ดูทั้งหมด →
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-chateau/10 border border-chateau/20 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3" }}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt={getUserName()} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold" style={{ color: "#e60023" }}>{getUserInitials()}</span>
                )}
              </div>

              <div className="hidden md:block text-left leading-tight min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate max-w-[120px]">{getUserName()}</p>
                <p className="text-xs text-gray-500 truncate max-w-[120px]">{getRoleLabel()}</p>
              </div>

              <ChevronDown className="hidden md:block w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{getUserName()}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>

            <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 cursor-pointer">
              <Settings className="w-4 h-4" />
              แก้ไขโปรไฟล์
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleSignOut}
              className="gap-2 text-red-600 hover:text-red-700 focus:text-red-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
