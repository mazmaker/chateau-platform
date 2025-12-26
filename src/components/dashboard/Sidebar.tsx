import {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  UserCog,
  Megaphone,
  Settings,
  LogOut,
  Castle,
  Crown,
  Shield,
  Briefcase,
  CreditCard,
  FileText,
  Palette,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate, useLocation } from "react-router-dom";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { AdminGuard, SalesGuard, OwnerGuard, usePermissions } from "@/components/auth/PermissionGuard";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  isLogout?: boolean;
  requiredRoles?: string[];
}

const getAllNavItems = (): NavItem[] => [
  { icon: LayoutDashboard, label: "ภาพรวม", href: "/" },
  // Owner-only SaaS features
  { icon: TrendingUp, label: "Owner Dashboard", href: "/owner", requiredRoles: ["OWNER"] },
  { icon: Building2, label: "จัดการบริษัท", href: "/tenants", requiredRoles: ["OWNER"] },
  { icon: CreditCard, label: "Billing & Invoices", href: "/billing", requiredRoles: ["OWNER"] },
  // Company features
  { icon: Building2, label: "โครงการ & ยูนิต", href: "/properties", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  { icon: FileText, label: "ระบบ Leads", href: "/leads", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  { icon: Users, label: "ลูกค้า", href: "/customers", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  // Admin features
  { icon: Users, label: "จัดการผู้ใช้", href: "/users", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Palette, label: "ปรับแต่งระบบ", href: "/customization", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Settings, label: "ตั้งค่า", href: "/settings", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: LogOut, label: "ออกจากระบบ", href: "/logout", isLogout: true },
];

const getRoleIcon = (userRole: string | null) => {
  switch (userRole) {
    case 'owner':
      return <Crown className="w-4 h-4 text-yellow-600" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-blue-600" />;
    case 'sales':
      return <Briefcase className="w-4 h-4 text-green-600" />;
    default:
      return <Users className="w-4 h-4 text-gray-600" />;
  }
};

const getRoleLabel = (userRole: string | null) => {
  switch (userRole) {
    case 'owner': return 'เจ้าของแพลตฟอร์ม';
    case 'admin': return 'ผู้ดูแลบริษัท';
    case 'sales': return 'พนักงานขาย';
    default: return 'ผู้ใช้';
  }
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, currentTenant, userRole } = useSimpleAuth();
  const { isOwner, isAdmin, isSales } = usePermissions();

  const handleNavClick = async (item: NavItem) => {
    if (item.isLogout) {
      await signOut();
      navigate('/auth/login');
    } else {
      navigate(item.href);
      onClose();
    }
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  const getUserInitials = () => {
    if ((user as any)?.user_metadata?.full_name) {
      return (user as any).user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    return user?.email?.split('@')[0].toUpperCase() || 'U';
  };

  const getUserName = () => {
    return (user as any)?.user_metadata?.full_name || user?.email || 'User';
  };

  const getFilteredNavItems = (): NavItem[] => {
    const allItems = getAllNavItems();
    return allItems.filter(item => {
      if (!item.requiredRoles) return true;
      return item.requiredRoles.includes(userRole?.toUpperCase() || '');
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-[260px] bg-card border-r border-border z-50",
          "flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Castle className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <span className="text-xl font-bold gradient-primary-text">CHATEAU</span>
              {currentTenant && (
                <p className="text-xs text-muted-foreground truncate">{currentTenant.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="p-4">
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="gradient-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{getUserName()}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole || 'User'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Role-Based Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {getFilteredNavItems().map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                "hover:bg-secondary group text-left relative",
                isActive(item.href) && !item.isLogout && "gradient-primary text-primary-foreground shadow-lg",
                item.isLogout && "hover:bg-red-50 hover:text-red-600"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-colors",
                isActive(item.href) && !item.isLogout ? "text-primary-foreground" :
                item.isLogout ? "text-muted-foreground group-hover:text-red-600" :
                "text-muted-foreground group-hover:text-foreground"
              )} />
              <span className={cn(
                "font-medium",
                !isActive(item.href) && !item.isLogout && "text-muted-foreground group-hover:text-foreground",
                item.isLogout && "text-muted-foreground group-hover:text-red-600"
              )}>
                {item.label}
              </span>
              {/* Role indicators */}
              {item.requiredRoles && (
                <div className="ml-auto flex items-center gap-1">
                  {isSales && <Briefcase className="w-4 h-4 text-green-500 opacity-60" />}
                  {isAdmin && <Shield className="w-4 h-4 text-blue-500 opacity-60" />}
                  {isOwner && <Crown className="w-4 h-4 text-yellow-500 opacity-60" />}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Role Info Banner */}
        <div className="p-4 border-t border-border">
          <div className={cn(
            "rounded-lg p-3 text-xs",
            isOwner && "bg-yellow-50 border border-yellow-200 text-yellow-800",
            isAdmin && "bg-blue-50 border border-blue-200 text-blue-800",
            isSales && "bg-green-50 border border-green-200 text-green-800"
          )}>
            <div className="flex items-center gap-2 font-medium mb-1">
              {getRoleIcon(userRole)}
              <span>สิทธิ์: {getRoleLabel(userRole)}</span>
            </div>
            <div className="space-y-1">
              {isSales && <p>• จัดการลูกค้าและ Leads</p>}
              {isAdmin && <p>• จัดการบริษัท, โครงการ, ผู้ใช้</p>}
              {isOwner && <p>• จัดการทั้งระบบ SaaS, Billing, Tenants</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            © 2024 Chateau PropTech
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
