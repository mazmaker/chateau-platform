import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, UserCheck, Funnel, Activity } from 'lucide-react';

// Mock customer data
const funnelData = [
  { stage: 'Leads', count: 1250, percentage: 100, color: '#6366f1' },
  { stage: 'Qualified', count: 890, percentage: 71.2, color: '#8b5cf6' },
  { stage: 'Interested', count: 567, percentage: 45.4, color: '#ec4899' },
  { stage: 'Negotiation', count: 234, percentage: 18.7, color: '#f59e0b' },
  { stage: 'Customers', count: 156, percentage: 12.5, color: '#10b981' },
];

const monthlyTrendData = [
  { month: 'ม.ค.', newCustomers: 45, returningCustomers: 12, totalLeads: 189 },
  { month: 'ก.พ.', newCustomers: 52, returningCustomers: 15, totalLeads: 201 },
  { month: 'มี.ค.', newCustomers: 61, returningCustomers: 18, totalLeads: 234 },
  { month: 'เม.ย.', newCustomers: 48, returningCustomers: 14, totalLeads: 198 },
  { month: 'พ.ค.', newCustomers: 73, returningCustomers: 21, totalLeads: 267 },
  { month: 'มิ.ย.', newCustomers: 89, returningCustomers: 25, totalLeads: 312 },
];

const bookingCancelData = [
  { month: 'ม.ค.', bookings: 45, cancellations: 8 },
  { month: 'ก.พ.', bookings: 52, cancellations: 6 },
  { month: 'มี.ค.', bookings: 61, cancellations: 12 },
  { month: 'เม.ย.', bookings: 48, cancellations: 5 },
  { month: 'พ.ค.', bookings: 73, cancellations: 9 },
  { month: 'มิ.ย.', bookings: 89, cancellations: 11 },
];

const customerSegmentData = [
  { name: 'ลูกค้าใหม่', value: 156, color: '#10b981' },
  { name: 'ลูกค้าเก่า', value: 89, color: '#3b82f6' },
  { name: 'ลูกค้ารอการตัดสินใจ', value: 234, color: '#f59e0b' },
  { name: 'สนใจแต่ยังไม่ตัดสินใจ', value: 567, color: '#8b5cf6' },
];

const CustomerStats = () => {
  const totalLeads = funnelData[0].count;
  const totalCustomers = funnelData[funnelData.length - 1].count;
  const overallConversionRate = ((totalCustomers / totalLeads) * 100).toFixed(1);
  const qualifiedLeads = funnelData[1].count;

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
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mx-auto mb-3">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
            <p className="text-xs text-gray-600 mt-1">Leads ทั้งหมด</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
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
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
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