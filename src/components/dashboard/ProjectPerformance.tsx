import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building2, TrendingUp, DollarSign, Home } from 'lucide-react';

// Mock project performance data
const projectData = [
  {
    name: 'บ้านอิศรา',
    revenue: 68000000,
    unitsSold: 45,
    totalUnits: 120,
    avgPrice: 1511111,
    completion: 37.5,
    status: 'selling'
  },
  {
    name: 'เดอะ โนเบิล',
    revenue: 45000000,
    unitsSold: 28,
    totalUnits: 80,
    avgPrice: 1607143,
    completion: 35.0,
    status: 'selling'
  },
  {
    name: 'ศุภาลัย',
    revenue: 52000000,
    unitsSold: 38,
    totalUnits: 100,
    avgPrice: 1368421,
    completion: 38.0,
    status: 'selling'
  },
  {
    name: 'แลนด์ แอนด์ เฮาส์',
    revenue: 71000000,
    unitsSold: 52,
    totalUnits: 150,
    avgPrice: 1346154,
    completion: 34.7,
    status: 'selling'
  },
  {
    name: 'พรีเมียร์ เอสเตท',
    revenue: 89000000,
    unitsSold: 35,
    totalUnits: 60,
    avgPrice: 2542857,
    completion: 58.3,
    status: 'premium'
  },
];

const statusData = [
  { name: 'กำลังขาย', value: 4, color: '#10b981' },
  { name: 'พรีเมียม', value: 1, color: '#f59e0b' },
  { name: 'ขายหมดแล้ว', value: 0, color: '#6b7280' },
];

const ProjectPerformance = () => {
  const totalRevenue = projectData.reduce((sum, project) => sum + project.revenue, 0);
  const totalUnitsSold = projectData.reduce((sum, project) => sum + project.unitsSold, 0);
  const totalUnits = projectData.reduce((sum, project) => sum + project.totalUnits, 0);
  const overallCompletion = ((totalUnitsSold / totalUnits) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Project Overview Stats */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900">สรุปผลงานโครงการ</h3>
          <select className="px-3 py-1 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option>เดือนนี้</option>
            <option>ไตรมาสนี้</option>
            <option>ปีนี้</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ฿{(totalRevenue / 1000000).toFixed(0)}M
            </p>
            <p className="text-xs text-gray-600 mt-1">รายได้รวม</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
              <Home className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalUnitsSold}</p>
            <p className="text-xs text-gray-600 mt-1">ยูนิตที่ขายได้</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{projectData.length}</p>
            <p className="text-xs text-gray-600 mt-1">โครงการทั้งหมด</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{overallCompletion}%</p>
            <p className="text-xs text-gray-600 mt-1">สัดส่วนการขาย</p>
          </div>
        </div>
      </div>

      {/* Project Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">รายได้แยกตามโครงการ</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(value) => `฿${(value/1000000).toFixed(0)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`฿${(value/1000000).toFixed(1)}M`, 'Revenue']}
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

        {/* Project Status Pie */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">สถานะโครงการ</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
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
            {statusData.map((item) => (
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

      {/* Detailed Project Table */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">รายละเอียดโครงการ</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  โครงการ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  รายได้
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ขายแล้ว/ทั้งหมด
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ราคาเฉลี่ย
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สัดส่วน
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projectData.map((project, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {project.name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ฿{(project.revenue / 1000000).toFixed(1)}M
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.unitsSold}/{project.totalUnits}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ฿{(project.avgPrice / 1000000).toFixed(2)}M
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${project.completion}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">{project.completion}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'selling'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {project.status === 'selling' ? 'กำลังขาย' : 'พรีเมียม'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectPerformance;