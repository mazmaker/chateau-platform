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
  variant: "gold" | "charcoal" | "gray" | "brown";
}

const variantStyles = {
  gold: "bg-gradient-to-br from-chateau to-chateau-600 shadow-xl",
  charcoal: "bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl",
  gray: "bg-gradient-to-br from-gray-600 to-gray-700 shadow-xl",
  brown: "bg-gradient-to-br from-chateau-700 to-chateau-800 shadow-xl",
};

export const KPICard = ({ title, value, icon: Icon, trend, variant }: KPICardProps) => {
  return (
    <div className="stat-card rounded-xl p-6 gradient-card-hover bg-luxury-white border">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm text-luxury-gray font-medium uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-charcoal">{value}</p>
          <div className="flex items-center gap-1.5">
            {trend.isPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={cn(
              "text-sm font-medium font-medium",
              trend.isPositive ? "text-emerald-600" : "text-red-500"
            )}>
              {trend.value}
            </span>
            <span className="text-sm text-luxury-gray font-medium">{trend.label}</span>
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
