import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: {
    value: string;
    isPositive: boolean;
    label: string;
  };
  variant: "pink" | "orange" | "green" | "purple";
}

const variantStyles = {
  pink: "bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl",
  orange: "bg-gradient-to-br from-amber-600 to-amber-700 shadow-xl",
  green: "bg-gradient-to-br from-gray-600 to-gray-700 shadow-xl",
  purple: "bg-gradient-to-br from-amber-800 to-amber-900 shadow-xl",
};

export const KPICard = ({ title, value, icon: Icon, trend, variant }: KPICardProps) => {
  return (
    <div className="bg-card rounded-xl p-6 card-shadow card-hover">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          <div className="flex items-center gap-1.5">
            {trend.isPositive ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-destructive" />
            )}
            <span className={cn(
              "text-sm font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.value}
            </span>
            <span className="text-sm text-muted-foreground">{trend.label}</span>
          </div>
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          variantStyles[variant]
        )}>
          <Icon className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
};
