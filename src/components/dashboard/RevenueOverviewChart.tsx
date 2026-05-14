import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';

interface RevenueData {
  month: string;
  revenue: number;
  bookings: number;
}

const RevenueOverviewChart = () => {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [growthRate, setGrowthRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    setLoading(true);
    try {
      // Fetch invoice data for the last 8 months
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('amount, created_at, status')
        .eq('status', 'paid')
        .gte('created_at', new Date(Date.now() - 8 * 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (invoices && invoices.length > 0) {
        // Group data by month
        const monthlyData = invoices.reduce((acc, invoice) => {
          const date = new Date(invoice.created_at);
          const month = date.toLocaleDateString('th-TH', { month: 'short' });

          if (!acc[month]) {
            acc[month] = { revenue: 0, bookings: 0 };
          }

          acc[month].revenue += invoice.amount;
          acc[month].bookings += 1;

          return acc;
        }, {} as Record<string, { revenue: number; bookings: number }>);

        const chartData = Object.entries(monthlyData).map(([month, data]) => ({
          month,
          revenue: (data as { revenue: number; bookings: number }).revenue,
          bookings: (data as { revenue: number; bookings: number }).bookings
        }));

        setRevenueData(chartData);

        // Calculate total revenue and growth rate
        const total = chartData.reduce((sum, item) => sum + item.revenue, 0);
        setTotalRevenue(total);

        if (chartData.length >= 2) {
          const latest = chartData[chartData.length - 1];
          const previous = chartData[chartData.length - 2];
          const growth = previous.revenue > 0
            ? ((latest.revenue - previous.revenue) / previous.revenue) * 100
            : 0;
          setGrowthRate(growth);
        }
      } else {
        setRevenueData([]);
        setTotalRevenue(0);
        setGrowthRate(0);
      }
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      setRevenueData([]);
      setTotalRevenue(0);
      setGrowthRate(0);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue Overview</h3>
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
        <p className="text-2xl font-bold text-gray-900">
          ฿{totalRevenue.toLocaleString('th-TH')}
        </p>
        <p className={`text-sm ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}% from last month
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => `฿${(value/1000)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: any) => [`฿${value.toLocaleString()}`, 'Revenue']}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueOverviewChart;