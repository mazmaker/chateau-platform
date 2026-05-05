import {
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  Settings,
  LogOut,
  Crown,
  Shield,
  Briefcase,
  CreditCard,
  FileText,
  Palette,
  TrendingUp,
  BarChart3,
  Key,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { usePermissions } from "@/components/auth/PermissionGuard";
import { useSubscriptionFeatures, SubscriptionFeature } from "@/hooks/useSubscriptionFeatures";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  isLogout?: boolean;
  requiredRoles?: string[];
  requiredFeature?: SubscriptionFeature;
  isPremium?: boolean;
}

const NAV_GROUPS: { label: string | null; hrefs: string[] }[] = [
  { label: null, hrefs: ["/", "/owner"] },
  { label: "บริษัท", hrefs: ["/tenants", "/payments"] },
  { label: "ธุรกิจ", hrefs: ["/properties", "/leads", "/campaigns", "/analytics", "/api"] },
  { label: "จัดการ", hrefs: ["/users", "/customization", "/settings"] },
];

const getAllNavItems = (): NavItem[] => [
  { icon: LayoutDashboard, label: "ภาพรวม", href: "/" },
  { icon: TrendingUp, label: "Owner Dashboard", href: "/owner", requiredRoles: ["OWNER"] },
  { icon: Building2, label: "จัดการบริษัท", href: "/tenants", requiredRoles: ["OWNER"] },
  { icon: CreditCard, label: "การชำระเงิน", href: "/payments", requiredRoles: ["OWNER"] },
  { icon: Building2, label: "โครงการ", href: "/properties", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  { icon: FileText, label: "Leads", href: "/leads", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  { icon: Megaphone, label: "แคมเปญ", href: "/campaigns", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: BarChart3, label: "รายงานวิเคราะห์", href: "/analytics", requiredRoles: ["OWNER", "ADMIN"], requiredFeature: "analytics", isPremium: true },
  { icon: Key, label: "การจัดการ API", href: "/api", requiredRoles: ["OWNER", "ADMIN"], requiredFeature: "api_access", isPremium: true },
  { icon: Users, label: "จัดการผู้ใช้", href: "/users", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Palette, label: "ปรับแต่งระบบ", href: "/customization", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Settings, label: "การตั้งค่า", href: "/settings", requiredRoles: ["OWNER", "ADMIN", "SALES"] },
  { icon: LogOut, label: "ออกจากระบบ", href: "/logout", isLogout: true },
];

const getRoleLabel = (userRole: string | null) => {
  switch (userRole) {
    case "owner": return "เจ้าของแพลตฟอร์ม";
    case "admin": return "ผู้ดูแลบริษัท";
    case "sales": return "พนักงานขาย";
    default: return "ผู้ใช้";
  }
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, userRole, userProfile } = useSimpleAuth();
  const { isOwner, isAdmin } = usePermissions();
  const { hasFeature } = useSubscriptionFeatures();

  const handleNavClick = async (item: NavItem) => {
    if (item.isLogout) {
      await signOut();
      navigate("/auth/login");
    } else {
      navigate(item.href);
      onClose();
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const getUserInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  const getUserName = () => userProfile?.full_name || user?.email || "User";

  const getFilteredNavItems = (): NavItem[] => {
    return getAllNavItems()
      .filter((item) => {
        if (item.isLogout) return true;
        if (item.requiredRoles && !item.requiredRoles.includes(userRole?.toUpperCase() || "")) return false;
        if (item.requiredFeature && !hasFeature(item.requiredFeature)) {
          return isOwner;
        }
        return true;
      })
      .map((item) => {
        if (item.href === "/users" && isAdmin && !isOwner) {
          return { ...item, label: "พนักงานขาย" };
        }
        return item;
      });
  };

  const filteredItems = getFilteredNavItems();
  const logoutItem = filteredItems.find((i) => i.isLogout);
  const mainItems = filteredItems.filter((i) => !i.isLogout);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "light-sidebar",
          "fixed left-0 top-0 h-full w-[260px] z-50",
          "flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div className="flex items-center gap-3">
            <div className="sidebar-logo-icon w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-base leading-none">C</span>
            </div>
            <div className="min-w-0">
              <p className="sidebar-logo-text font-semibold text-sm leading-tight">CHATEAU</p>
              <p className="sidebar-logo-sub text-xs leading-tight truncate">
                {userRole === "owner" ? "Platform Owner" : userRole === "admin" ? "Admin Portal" : "Sales Portal"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "12px" }}>
          {NAV_GROUPS.map((group) => {
            const groupItems = mainItems.filter((item) => group.hrefs.includes(item.href));
            if (groupItems.length === 0) return null;

            return (
              <div key={group.label ?? "overview"} style={{ marginBottom: "4px" }}>
                {group.label && (
                  <p
                    className="sidebar-section-label font-semibold uppercase"
                    style={{ padding: "16px 12px 6px", fontSize: "10px", letterSpacing: "0.1em" }}
                  >
                    {group.label}
                  </p>
                )}
                {groupItems.map((item) => {
                  const hasRequiredFeature = item.requiredFeature ? hasFeature(item.requiredFeature) : true;
                  const isLocked = item.requiredFeature && !hasRequiredFeature;
                  const active = isActive(item.href);

                  return (
                    <button
                      key={item.href}
                      onClick={() => handleNavClick(item)}
                      disabled={!!isLocked}
                      className={cn(
                        "sidebar-nav-item",
                        active && "active",
                        "w-full flex items-center gap-3 text-left rounded-lg transition-all duration-150",
                        isLocked && "opacity-50 cursor-not-allowed"
                      )}
                      style={{ padding: "10px 12px", marginBottom: "2px" }}
                    >
                      <item.icon
                        className={cn("nav-icon flex-shrink-0", active && "text-white")}
                        size={18}
                      />
                      <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                      {item.isPremium && isLocked && (
                        <Lock size={12} style={{ color: "#52525b" }} />
                      )}
                      {item.isPremium && hasRequiredFeature && (
                        <Crown size={12} style={{ color: "rgba(245,158,11,0.7)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        {logoutItem && (
          <div style={{ padding: "0 12px 8px" }}>
            <button
              onClick={() => handleNavClick(logoutItem)}
              className="sidebar-logout-btn w-full flex items-center gap-3 text-left rounded-lg transition-all duration-150"
              style={{ padding: "10px 12px" }}
            >
              <LogOut size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium">{logoutItem.label}</span>
            </button>
          </div>
        )}

        {/* User profile */}
        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb" }}>
          <div className="flex items-center gap-3">
            <div
              className="sidebar-user-avatar w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ border: "1px solid" }}
            >
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt={getUserName()} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold">{getUserInitials()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="sidebar-user-name text-sm font-medium truncate leading-tight">{getUserName()}</p>
              <p className="sidebar-user-role text-xs truncate leading-tight">{getRoleLabel(userRole)}</p>
            </div>
            <div className="flex-shrink-0">
              {userRole === "owner" && <Crown size={14} style={{ color: "#e60023" }} />}
              {userRole === "admin" && <Shield size={14} style={{ color: "#6b7280" }} />}
              {userRole === "sales" && <Briefcase size={14} style={{ color: "#6b7280" }} />}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
