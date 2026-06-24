import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { ResponsiveContainer } from '@/components/charts/SmoothResponsiveContainer';
import { supabase } from '@/lib/supabase';

interface RevenueData {
  name: string;
  value: number;
  color: string;
}

export const TotalRevenueChart = () => {
  const [data, setData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    setLoading(true);
    try {
      // Fetch revenue data from invoices table
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('amount, subscription_plan, status')
        .eq('status', 'paid');

      if (error) throw error;

      if (invoices && invoices.length > 0) {
        // Calculate revenue by channel (assuming subscription plans represent channels)
        const revenueByChannel = invoices.reduce((acc, invoice) => {
          const channel = invoice.subscription_plan === 'starter' ? 'Online' : 'Offline';
          acc[channel] = (acc[channel] || 0) + invoice.amount;
          return acc;
        }, {} as Record<string, number>);

        const chartData = [
          { name: "Online", value: revenueByChannel.Online || 0, color: "hsl(276, 42%, 53%)" },
          { name: "Offline", value: revenueByChannel.Offline || 0, color: "hsl(256, 37%, 48%)" },
        ];

        setData(chartData);
      } else {
        setData([
          { name: "Online", value: 0, color: "hsl(276, 42%, 53%)" },
          { name: "Offline", value: 0, color: "hsl(256, 37%, 48%)" },
        ]);
      }
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      setData([
        { name: "Online", value: 0, color: "hsl(276, 42%, 53%)" },
        { name: "Offline", value: 0, color: "hsl(256, 37%, 48%)" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6 card-shadow h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 card-shadow h-full">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Total Revenue</h3>
        <p className="text-sm text-muted-foreground">Revenue by channel</p>
      </div>
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-chart-2" />
          <span className="text-muted-foreground">Offline</span>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barSize={24}>
            <XAxis 
              type="number" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
            />
            <YAxis 
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
              width={60}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 15%, 91%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value: any) => [`฿${value.toLocaleString('th-TH')}`, 'Revenue']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
