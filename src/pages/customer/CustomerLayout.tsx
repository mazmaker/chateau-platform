import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Building2, User, ArrowLeft, LogOut, FileText, Bell, Heart, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CustomerLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  hideHeader?: boolean;
}

interface NotifItem {
  id: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

const CustomerLayout = ({ children, title, subtitle, showBack = false, backTo, hideHeader = false }: CustomerLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ full_name: string | null; initials: string } | null>(null);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cust } = await (supabase.from('customers') as any)
        .select('id, full_name').eq('auth_user_id', user.id).maybeSingle();
      if (!cust) return;
      const name = (cust as any).full_name || 'ลูกค้า';
      setProfile({
        full_name: name,
        initials: name.replace(/^คุณ\s*/, '').slice(0, 2).toUpperCase(),
      });

      // Build notifications from real customer data
      const items: NotifItem[] = [];
      // 1. Recent bookings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bookings } = await (supabase.from('bookings') as any)
        .select('id, status, created_at, notes, property:properties(name)')
        .eq('customer_id', (cust as any).id)
        .order('created_at', { ascending: false }).limit(3);
      ((bookings as any[]) || []).forEach((b: any) => {
        if (b.status === 'confirmed') {
          items.push({
            id: 'b-' + b.id,
            icon: CheckCircle2, iconColor: 'text-green-600', iconBg: 'bg-green-50',
            title: 'จองสำเร็จ! รอเซ็นสัญญา',
            description: `${b.property?.name || ''} · ยูนิต ${b.notes?.unit_number || '-'}`,
            time: timeAgo(b.created_at), unread: true,
          });
        } else if (b.status === 'pending') {
          items.push({
            id: 'b-' + b.id,
            icon: Calendar, iconColor: 'text-amber-600', iconBg: 'bg-amber-50',
            title: 'รอชำระเงินจอง',
            description: `${b.property?.name || ''} · ยูนิต ${b.notes?.unit_number || '-'}`,
            time: timeAgo(b.created_at), unread: true,
          });
        }
      });

      // 2. Recent interests with viewing_date
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: leads } = await (supabase.from('leads') as any)
        .select('id').eq('customer_id', (cust as any).id);
      const leadIds = ((leads as any[]) || []).map((l: any) => l.id);
      if (leadIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: visits } = await (supabase.from('lead_interests') as any)
          .select('id, viewing_date, unit:units(unit_number), property:properties(name)')
          .in('lead_id', leadIds).not('viewing_date', 'is', null)
          .gte('viewing_date', new Date().toISOString())
          .order('viewing_date', { ascending: true }).limit(2);
        ((visits as any[]) || []).forEach((v: any) => {
          items.push({
            id: 'v-' + v.id,
            icon: Calendar, iconColor: 'text-amber-600', iconBg: 'bg-amber-50',
            title: 'นัดดูยูนิตที่กำลังจะถึง',
            description: `${v.property?.name || ''} · ยูนิต ${v.unit?.unit_number || '-'} · ${new Date(v.viewing_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
            time: timeAgo(v.viewing_date), unread: true,
          });
        });
      }

      // 3. Welcome (always shown)
      items.push({
        id: 'welcome',
        icon: Sparkles, iconColor: 'text-rose-600', iconBg: 'bg-rose-50',
        title: 'ยินดีต้อนรับสู่ CHATEAU',
        description: 'ดูยูนิตใหม่ๆ และเก็บไว้ดูทีหลังได้ที่ "ยูนิตที่สนใจ"',
        time: 'วันนี้', unread: false,
      });

      setNotifs(items);
    })();
  }, []);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 0) return 'อีกไม่นาน';
    if (mins < 60) return `${mins} นาทีก่อน`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงก่อน`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} วันก่อน`;
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  }

  const unreadCount = notifs.filter((n) => n.unread).length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/customer/login', { replace: true });
  };

  const isActive = (href: string) => {
    if (href === '/customer') return location.pathname === '/customer';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-white">
      {!hideHeader && (
        <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
          <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center justify-between">
            {showBack ? (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                  className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-lg text-gray-700"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate">{title || 'ย้อนกลับ'}</p>
                  {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-chateau text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {profile?.initials || 'C'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    สวัสดี, {profile?.full_name?.replace(/^คุณ\s*/, '').split(' ')[0] || 'คุณลูกค้า'}
                  </p>
                  <p className="text-xs text-gray-500">CHATEAU — Customer Portal</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              {!showBack && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-700">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-chateau text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[340px] p-0">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">การแจ้งเตือน</p>
                      <p className="text-xs text-gray-500">{unreadCount} รายการใหม่</p>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifs.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">ไม่มีการแจ้งเตือน</p>
                        </div>
                      ) : (
                        notifs.map((n) => (
                          <div key={n.id} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 relative">
                            {n.unread && (
                              <span className="absolute right-3 top-4 w-2 h-2 bg-chateau rounded-full" />
                            )}
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${n.iconBg}`}>
                              <n.icon className={`w-4 h-4 ${n.iconColor}`} />
                            </div>
                            <div className="min-w-0 flex-1 pr-4">
                              <p className={`text-sm leading-snug ${n.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{n.description}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{n.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-2xl mx-auto px-5 py-5 space-y-5 pb-28">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          <NavBtn icon={Home} label="หน้าหลัก" active={isActive('/customer') && location.pathname === '/customer'} onClick={() => navigate('/customer')} />
          <NavBtn icon={Building2} label="โครงการ" active={isActive('/customer/properties')} onClick={() => navigate('/customer/properties')} />
          <NavBtn icon={FileText} label="การจอง" active={isActive('/customer/bookings') || isActive('/customer/payments')} onClick={() => navigate('/customer/bookings')} />
          <NavBtn icon={User} label="โปรไฟล์" active={isActive('/customer/profile')} onClick={() => navigate('/customer/profile')} />
        </div>
      </nav>
    </div>
  );
};

const NavBtn = ({ icon: Icon, label, active, onClick, disabled }: {
  icon: any; label: string; active: boolean; onClick: () => void; disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`py-3 flex flex-col items-center gap-1 transition-colors ${
      disabled
        ? 'text-gray-300 cursor-not-allowed'
        : active
        ? 'text-chateau'
        : 'text-gray-500 hover:text-gray-900'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'fill-rose-50' : ''}`} strokeWidth={active ? 2.5 : 2} />
    <span className={`text-[11px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
  </button>
);

export default CustomerLayout;
