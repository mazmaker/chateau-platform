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
  TrendingUp,
  BarChart3,
  Key,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { AdminGuard, SalesGuard, OwnerGuard, usePermissions } from "@/components/auth/PermissionGuard";
import { useSubscriptionFeatures } from "@/hooks/useSubscriptionFeatures";
import { CompanyLogo } from "@/components/company/CompanyLogo";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  isLogout?: boolean;
  requiredRoles?: string[];
  requiredFeature?: string;
  isPremium?: boolean;
}

const getAllNavItems = (): NavItem[] => [
  { icon: LayoutDashboard, label: "ภาพรวม", href: "/" },
  // Owner-only SaaS features
  { icon: TrendingUp, label: "Owner Dashboard", href: "/owner", requiredRoles: ["OWNER"] },
  { icon: Building2, label: "จัดการบริษัท", href: "/tenants", requiredRoles: ["OWNER"] },
  { icon: CreditCard, label: "จัดการการชำระเงิน", href: "/payments", requiredRoles: ["OWNER"] },
  // Company features
  { icon: Building2, label: "โครงการ", href: "/properties", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  // Premium subscription features
  { icon: BarChart3, label: "รายงานวิเคราะห์", href: "/analytics", requiredRoles: ["OWNER", "ADMIN"], requiredFeature: "analytics", isPremium: true },
  { icon: Key, label: "การจัดการ API", href: "/api", requiredRoles: ["OWNER", "ADMIN"], requiredFeature: "api_access", isPremium: true },
  // Admin features
  { icon: Users, label: "จัดการผู้ใช้", href: "/users", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: FileText, label: "Leads", href: "/leads", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  { icon: Megaphone, label: "แคมเปญ", href: "/campaigns", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Palette, label: "ปรับแต่งระบบ", href: "/customization", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Settings, label: "การตั้งค่า", href: "/settings", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
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
  const { user, signOut, currentTenant, userRole, userProfile } = useSimpleAuth();
  const { isOwner, isAdmin, isSales } = usePermissions();
  const { hasFeature, currentPlan } = useSubscriptionFeatures();

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
    if (userProfile?.full_name) {
      return userProfile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    return user?.email?.split('@')[0].toUpperCase() || 'U';
  };

  const getUserName = () => {
    return userProfile?.full_name || user?.email || 'User';
  };

  const getFilteredNavItems = (): NavItem[] => {
    const allItems = getAllNavItems();
    return allItems
      .filter(item => {
        // Check role-based permissions
        if (item.requiredRoles && !item.requiredRoles.includes(userRole?.toUpperCase() || '')) {
          return false;
        }

        // Check subscription-based permissions
        if (item.requiredFeature && !hasFeature(item.requiredFeature)) {
          // For owner role, always show premium features (they can see upgrade prompts)
          if (isOwner) {
            return true;
          }
          return false;
        }

        return true;
      })
      .map(item => {
        // ADMIN sees "พนักงานขาย" instead of "จัดการผู้ใช้"
        if (item.href === '/users' && isAdmin && !isOwner) {
          return { ...item, label: 'พนักงานขาย' };
        }
        return item;
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
          "fixed left-0 top-0 h-full w-[260px] bg-luxury-white border-r border-border z-50",
          "flex flex-col transition-transform duration-300 ease-in-out",
          "shadow-soft-lg backdrop-blur-sm",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border bg-luxury-white">
          <div className="flex items-center gap-3">
            {/* Company Logo */}
            <CompanyLogo size="2xl" />

            <div>
              <h1 className="text-xl font-bold text-charcoal">CHATEAU</h1>
              <p className="text-xs text-luxury-gray truncate font-medium">PLATFORM</p>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="p-4">
          <div className="gradient-card rounded-xl p-4 gradient-card-hover">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden gradient-charcoal flex items-center justify-center shadow-soft">
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt={getUserName()} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-luxury-white text-sm font-semibold ">
                      {getUserInitials()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-charcoal truncate ">{getUserName()}</p>
                <p className="text-xs text-luxury-gray capitalize ">{userRole || 'User'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Role-Based Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto bg-luxury-white rounded-xl mx-4 my-2 shadow-soft">
          {getFilteredNavItems().map((item) => {
            const hasRequiredFeature = item.requiredFeature ? hasFeature(item.requiredFeature) : true;
            const isLocked = item.requiredFeature && !hasRequiredFeature;

            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ",
                  "hover:bg-muted group text-left relative",
                  isActive(item.href) && !item.isLogout && "gradient-card shadow-soft bg-royal-gold/5 border border-royal-gold/20",
                  !isActive(item.href) && !item.isLogout && "text-luxury-gray group-hover:text-charcoal",
                  item.isLogout && "text-luxury-gray group-hover:text-red-600",
                  isLocked && "opacity-75"
                )}
                disabled={isLocked}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-colors",
                  isActive(item.href) && !item.isLogout && "text-royal-gold",
                  !isActive(item.href) && !item.isLogout && "text-luxury-gray group-hover:text-charcoal",
                  item.isLogout && "text-luxury-gray group-hover:text-red-600",
                  isLocked && "text-amber-600"
                )} />
                <span className={cn(
                  "font-medium flex-1",
                  isActive(item.href) && !item.isLogout && "text-charcoal font-semibold",
                  !isActive(item.href) && !item.isLogout && "text-luxury-gray group-hover:text-charcoal",
                  item.isLogout && "text-luxury-gray group-hover:text-red-600",
                  isLocked && "text-amber-700"
                )}>
                  {item.label}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  {/* Premium feature indicators */}
                  {item.isPremium && isLocked && (
                    <Lock className="w-3 h-3 text-amber-600" />
                  )}
                  {item.isPremium && hasRequiredFeature && (
                    <Crown className="w-3 h-3 text-amber-600" />
                  )}

                  {/* Role indicators */}
                  {item.requiredRoles && (
                    <>
                      {isSales && <Briefcase className="w-4 h-4 text-emerald-600 opacity-70" />}
                      {isAdmin && <Shield className="w-4 h-4 text-luxury-gray-dark opacity-70" />}
                      {isOwner && <Crown className="w-4 h-4 text-royal-gold opacity-70" />}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Role Info Banner */}
        <div className="p-4 border-t border-border">
          <div className={cn(
            "rounded-lg p-3 text-xs gradient-card ",
            isOwner && "border border-royal-gold/30 bg-royal-gold/5 text-royal-gold-light",
            isAdmin && "border border-luxury-gray/30 bg-luxury-gray/5 text-luxury-gray-dark",
            isSales && "border border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
          )}>
            <div className="flex items-center gap-2 font-medium mb-1">
              {getRoleIcon(userRole)}
              <span>สิทธิ์: {getRoleLabel(userRole)}</span>
            </div>
            <div className="space-y-1 opacity-90">
              {isSales && <p>• จัดการลูกค้าและ Leads</p>}
              {isAdmin && <p>• จัดการบริษัท, โครงการ, ผู้ใช้</p>}
              {isOwner && <p>• จัดการทั้งระบบ SaaS, Billing, Tenants</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-luxury-gray text-center ">
            © 2024 Chateau PropTech
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
