import {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  UserCog,
  Megaphone,
  Settings,
  Castle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "ภาพรวม", href: "/", active: true },
  { icon: Building2, label: "โครงการ", href: "/projects" },
  { icon: Home, label: "ยูนิต", href: "/units" },
  { icon: Users, label: "ลูกค้า", href: "/customers" },
  { icon: UserCog, label: "พนักงานขาย", href: "/sales-team" },
  { icon: Megaphone, label: "แคมเปญ", href: "/marketing" },
  { icon: Settings, label: "ตั้งค่า", href: "/settings" },
  { icon: Settings, label: "ออกจากระบบ", href: "/logout" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
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
            <span className="text-xl font-bold gradient-primary-text">CHATEAU</span>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="p-4">
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Somchai" />
                  <AvatarFallback className="gradient-primary text-primary-foreground">SC</AvatarFallback>
                </Avatar>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-[10px] text-white rounded-full flex items-center justify-center">4</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">สมชาย ศรีสวัสดิ์</p>
                <p className="text-xs text-muted-foreground">ลูกค้าสัมพันธ์</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                "hover:bg-secondary group",
                item.active && "gradient-primary text-primary-foreground shadow-lg"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-colors",
                item.active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )} />
              <span className={cn(
                "font-medium",
                !item.active && "text-muted-foreground group-hover:text-foreground"
              )}>
                {item.label}
              </span>
            </a>
          ))}
        </nav>

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
