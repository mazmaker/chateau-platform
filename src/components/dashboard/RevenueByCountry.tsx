import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const countryRevenueData = [
  { country: 'Thailand', revenue: 2450000, bookings: 892 },
  { country: 'Singapore', revenue: 890000, bookings: 245 },
  { country: 'Malaysia', revenue: 675000, bookings: 198 },
  { country: 'China', revenue: 560000, bookings: 167 },
  { country: 'Japan', revenue: 445000, bookings: 134 },
  { country: 'USA', revenue: 334000, bookings: 98 },
  { country: 'UK', revenue: 223000, bookings: 76 },
  { country: 'Australia', revenue: 189000, bookings: 64 }
];

const RevenueByCountry = () => {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900">Revenue by Country</h3>
        <button className="text-sm text-chateau hover:text-chateau-700 font-medium">
          View all
        </button>
      </div>
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-1">Total International Revenue</p>
        <p className="text-2xl font-bold text-gray-900">฿5,766,000</p>
        <p className="text-sm text-green-600">+18.2% from last quarter</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={countryRevenueData} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => `฿${(value/1000)}k`}
            />
            <YAxis
              type="category"
              dataKey="country"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: any, name: any) => [
                name === 'revenue' ? `฿${value.toLocaleString()}` : value,
                name === 'revenue' ? 'Revenue' : 'Bookings'
              ]}
            />
            <Bar
              dataKey="revenue"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueByCountry;