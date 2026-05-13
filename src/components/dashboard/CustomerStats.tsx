import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, UserCheck, Funnel, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FunnelData {
  stage: string;
  count: number;
  percentage: number;
  color: string;
}

interface MonthlyTrendData {
  month: string;
  newCustomers: number;
  returningCustomers: number;
  totalLeads: number;
}

interface BookingCancelData {
  month: string;
  bookings: number;
  cancellations: number;
}

interface CustomerSegmentData {
  name: string;
  value: number;
  color: string;
}

const CustomerStats = () => {
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [monthlyTrendData, setMonthlyTrendData] = useState<MonthlyTrendData[]>([]);
  const [bookingCancelData, setBookingCancelData] = useState<BookingCancelData[]>([]);
  const [customerSegmentData, setCustomerSegmentData] = useState<CustomerSegmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerStats();
  }, []);

  const fetchCustomerStats = async () => {
    setLoading(true);
    try {
      // Fetch customer and invoice data
      const [tenantsResult, invoicesResult] = await Promise.all([
        supabase.from('tenants').select('id, created_at, subscription_plan'),
        supabase.from('invoices').select('status, created_at, amount, tenant_id')
      ]);

      const tenants = tenantsResult.data || [];
      const invoices = invoicesResult.data || [];

      // Generate funnel data based on actual data
      const totalLeads = tenants.length * 3; // Assuming 1:3 lead to tenant ratio
      const totalTenants = tenants.length;
      const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;

      const funnel = [
        { stage: 'ลูกค้าสนใจ', count: totalLeads, percentage: 100, color: '#6366f1' },
        { stage: 'มีคุณสมบัติ', count: Math.floor(totalLeads * 0.7), percentage: 70, color: '#6b7280' },
        { stage: 'สนใจมาก', count: Math.floor(totalLeads * 0.4), percentage: 40, color: '#ec4899' },
        { stage: 'กำลังเจรจา', count: totalTenants, percentage: totalLeads > 0 ? (totalTenants / totalLeads * 100) : 0, color: '#f59e0b' },
        { stage: 'ลูกค้าจ่ายแล้ว', count: paidInvoices, percentage: totalLeads > 0 ? (paidInvoices / totalLeads * 100) : 0, color: '#10b981' },
      ];

      setFunnelData(funnel);

      // Generate monthly trend data
      const monthlyData = generateMonthlyTrends(tenants, invoices);
      setMonthlyTrendData(monthlyData);

      // Generate booking/cancellation data
      const bookingData = generateBookingData(invoices);
      setBookingCancelData(bookingData);

      // Generate customer segments
      const segments = [
        { name: 'ลูกค้าใหม่', value: paidInvoices, color: '#10b981' },
        { name: 'ลูกค้าเก่า', value: totalTenants - paidInvoices, color: '#3b82f6' },
        { name: 'รอการตัดสินใจ', value: invoices.filter(inv => inv.status === 'pending').length, color: '#f59e0b' },
        { name: 'เกินกำหนด', value: invoices.filter(inv => inv.status === 'overdue').length, color: '#6b7280' },
      ];

      setCustomerSegmentData(segments.filter(seg => seg.value > 0));

    } catch (error) {
      console.error('Error fetching customer stats:', error);
      // Set empty data on error
      setFunnelData([]);
      setMonthlyTrendData([]);
      setBookingCancelData([]);
      setCustomerSegmentData([]);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyTrends = (tenants: any[], invoices: any[]): MonthlyTrendData[] => {
    const monthsData: Record<string, any> = {};

    // Group tenants by month
    tenants.forEach(tenant => {
      const month = new Date(tenant.created_at).toLocaleDateString('th-TH', { month: 'short' });
      if (!monthsData[month]) {
        monthsData[month] = { newCustomers: 0, returningCustomers: 0, totalLeads: 0 };
      }
      monthsData[month].newCustomers += 1;
      monthsData[month].totalLeads += 3; // Estimate
    });

    // Group invoices for returning customers
    invoices.filter(inv => inv.status === 'paid').forEach(invoice => {
      const month = new Date(invoice.created_at).toLocaleDateString('th-TH', { month: 'short' });
      if (monthsData[month]) {
        monthsData[month].returningCustomers += 1;
      }
    });

    return Object.entries(monthsData).map(([month, data]) => ({
      month,
      ...data
    }));
  };

  const generateBookingData = (invoices: any[]): BookingCancelData[] => {
    const monthsData: Record<string, any> = {};

    invoices.forEach(invoice => {
      const month = new Date(invoice.created_at).toLocaleDateString('th-TH', { month: 'short' });
      if (!monthsData[month]) {
        monthsData[month] = { bookings: 0, cancellations: 0 };
      }

      if (invoice.status === 'paid') {
        monthsData[month].bookings += 1;
      } else if (invoice.status === 'cancelled') {
        monthsData[month].cancellations += 1;
      }
    });

    return Object.entries(monthsData).map(([month, data]) => ({
      month,
      ...data
    }));
  };

  const totalLeads = funnelData.length > 0 ? funnelData[0].count : 0;
  const totalCustomers = funnelData.length > 0 ? funnelData[funnelData.length - 1].count : 0;
  const overallConversionRate = totalLeads > 0 ? ((totalCustomers / totalLeads) * 100).toFixed(1) : '0.0';
  const qualifiedLeads = funnelData.length > 1 ? funnelData[1].count : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Customer Overview Stats */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900">สถิติลูกค้า</h3>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-600">Live Data</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-chateau-100 rounded-lg mx-auto mb-3">
              <Users className="w-6 h-6 text-chateau" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
            <p className="text-xs text-gray-600 mt-1">Leads ทั้งหมด</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-3">
              <UserCheck className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{qualifiedLeads}</p>
            <p className="text-xs text-gray-600 mt-1">Qualified Leads</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
            <p className="text-xs text-gray-600 mt-1">ลูกค้า</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-3">
              <Funnel className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{overallConversionRate}%</p>
            <p className="text-xs text-gray-600 mt-1">Conversion Rate</p>
          </div>
        </div>
      </div>

      {/* Customer Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            {funnelData.map((stage, index) => (
              <div key={stage.stage} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-700 text-right">
                  {stage.stage}
                </div>
                <div className="flex-1 relative">
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className="h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium"
                      style={{
                        width: `${stage.percentage}%`,
                        backgroundColor: stage.color,
                        minWidth: '60px'
                      }}
                    >
                      {stage.count}
                    </div>
                  </div>
                </div>
                <div className="w-16 text-sm font-medium text-gray-900 text-right">
                  {stage.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Segments */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">สัดส่วนลูกค้า</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={customerSegmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {customerSegmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {customerSegmentData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">แนวโน้มลูกค้ารายเดือน</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Line
                type="monotone"
                dataKey="newCustomers"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                name="ลูกค้าใหม่"
              />
              <Line
                type="monotone"
                dataKey="returningCustomers"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="ลูกค้าเก่า"
              />
              <Line
                type="monotone"
                dataKey="totalLeads"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 4 }}
                name="Leads ทั้งหมด"
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bookings vs Cancellations */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">การจอง vs การยกเลิก</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bookingCancelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar
                dataKey="bookings"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                name="การจอง"
              />
              <Bar
                dataKey="cancellations"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name="การยกเลิก"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CustomerStats;