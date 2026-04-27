import { useState, useEffect } from 'react';
import { Users, TrendingUp, UserCheck, Percent, UserCog, UserPlus, Clock } from "lucide-react";
import { supabase } from '@/lib/supabase';

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  iconBg?: string;
}

interface StatsData {
  leads: number;
  conversions: number;
  customers: number;
  conversionRate: string;
  salesStaff: number;
  activeUsers: number;
  appointments: number;
}

const StatCard = ({ icon, value, label, iconBg = "bg-secondary" }: StatCardProps) => (
  <div className="flex items-center gap-3">
    <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
      {icon}
    </div>
    <div>
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

export const StatsCards = () => {
  const [stats, setStats] = useState<StatsData>({
    leads: 0,
    conversions: 0,
    customers: 0,
    conversionRate: '0.0%',
    salesStaff: 0,
    activeUsers: 0,
    appointments: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch various stats from database
      const [
        leadsResult,
        conversionsResult,
        customersResult,
        usersResult
      ] = await Promise.all([
        // Count total leads (assuming leads table exists)
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        // Count conversions (paid invoices)
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
        // Count total customers/tenants
        supabase.from('tenants').select('id', { count: 'exact', head: true }),
        // Count users/sales staff
        supabase.from('users').select('id, role', { count: 'exact', head: true })
      ]);

      const leads = leadsResult.count || 0;
      const conversions = conversionsResult.count || 0;
      const customers = customersResult.count || 0;
      const totalUsers = usersResult.count || 0;

      // Calculate conversion rate
      const conversionRate = leads > 0 ? ((conversions / leads) * 100).toFixed(1) : '0.0';

      // Count active users (assuming recent activity)
      const { count: activeUsersCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('last_login_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      setStats({
        leads,
        conversions,
        customers,
        conversionRate: `${conversionRate}%`,
        salesStaff: totalUsers,
        activeUsers: activeUsersCount || 0,
        appointments: 0 // Would need appointments table
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      {/* Customer Stats */}
      <div className="bg-card rounded-xl p-4 card-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">สถิติลูกค้า</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5 text-primary" />}
            value={stats.leads}
            label="Leads"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-primary" />}
            value={stats.conversions}
            label="Conversions"
          />
          <StatCard
            icon={<UserCheck className="w-5 h-5 text-primary" />}
            value={stats.customers}
            label="Customers"
          />
          <StatCard
            icon={<Percent className="w-5 h-5 text-success" />}
            value={stats.conversionRate}
            label="Conversion Rates"
            iconBg="bg-success/10"
          />
        </div>
      </div>

      {/* Sales Team Stats */}
      <div className="bg-card rounded-xl p-4 card-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">พนักงานขาย</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<UserCog className="w-5 h-5 text-primary" />}
            value={stats.salesStaff}
            label="พนักงานขาย"
          />
          <StatCard
            icon={<UserPlus className="w-5 h-5 text-primary" />}
            value={stats.activeUsers}
            label="เพิ่มใช้งาน"
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-primary" />}
            value={stats.appointments}
            label="นัดหมาย"
          />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold text-muted-foreground">-</p>
              <p className="text-xs text-muted-foreground">อื่นๆ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
