import { useState } from "react";
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
  Lock,
  ChevronDown,
  Building,
  Wrench,
  Wand2,
  Zap,
  Trophy,
  UserCheck,
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

interface NavGroup {
  id: string;
  label: string | null;
  icon?: React.ElementType;
  hrefs: string[];
}

// Top items (no group label) + Collapsible groups (KK style)
const NAV_GROUPS: NavGroup[] = [
  { id: "top",       label: null,              hrefs: ["/", "/owner", "/analytics", "/my-dashboard"] },
  { id: "platform",  label: "PLATFORM CORE",   icon: Building,  hrefs: ["/tenants", "/payments", "/properties"] },
  { id: "crm",       label: "CRM & SALES",     icon: Users,     hrefs: ["/leads", "/team"] },
  { id: "marketing", label: "MARKETING",       icon: Megaphone, hrefs: ["/campaigns", "/builder", "/triggers", "/marketing-analytics"] },
  { id: "admin",     label: "ADMIN",           icon: Wrench,    hrefs: ["/users", "/permissions", "/customization", "/settings"] },
];

const getAllNavItems = (): NavItem[] => [
  { icon: LayoutDashboard, label: "Executive Dashboard", href: "/",            requiredRoles: ["OWNER", "ADMIN"] },
  { icon: TrendingUp,      label: "Platform Overview",   href: "/owner",         requiredRoles: ["OWNER"] },
  { icon: Trophy,          label: "แดชบอร์ดส่วนตัว",      href: "/my-dashboard",  requiredRoles: ["SALES", "AGENT"] },
  { icon: BarChart3,       label: "Analytics",           href: "/analytics",     requiredRoles: ["OWNER", "ADMIN"], requiredFeature: "analytics", isPremium: true },
  { icon: Building2,       label: "จัดการบริษัท",         href: "/tenants",       requiredRoles: ["OWNER"] },
  { icon: CreditCard,      label: "การชำระเงิน",          href: "/payments",      requiredRoles: ["OWNER"] },
  { icon: Building2,       label: "โครงการ",             href: "/properties",    requiredRoles: ["OWNER", "ADMIN", "SALES", "AGENT"] },
  { icon: FileText,        label: "Leads",              href: "/leads",         requiredRoles: ["OWNER", "ADMIN", "SALES", "AGENT"] },
  { icon: UserCheck,       label: "ผลงานทีม",            href: "/team",          requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Megaphone,       label: "Campaigns",          href: "/campaigns",     requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Wand2,           label: "Builder Wizard",     href: "/builder",       requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Zap,             label: "Triggers",           href: "/triggers",      requiredRoles: ["OWNER", "ADMIN"] },
  { icon: BarChart3,       label: "Marketing Analytics",href: "/marketing-analytics", requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Users,           label: "จัดการผู้ใช้",          href: "/users",         requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Lock,            label: "สิทธิ์ผู้ใช้งาน",        href: "/permissions",   requiredRoles: ["OWNER", "ADMIN"] },
  { icon: Palette,         label: "ปรับแต่งระบบ",         href: "/customization", requiredRoles: ["OWNER"] },
  { icon: Settings,        label: "การตั้งค่า",           href: "/settings",      requiredRoles: ["OWNER", "ADMIN", "SALES", "AGENT", "CUSTOMER"] },
  { icon: LogOut,          label: "ออกจากระบบ",          href: "/logout",        isLogout: true },
];

const getRoleLabel = (userRole: string | null) => {
  switch (userRole) {
    case "owner": return "เจ้าของแพลตฟอร์ม";
    case "admin": return "ผู้ดูแลบริษัท";
    case "sales": return "พนักงานขาย";
    case "agent": return "นายหน้า";
    case "customer": return "ลูกค้า";
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

  // Track which groups are expanded — persist in localStorage so user choice sticks
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("sidebarExpanded");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { platform: true, crm: true, marketing: true, developer: true, admin: true };
  });

  const toggleGroup = (id: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("sidebarExpanded", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

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
          return { ...item, label: "ทีมงาน" };
        }
        return item;
      });
  };

  const filteredItems = getFilteredNavItems();
  const logoutItem = filteredItems.find((i) => i.isLogout);
  const mainItems = filteredItems.filter((i) => !i.isLogout);

  // Render a single nav item button
  const renderNavItem = (item: NavItem) => {
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
        style={{ padding: "11px 14px", marginBottom: "3px" }}
      >
        <item.icon className={cn("nav-icon flex-shrink-0", active && "text-white")} size={19} />
        <span className="text-[14.5px] font-medium flex-1 truncate">{item.label}</span>
        {item.isPremium && isLocked && <Lock size={12} style={{ color: "#9ca3af" }} />}
        {item.isPremium && hasRequiredFeature && <Crown size={12} style={{ color: "rgba(245,158,11,0.7)" }} />}
      </button>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
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
        <div style={{ padding: "20px 22px", borderBottom: "1px solid #f3f4f6" }}>
          <div className="flex items-center gap-3">
            <div className="sidebar-logo-icon w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-lg leading-none">C</span>
            </div>
            <div className="min-w-0">
              <p className="sidebar-logo-text font-bold text-base leading-tight">CHATEAU</p>
              <p className="sidebar-logo-sub text-xs leading-tight truncate mt-0.5">
                {userRole === "owner" ? "Platform Owner"
                  : userRole === "admin" ? "Admin Portal"
                  : userRole === "agent" ? "Agent Portal"
                  : userRole === "customer" ? "Customer Portal"
                  : userRole === "sales" ? "Sales Portal"
                  : "Portal"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "12px 12px 8px" }}>
          {NAV_GROUPS.map((group) => {
            const groupItems = mainItems.filter((item) => group.hrefs.includes(item.href));
            if (groupItems.length === 0) return null;

            // Top section — no header, always visible
            if (group.id === "top") {
              return (
                <div key={group.id} style={{ marginBottom: "12px" }}>
                  {groupItems.map(renderNavItem)}
                </div>
              );
            }

            // Collapsible group with icon + label + chevron
            const isExpanded = expanded[group.id];
            const hasActiveChild = groupItems.some((i) => isActive(i.href));
            const GroupIcon = group.icon;

            return (
              <div key={group.id} style={{ marginBottom: "10px" }}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="sidebar-group-header w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors duration-150"
                >
                  {GroupIcon && <GroupIcon size={16} className="flex-shrink-0 sidebar-group-icon" />}
                  <span
                    className="text-[11px] font-bold uppercase flex-1 text-left truncate sidebar-group-label"
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {group.label}
                  </span>
                  <ChevronDown
                    size={14}
                    className="flex-shrink-0 sidebar-group-chevron transition-transform duration-200"
                    style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                  {hasActiveChild && !isExpanded && (
                    <span className="absolute right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#e60023" }} />
                  )}
                </button>
                <div
                  className="overflow-hidden transition-all duration-200"
                  style={{
                    maxHeight: isExpanded ? `${groupItems.length * 48 + 8}px` : "0",
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div style={{ paddingLeft: "8px", paddingTop: "4px", paddingBottom: "4px" }}>
                    {groupItems.map(renderNavItem)}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        {logoutItem && (
          <div style={{ padding: "8px 12px", borderTop: "1px solid #f3f4f6" }}>
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
        <div style={{ padding: "16px", borderTop: "1px solid #f3f4f6" }}>
          <div className="flex items-center gap-3">
            <div className="sidebar-user-avatar w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ border: "1px solid" }}>
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt={getUserName()} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold">{getUserInitials()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="sidebar-user-name text-sm font-semibold truncate leading-tight">{getUserName()}</p>
              <p className="sidebar-user-role text-[11px] truncate leading-tight mt-0.5">{getRoleLabel(userRole)}</p>
            </div>
            <div className="flex-shrink-0">
              {userRole === "owner" && <Crown size={14} style={{ color: "#e60023" }} />}
              {userRole === "admin" && <Shield size={14} style={{ color: "#6b7280" }} />}
              {userRole === "sales" && <Briefcase size={14} style={{ color: "#6b7280" }} />}
              {userRole === "agent" && <UserCheck size={14} style={{ color: "#6b7280" }} />}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
