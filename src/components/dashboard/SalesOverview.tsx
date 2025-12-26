import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Home, Users, Target } from 'lucide-react';

// Mock real-time data
const salesData = [
  { date: '1 ธ.ค.', revenue: 4500000, units: 12, leads: 45, bookings: 8 },
  { date: '5 ธ.ค.', revenue: 5200000, units: 15, leads: 52, bookings: 10 },
  { date: '10 ธ.ค.', revenue: 4800000, units: 13, leads: 48, bookings: 9 },
  { date: '15 ธ.ค.', revenue: 6100000, units: 18, leads: 61, bookings: 14 },
  { date: '20 ธ.ค.', revenue: 5800000, units: 16, leads: 58, bookings: 12 },
  { date: '25 ธ.ค.', revenue: 7200000, units: 22, leads: 72, bookings: 18 },
  { date: '30 ธ.ค.', revenue: 6900000, units: 20, leads: 68, bookings: 17 },
];

const SalesOverview = () => {
  const totalRevenue = salesData.reduce((sum, day) => sum + day.revenue, 0);
  const totalUnits = salesData.reduce((sum, day) => sum + day.units, 0);
  const totalLeads = salesData.reduce((sum, day) => sum + day.leads, 0);
  const totalBookings = salesData.reduce((sum, day) => sum + day.bookings, 0);

  const avgConversionRate = ((totalBookings / totalLeads) * 100).toFixed(1);
  const revenueGrowth = 15.3; // Mock growth percentage
  const unitsGrowth = 12.7; // Mock growth percentage

  return (
    <div className="space-y-6">
      {/* Real-time Sales Stats */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900">ภาพรวมการขาย (Real-time)</h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">อัปเดตล่าสุด: 2 นาทีที่แล้ว</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Revenue */}
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ฿{(totalRevenue / 1000000).toFixed(1)}M
            </p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">+{revenueGrowth}%</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">รายได้รวม</p>
          </div>

          {/* Total Units */}
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
              <Home className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">+{unitsGrowth}%</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">จำนวนยูนิต</p>
          </div>

          {/* Total Bookings */}
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <span className="text-sm text-gray-600 font-medium">จาก {totalLeads} Leads</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">การจอง</p>
          </div>

          {/* Conversion Rate */}
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgConversionRate}%</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">+3.2%</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">อัตรา Conversion</p>
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">แนวโน้มรายได้ประจำเดือน</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => `฿${(value/1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: any) => [`฿${(value/1000000).toFixed(2)}M`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Units and Bookings Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Units Chart */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">จำนวนยูนิตที่ขายได้</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="units"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bookings vs Leads */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Leads vs Bookings</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', r: 3 }}
                  name="Leads"
                />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 3 }}
                  name="Bookings"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesOverview;