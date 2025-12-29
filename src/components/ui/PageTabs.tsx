import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface PageTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const PageTabs = ({ tabs, activeTab, onTabChange, className }: PageTabsProps) => {
  return (
    <nav className={cn("bg-white rounded-2xl p-3 shadow-sm border border-border", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 relative",
              isActive
                ? "bg-[#E4DAF4] text-[#676AF1] font-semibold shadow-sm"
                : "text-muted-foreground hover:bg-secondary/50"
            )}
          >
            <Icon className={cn(
              "w-5 h-5 transition-colors",
              isActive ? "text-[#676AF1]" : "text-muted-foreground"
            )} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span className={cn(
                "ml-auto text-xs px-2 py-0.5 rounded-full",
                isActive ? "bg-[#676AF1] text-white" : "bg-gray-200 text-gray-600"
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default PageTabs;
