import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const revenueData = [
  { month: 'ม.ค.', revenue: 420000, bookings: 156 },
  { month: 'ก.พ.', revenue: 380000, bookings: 142 },
  { month: 'มี.ค.', revenue: 510000, bookings: 189 },
  { month: 'เม.ย.', revenue: 475000, bookings: 178 },
  { month: 'พ.ค.', revenue: 590000, bookings: 221 },
  { month: 'มิ.ย.', revenue: 620000, bookings: 234 },
  { month: 'ก.ค.', revenue: 680000, bookings: 256 },
  { month: 'ส.ค.', revenue: 710000, bookings: 268 },
];

const RevenueOverviewChart = () => {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue Overview</h3>
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
        <p className="text-2xl font-bold text-gray-900">฿4,385,000</p>
        <p className="text-sm text-green-600">+12.5% from last month</p>
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