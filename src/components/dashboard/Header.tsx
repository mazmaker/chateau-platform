import { Bell, Globe, Menu, Settings, LogOut, Sun, Sunrise, Sunset, Moon, Calendar, Crown, Shield, Briefcase } from "lucide-react";
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
import { useState, useEffect } from "react";
import { usePermissions } from "@/components/auth/PermissionGuard";
import { CompanyLogo } from "@/components/company/CompanyLogo";

interface HeaderProps {
  onMenuClick: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, signOut, userProfile } = useSimpleAuth();
  const { userRole } = usePermissions();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every 1 minute

    return () => clearInterval(timer);
  }, []);

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

  // Get greeting based on time of day
  const getTimeBasedGreeting = () => {
    const hour = currentTime.getHours();

    if (hour >= 5 && hour < 12) {
      return {
        text: "สวัสดีตอนเช้า",
        icon: Sunrise,
        gradient: "from-amber-400 via-orange-400 to-yellow-500"
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        text: "สวัสดีตอนบ่าย",
        icon: Sun,
        gradient: "from-orange-400 via-amber-500 to-yellow-600"
      };
    } else if (hour >= 17 && hour < 20) {
      return {
        text: "สวัสดีตอนเย็น",
        icon: Sunset,
        gradient: "from-purple-400 via-pink-500 to-red-500"
      };
    } else {
      return {
        text: "สวัสดีตอนดึก",
        icon: Moon,
        gradient: "from-indigo-500 via-purple-600 to-blue-700"
      };
    }
  };

  // Format date in Thai
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return currentTime.toLocaleDateString('th-TH', options);
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

  // Format time
  const getFormattedTime = () => {
    return currentTime.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const greeting = getTimeBasedGreeting();
  const GreetingIcon = greeting.icon;

  return (
    <header className="h-20 bg-gradient-to-r from-[#F0F8FD] via-[#E8F4FD] to-[#F0F8FD] border-b border-border flex items-center justify-between px-6 shadow-sm">
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

        <div className="hidden sm:block">
          {/* Greeting with animated gradient */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${greeting.gradient} shadow-md animate-pulse`}>
              <GreetingIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {greeting.text}คุณ <span className="gradient-primary-text">{getUserName()}</span>
              </h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{getFormattedDate()}</span>
                </div>
                <span>•</span>
                <span className="font-semibold text-[#676AF1]">{getFormattedTime()}</span>
              </div>
            </div>
          </div>
        </div>
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
              การตั้งค่า
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 hover:text-red-700">
              <LogOut className="w-4 h-4 mr-2" />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
