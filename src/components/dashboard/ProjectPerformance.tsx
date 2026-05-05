import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building2, TrendingUp, DollarSign, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TenantData {
  name: string;
  revenue: number;
  subscriptions: number;
  totalUsers: number;
  avgRevenue: number;
  completion: number;
  status: string;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

const ProjectPerformance = () => {
  const [tenantData, setTenantData] = useState<TenantData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenantPerformance();
  }, []);

  const fetchTenantPerformance = async () => {
    setLoading(true);
    try {
      // Fetch tenant and invoice data
      const [tenantsResult, invoicesResult, usersResult] = await Promise.all([
        supabase.from('tenants').select('id, name, subscription_plan, created_at'),
        supabase.from('invoices').select('tenant_id, amount, status'),
        supabase.from('users').select('tenant_id, id', { count: 'exact' })
      ]);

      const tenants = tenantsResult.data || [];
      const invoices = invoicesResult.data || [];
      const users = usersResult.data || [];

      // Process tenant performance data
      const processedTenants = tenants.map(tenant => {
        const tenantInvoices = invoices.filter(inv => inv.tenant_id === tenant.id);
        const tenantUsers = users.filter(user => user.tenant_id === tenant.id);
        const paidInvoices = tenantInvoices.filter(inv => inv.status === 'paid');

        const revenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const subscriptions = paidInvoices.length;
        const totalUsers = tenantUsers.length;
        const avgRevenue = subscriptions > 0 ? revenue / subscriptions : 0;
        const completion = tenantInvoices.length > 0 ? (paidInvoices.length / tenantInvoices.length) * 100 : 0;

        return {
          name: tenant.name,
          revenue,
          subscriptions,
          totalUsers,
          avgRevenue,
          completion: Number(completion.toFixed(1)),
          status: tenant.subscription_plan
        };
      });

      setTenantData(processedTenants.filter(t => t.revenue > 0));

      // Generate status distribution
      const statusCount = tenants.reduce((acc, tenant) => {
        acc[tenant.subscription_plan] = (acc[tenant.subscription_plan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusColors = {
        starter: '#10b981',
        professional: '#f59e0b',
        enterprise: '#6366f1'
      };

      const statusNames = {
        starter: 'Starter',
        professional: 'Professional',
        enterprise: 'Enterprise'
      };

      const statusDistribution = Object.entries(statusCount)
        .filter(([_, count]) => count > 0)
        .map(([plan, count]) => ({
          name: statusNames[plan as keyof typeof statusNames] || plan,
          value: count,
          color: statusColors[plan as keyof typeof statusColors] || '#6b7280'
        }));

      setStatusData(statusDistribution);

    } catch (error) {
      console.error('Error fetching tenant performance:', error);
      setTenantData([]);
      setStatusData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = tenantData.reduce((sum, tenant) => sum + tenant.revenue, 0);
  const totalSubscriptions = tenantData.reduce((sum, tenant) => sum + tenant.subscriptions, 0);
  const totalUsers = tenantData.reduce((sum, tenant) => sum + tenant.totalUsers, 0);
  const overallCompletion = tenantData.length > 0
    ? (tenantData.reduce((sum, tenant) => sum + tenant.completion, 0) / tenantData.length).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Overview Stats */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900">สรุปผลงานลูกค้า</h3>
          <select className="px-3 py-1 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-chateau">
            <option>เดือนนี้</option>
            <option>ไตรมาสนี้</option>
            <option>ปีนี้</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-chateau-100 rounded-lg mx-auto mb-3">
              <DollarSign className="w-6 h-6 text-chateau" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ฿{totalRevenue.toLocaleString('th-TH')}
            </p>
            <p className="text-xs text-gray-600 mt-1">รายได้รวม</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-3">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalSubscriptions}</p>
            <p className="text-xs text-gray-600 mt-1">การสมัครสมาชิก</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{tenantData.length}</p>
            <p className="text-xs text-gray-600 mt-1">ลูกค้าทั้งหมด</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{overallCompletion}%</p>
            <p className="text-xs text-gray-600 mt-1">อัตราการชำระ</p>
          </div>
        </div>
      </div>

      {/* Project Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">รายได้แยกตามลูกค้า</h3>
          <div className="h-64">
            {tenantData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenantData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickFormatter={(value) => `฿${value.toLocaleString('th-TH')}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`฿${Number(value).toLocaleString('th-TH')}`, 'Revenue']}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                ไม่มีข้อมูลลูกค้า
              </div>
            )}
          </div>
        </div>

        {/* Subscription Plan Distribution */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">แผนการสมัครสมาชิก</h3>
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

      {/* Detailed Tenant Table */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">รายละเอียดลูกค้า</h3>
        <div className="overflow-x-auto">
          {tenantData.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ลูกค้า
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    รายได้
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    การสมัคร
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    รายได้เฉลี่ย
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    อัตราการชำระ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    แผน
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenantData.map((tenant, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tenant.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      ฿{tenant.revenue.toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tenant.subscriptions}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      ฿{tenant.avgRevenue.toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-chateau h-2 rounded-full"
                            style={{ width: `${tenant.completion}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-900">{tenant.completion}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        tenant.status === 'starter'
                          ? 'bg-green-100 text-green-800'
                          : tenant.status === 'professional'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {tenant.status === 'starter' ? 'Starter' :
                         tenant.status === 'professional' ? 'Professional' : 'Enterprise'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              ไม่มีข้อมูลลูกค้า
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectPerformance;