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
  TrendingUp,
  BarChart3,
  Lock,
  ChevronDown,
  Building,
  MapPin,
  Wrench,
  Wand2,
  Zap,
  Trophy,
  UserCheck,
  MessageSquare,
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
  { id: "top",       label: null,              hrefs: ["/", "/owner", "/my-dashboard"] },
  { id: "property",  label: "PROPERTY",        icon: Building,  hrefs: ["/properties"] },
  { id: "sales",     label: "SALES",           icon: TrendingUp, hrefs: ["/leads", "/analytics", "/team"] },
  { id: "marketing", label: "MARKETING",       icon: Megaphone, hrefs: ["/campaigns", "/builder", "/triggers", "/marketing-analytics"] },
  { id: "admin",     label: "ADMIN",           icon: Wrench,    hrefs: ["/users", "/permissions", "/settings"] },
];

// Owner = SaaS control-plane + real-estate HQ. English UPPERCASE headers match
// the app's KK-style groups above:
//   (top, no header) ภาพรวมแพลตฟอร์ม — Executive Dashboard
//   ANALYTICS        — cross-tenant real-estate intelligence (market, geo, company,
//                      sales-team performance) = the HQ lens added per the Owner
//                      redesign. See documents/owner-hq-dashboard-plan.md.
//   TENANTS          — operate EXISTING customers: manage company, projects, billing
//   GROWTH           — acquire NEW customers (platform sales pipeline: prospect → tenant)
//   SETTINGS         — users, support, audit, platform config
// Tenant-ops menus (campaigns, triggers, team, permissions, etc.) are intentionally
// NOT here: those are the Admin's application-plane work, not the platform owner's.
// NOTE: within-group order follows the master getAllNavItems() order, not hrefs order.
const OWNER_NAV_GROUPS: NavGroup[] = [
  { id: "top",       label: null,                hrefs: ["/owner"] },
  { id: "analytics", label: "ANALYTICS", icon: BarChart3, hrefs: ["/owner-market", "/owner-geography", "/owner-companies", "/owner-agents"] },
  { id: "tenants",   label: "TENANTS",   icon: Building,  hrefs: ["/tenants", "/owner-projects", "/payments"] },
  { id: "growth",    label: "GROWTH",    icon: Briefcase, hrefs: ["/owner-leads"] },
  { id: "settings",  label: "SETTINGS",  icon: Wrench,    hrefs: ["/users", "/owner-support", "/owner-audit", "/settings"] },
];

const getAllNavItems = (): NavItem[] => [
  // Two role-scoped executive views, deliberately NOT shared:
  //   Admin → "/"      tenant-level Executive Dashboard (that company's sales / GDV / inventory)
  //   Owner → "/owner" platform-wide view (MRR, churn, tenants) = the Owner's own Executive Dashboard
  { icon: LayoutDashboard, label: "Executive Dashboard", href: "/",            requiredRoles: ["ADMIN"] },
  { icon: LayoutDashboard, label: "Executive Dashboard",  href: "/owner",         requiredRoles: ["OWNER"] },
  // Owner ANALYTICS group — cross-tenant real-estate intelligence (HQ lens).
  // Data: units→properties→tenants via live Owner RLS; no migration needed.
  // See documents/owner-hq-dashboard-plan.md.
  { icon: TrendingUp,      label: "Market Overview",     href: "/owner-market",    requiredRoles: ["OWNER"] },
  { icon: MapPin,          label: "Geography",           href: "/owner-geography", requiredRoles: ["OWNER"] },
  { icon: BarChart3,       label: "Company Performance", href: "/owner-companies", requiredRoles: ["OWNER"] },
  { icon: Trophy,          label: "Sales Performance",   href: "/owner-agents",    requiredRoles: ["OWNER"] },
  { icon: Trophy,          label: "My Dashboard",        href: "/my-dashboard",  requiredRoles: ["SALES", "AGENT"] },
  // tenant-scoped LEAD analytics (conversion/SLA/won-lost for one company) =
  // Admin's application-plane work, not the platform Owner's. ADMIN-only.
  // Owner items are ordered to drive the sidebar groups (render order = this master
  // order, filtered per group). TENANTS group → จัดการบริษัท · การชำระเงิน;
  // SALES group → Leads. Keep this order so billing reads last within TENANTS.
  { icon: Building2,       label: "Companies",           href: "/tenants",       requiredRoles: ["OWNER"] },
  // Owner gets the cross-tenant, read-only Project Dashboard (control-plane);
  // Admin/Sales/Agent keep the tenant-scoped editable /properties page.
  { icon: Building,        label: "All Projects",        href: "/owner-projects", requiredRoles: ["OWNER"] },
  { icon: CreditCard,      label: "Payments",            href: "/payments",      requiredRoles: ["OWNER"] },
  { icon: Briefcase,       label: "Leads",               href: "/owner-leads",   requiredRoles: ["OWNER"] },
  { icon: Building2,       label: "Projects",            href: "/properties",    requiredRoles: ["ADMIN", "SALES", "AGENT"] },
  { icon: FileText,        label: "Leads",              href: "/leads",         requiredRoles: ["ADMIN", "SALES", "AGENT"] },
  // Tenant-ops menus — Admin's application-plane work, NOT the platform Owner's.
  // Deliberately ADMIN-only (cut from Owner) so the Owner menu stays a clean
  // control-plane. Owner can still reach them by URL for support if ever needed.
  { icon: UserCheck,       label: "Team Performance",    href: "/team",          requiredRoles: ["ADMIN"] },
  // Analytics last = action → result convention (same as Marketing Analytics at bottom of MARKETING)
  { icon: BarChart3,       label: "Lead Analytics",      href: "/analytics",     requiredRoles: ["ADMIN"], requiredFeature: "analytics", isPremium: true },
  { icon: Megaphone,       label: "Campaigns",          href: "/campaigns",     requiredRoles: ["ADMIN"] },
  { icon: Wand2,           label: "Builder Wizard",     href: "/builder",       requiredRoles: ["ADMIN"] },
  { icon: Zap,             label: "Triggers",           href: "/triggers",      requiredRoles: ["ADMIN"] },
  { icon: BarChart3,       label: "Marketing Analytics",href: "/marketing-analytics", requiredRoles: ["ADMIN"] },
  { icon: Users,           label: "Users",               href: "/users",         requiredRoles: ["OWNER", "ADMIN"] },
  { icon: MessageSquare,   label: "Support",             href: "/owner-support", requiredRoles: ["OWNER"] },
  { icon: Shield,          label: "Audit Log",           href: "/owner-audit",   requiredRoles: ["OWNER"] },
  { icon: Lock,            label: "Permissions",         href: "/permissions",   requiredRoles: ["ADMIN"] },
  { icon: Settings,        label: "Settings",            href: "/settings",      requiredRoles: ["OWNER", "ADMIN", "SALES", "AGENT", "CUSTOMER"] },
  { icon: LogOut,          label: "Log Out",             href: "/logout",        isLogout: true },
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
  const { user, signOut, userRole, userProfile, passwordResetRequired } = useSimpleAuth();
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
      return;
    }
    // When user must reset password, only the change-password route is reachable.
    // Without this guard, sidebar clicks navigate to /leads etc., which then bounce
    // through ProtectedRoute — causing a brief flash of forbidden content.
    if (passwordResetRequired && item.href !== "/auth/change-password") {
      navigate("/auth/change-password");
      onClose();
      return;
    }
    navigate(item.href);
    onClose();
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    // Exact match OR a real sub-path (href + "/..."), so e.g. "/owner-leads" does NOT
    // light up "/owner". Detail routes like /tenants/:id still match their parent "/tenants".
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const getUserInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  const getUserName = () => userProfile?.full_name || user?.email || "User";

  const getFilteredNavItems = (): NavItem[] => {
    // IMPORTANT: requiredRoles in the NAV_ITEMS table are written UPPERCASE
    // ("OWNER", "ADMIN", "SALES", ...), but AuthContextSimple stores userRole as
    // lowercase ('owner', 'admin', ...). We normalize BOTH sides here so the
    // comparison can't silently break if someone changes either source. Do not
    // remove this normalization — without it, every menu item disappears.
    const userRoleUpper = (userRole || "").toUpperCase();
    return getAllNavItems()
      .filter((item) => {
        if (item.isLogout) return true;
        if (item.requiredRoles && !item.requiredRoles.map((r) => r.toUpperCase()).includes(userRoleUpper)) return false;
        if (item.requiredFeature && !hasFeature(item.requiredFeature)) {
          return isOwner;
        }
        return true;
      })
      .map((item) => {
        if (item.href === "/users" && isAdmin && !isOwner) {
          return { ...item, label: "User Management" };
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

        {/* Navigation — Owner uses its own 2-tier control-plane grouping */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "12px 12px 8px" }}>
          {(isOwner ? OWNER_NAV_GROUPS : NAV_GROUPS).map((group) => {
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

            // Collapsible group with icon + label + chevron.
            // Default to expanded unless the user explicitly collapsed it — so
            // newly-added groups (e.g. the Owner's) start open, not hidden.
            const isExpanded = expanded[group.id] !== false;
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
