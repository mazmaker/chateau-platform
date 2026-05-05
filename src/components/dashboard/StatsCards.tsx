import { useState, useEffect } from "react";
import { Users, TrendingUp, UserCheck, Percent, UserCog, TrendingDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface KPIData {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

interface StatsData {
  leads: number;
  conversions: number;
  customers: number;
  conversionRate: string;
  salesStaff: number;
}

const KPICard = ({ title, value, icon: Icon, iconBg, iconColor, trend }: KPIData) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover:shadow-soft-lg transition-shadow duration-200">
    <div className="flex items-start justify-between mb-4">
      <p className="text-sm font-medium text-gray-500 leading-tight">{title}</p>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
        <Icon className={cn("w-5 h-5", iconColor)} strokeWidth={2} />
      </div>
    </div>

    <p className="text-3xl font-bold text-gray-900 mb-3 tabular-nums">{value}</p>

    {trend ? (
      <div className="flex items-center gap-1.5">
        {trend.isPositive ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        )}
        <span className={cn("text-xs font-semibold", trend.isPositive ? "text-emerald-600" : "text-red-500")}>
          {trend.value}
        </span>
        <span className="text-xs text-gray-400">เทียบกับเดือนก่อน</span>
      </div>
    ) : (
      <div className="h-5" />
    )}
  </div>
);

export const StatsCards = () => {
  const [stats, setStats] = useState<StatsData>({
    leads: 0,
    conversions: 0,
    customers: 0,
    conversionRate: "0.0%",
    salesStaff: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [leadsResult, conversionsResult, customersResult, usersResult] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "paid"),
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }),
      ]);

      const leads = leadsResult.count || 0;
      const conversions = conversionsResult.count || 0;
      const customers = customersResult.count || 0;
      const salesStaff = usersResult.count || 0;
      const conversionRate = leads > 0 ? `${((conversions / leads) * 100).toFixed(1)}%` : "0.0%";

      setStats({ leads, conversions, customers, conversionRate, salesStaff });
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  };

  const kpiCards: KPIData[] = [
    {
      title: "Leads ทั้งหมด",
      value: loading ? "—" : stats.leads.toLocaleString(),
      icon: Users,
      iconBg: "bg-chateau/10",
      iconColor: "text-chateau",
      trend: { value: "+12.5%", isPositive: true },
    },
    {
      title: "Conversions",
      value: loading ? "—" : stats.conversions.toLocaleString(),
      icon: TrendingUp,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      trend: { value: "+8.2%", isPositive: true },
    },
    {
      title: "ลูกค้า",
      value: loading ? "—" : stats.customers.toLocaleString(),
      icon: UserCheck,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      trend: { value: "+3.1%", isPositive: true },
    },
    {
      title: "อัตราแปลง",
      value: loading ? "—" : stats.conversionRate,
      icon: Percent,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      trend: { value: "-1.4%", isPositive: false },
    },
    {
      title: "พนักงานขาย",
      value: loading ? "—" : stats.salesStaff.toLocaleString(),
      icon: UserCog,
      iconBg: "bg-pink-50",
      iconColor: "text-pink-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {kpiCards.map((card) => (
        <KPICard key={card.title} {...card} />
      ))}
    </div>
  );
};
