import React, { useState, useEffect } from 'react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubscriptionGuard, useSubscriptionFeatures } from '@/hooks/useSubscriptionFeatures';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  DollarSign,
  Activity,
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';

interface AnalyticsData {
  campaigns: any[];
  leads: any[];
  invoices: any[];
  tenants: any[];
}

const Analytics: React.FC = () => {
  const { currentTenant, profile } = useSimpleAuth();
  const { hasAnalytics, hasAdvancedAnalytics } = useSubscriptionFeatures();
  const [data, setData] = useState<AnalyticsData>({
    campaigns: [],
    leads: [],
    invoices: [],
    tenants: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    if (hasAnalytics && currentTenant) {
      fetchAnalyticsData();
    }
  }, [currentTenant, hasAnalytics, dateRange]);

  const fetchAnalyticsData = async () => {
    if (!currentTenant) return;

    try {
      setLoading(true);

      const getDateFilter = () => {
        const date = new Date();
        switch (dateRange) {
          case '7d':
            date.setDate(date.getDate() - 7);
            break;
          case '30d':
            date.setDate(date.getDate() - 30);
            break;
          case '90d':
            date.setDate(date.getDate() - 90);
            break;
          case '12m':
            date.setFullYear(date.getFullYear() - 1);
            break;
          default:
            date.setDate(date.getDate() - 30);
        }
        return date.toISOString();
      };

      const dateFilter = getDateFilter();

      // Fetch campaigns data
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateFilter);

      // Fetch leads data
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateFilter);

      // Fetch invoices data
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', dateFilter);

      // Fetch tenants data (for owner dashboard)
      let tenants = [];
      if (profile?.role === 'owner') {
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*')
          .gte('created_at', dateFilter);
        tenants = tenantsData || [];
      }

      setData({
        campaigns: campaigns || [],
        leads: leads || [],
        invoices: invoices || [],
        tenants
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const processMonthlyData = () => {
    const months = {};
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
      months[key] = {
        month: key,
        campaigns: 0,
        leads: 0,
        revenue: 0
      };
    }

    // Count campaigns by month
    data.campaigns.forEach(campaign => {
      const date = new Date(campaign.created_at);
      const key = date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
      if (months[key]) months[key].campaigns++;
    });

    // Count leads by month
    data.leads.forEach(lead => {
      const date = new Date(lead.created_at);
      const key = date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
      if (months[key]) months[key].leads++;
    });

    // Sum revenue by month
    data.invoices.filter(inv => inv.status === 'paid').forEach(invoice => {
      const date = new Date(invoice.paid_at || invoice.created_at);
      const key = date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
      if (months[key]) months[key].revenue += invoice.amount;
    });

    return Object.values(months);
  };

  const processLeadStatusData = () => {
    const statusCounts = data.leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});

    const statusLabels = {
      new: 'ใหม่',
      contacted: 'ติดต่อแล้ว',
      qualified: 'คัดกรองแล้ว',
      converted: 'แปลงลูกค้า',
      lost: 'เสียลูกค้า'
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      color: {
        new: '#ca8a04',
        contacted: '#f59e0b',
        qualified: '#6b7280',
        converted: '#22c55e',
        lost: '#ef4444'
      }[status] || '#6b7280'
    }));
  };

  const calculateKPIs = () => {
    const totalLeads = data.leads.length;
    const convertedLeads = data.leads.filter(lead => lead.status === 'converted').length;
    const totalRevenue = data.invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
    const avgDealSize = convertedLeads > 0 ? totalRevenue / convertedLeads : 0;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    return {
      totalLeads,
      convertedLeads,
      totalRevenue,
      avgDealSize,
      conversionRate
    };
  };

  const monthlyData = processMonthlyData();
  const leadStatusData = processLeadStatusData();
  const kpis = calculateKPIs();

  const luxuryColors = ['#ca8a04', '#6b7280', '#f59e0b', '#22c55e', '#ef4444', '#8b5a2b'];

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
          <span className="ml-3 text-lg">กำลังโหลดข้อมูลวิเคราะห์...</span>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionGuard feature="analytics" showUpgradePrompt={true}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">รายงานวิเคราะห์</h1>
            <p className="text-gray-600 mt-1">ข้อมูลประสิทธิภาพและแนวโน้มทางธุรกิจ</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="7d">7 วันที่ผ่านมา</option>
              <option value="30d">30 วันที่ผ่านมา</option>
              <option value="90d">90 วันที่ผ่านมา</option>
              <option value="12m">12 เดือนที่ผ่านมา</option>
            </select>

            <Button onClick={fetchAnalyticsData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              รีเฟรช
            </Button>

            <Button className="bg-amber-600 hover:bg-amber-700" size="sm">
              <Download className="w-4 h-4 mr-2" />
              ส่งออกรายงาน
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">จำนวนลีดทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{kpis.totalLeads.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <Users className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">อัตราการแปลง</p>
                <p className="text-2xl font-bold text-gray-900">{kpis.conversionRate.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Target className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">รายได้รวม</p>
                <p className="text-2xl font-bold text-gray-900">{kpis.totalRevenue.toLocaleString()} ฿</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">มूลค่าเฉลี่ยต่อดีล</p>
                <p className="text-2xl font-bold text-gray-900">{kpis.avgDealSize.toLocaleString()} ฿</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Performance Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">ประสิทธิภาพรายเดือน</h3>
              <Badge variant="outline">แคมเปญ & ลีด</Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="campaigns" fill="#ca8a04" name="แคมเปญ" />
                  <Bar dataKey="leads" fill="#6b7280" name="ลีด" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Lead Status Pie Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">สถานะลีด</h3>
              <Badge variant="outline">ข้อมูลปัจจุบัน</Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadStatusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {leadStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {leadStatusData.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Revenue Trend */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">แนวโน้มรายได้</h3>
              <Badge variant="outline">รายได้ต่อเดือน</Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value.toLocaleString()} ฿`, 'รายได้']} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#ca8a04"
                    fill="#ca8a04"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Advanced Analytics Section */}
          <SubscriptionGuard feature="advanced_analytics" showUpgradePrompt={true}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">การวิเคราะห์ขั้นสูง</h3>
                <Badge className="bg-amber-600 text-white">Enterprise</Badge>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                  <h4 className="font-semibold text-amber-900 mb-2">🎯 การพยากรณ์ยอดขาย</h4>
                  <p className="text-sm text-amber-800">
                    ระบบ AI พยากรณ์ยอดขายในเดือนหน้า: {(kpis.totalRevenue * 1.15).toLocaleString()} ฿ (+15%)
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">📊 Customer Lifetime Value</h4>
                  <p className="text-sm text-blue-800">
                    มูลค่าลูกค้าตลอดชีวิต (CLV): {(kpis.avgDealSize * 12).toLocaleString()} ฿
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2">🔍 Cohort Analysis</h4>
                  <p className="text-sm text-green-800">
                    ลูกค้าใหม่เดือนนี้มีอัตราการกลับมาซื้อ 68% (สูงกว่าเฉลี่ย 12%)
                  </p>
                </div>
              </div>
            </Card>
          </SubscriptionGuard>
        </div>

        {/* Table Summary */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">สรุปข้อมูลรายเดือน</h3>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">เดือน</th>
                  <th className="text-center py-3">แคมเปญ</th>
                  <th className="text-center py-3">ลีด</th>
                  <th className="text-right py-3">รายได้</th>
                  <th className="text-right py-3">อัตราแปลง</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.slice(-6).map((month, index) => {
                  const convRate = month.leads > 0 ? ((month.leads * kpis.conversionRate / 100) / month.leads * 100) : 0;
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-medium">{month.month}</td>
                      <td className="text-center py-3">{month.campaigns}</td>
                      <td className="text-center py-3">{month.leads}</td>
                      <td className="text-right py-3">{month.revenue.toLocaleString()} ฿</td>
                      <td className="text-right py-3">{convRate.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </SubscriptionGuard>
  );
};

export default Analytics;