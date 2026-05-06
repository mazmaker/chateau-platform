import { Bell, Menu, Settings, LogOut, Search, ChevronDown, Building2 } from "lucide-react";
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

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, signOut, currentTenant, userRole, userProfile } = useSimpleAuth();
  const { isOwner } = usePermissions();

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

  return (
    <header className="h-[72px] bg-white border-b border-gray-100 flex items-center gap-3 px-5 lg:px-7">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden flex-shrink-0 text-gray-500"
        onClick={onMenuClick}
      >
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

      {/* Search bar */}
      <div className="flex-1 min-w-0 max-w-sm lg:max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหา..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-[14.5px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-chateau/20 focus:border-chateau focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Notification bell */}
        <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-700">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-chateau/10 border border-chateau/20 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3" }}>
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt={getUserName()} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold" style={{ color: "#e60023" }}>{getUserInitials()}</span>
                )}
              </div>

              {/* Name + role */}
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
