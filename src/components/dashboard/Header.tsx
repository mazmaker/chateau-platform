import { Bell, Globe, Menu, Settings, LogOut, Crown, Shield, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { usePermissions, ManageSettingsGuard, ManageUsersGuard } from "@/components/auth/PermissionGuard";
import { CompanyLogo } from "@/components/company/CompanyLogo";

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, signOut, userRole, userProfile } = useSimpleAuth();
  const { isOwner, isAdmin, isSales } = usePermissions();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
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

  const getRoleIcon = () => {
    switch (userRole) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />;
      case 'sales':
        return <Briefcase className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'owner': return 'เจ้าของ';
      case 'admin': return 'ผู้ดูแล';
      case 'sales': return 'พนักงานขาย';
      default: return 'ผู้ใช้';
    }
  };

  return (
    <header className="h-16 bg-[#F0F8FD] border-b border-border flex items-center justify-between px-6">
      {/* Left Side */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Company Logo */}
        <CompanyLogo size="2xl" className="hidden sm:block" />

        <h1 className="text-2xl font-bold text-foreground hidden sm:block">Dashboard</h1>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Globe className="w-5 h-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>🇺🇸 English</DropdownMenuItem>
            <DropdownMenuItem>🇹🇭 ไทย</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="w-9 h-9 cursor-pointer rounded-full overflow-hidden bg-gradient-to-br from-[#676AF1] to-[#38B6FFCC] flex items-center justify-center ring-2 ring-border hover:ring-primary transition-all">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt={getUserName()} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {getUserInitials()}
                </span>
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-4 py-2 border-b border-border">
              <p className="font-medium text-foreground">{getUserName()}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>

            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              แก้ไขโปรไฟล์
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 hover:text-red-700">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
