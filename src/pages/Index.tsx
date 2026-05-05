import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  TrendingUp,
  Building2,
  CheckCircle,
  Clock,
  Home,
  UserCheck,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDashboardStatistics, getSalesChartData, DashboardStats, SalesChartData } from "@/lib/api/dashboard";
import { testDashboardData, getSimpleDashboardStats, getRealisticChartData } from "@/lib/api/dashboard-test";

// Kids Kingdom Color Palette
const KK = {
  red:       '#e60023',
  redLight:  '#fff1f2',
  orange:    '#f97316',
  orangeLight: '#fff7ed',
  green:     '#10b981',
  greenLight: '#f0fdf4',
  blue:      '#3b82f6',
  blueLight: '#eff6ff',
  purple:    '#8b5cf6',
  purpleLight: '#f5f3ff',
  gray:      '#6b7280',
  grayLight: '#f3f4f6',
  border:    '#e5e7eb',
};

const MOCK_UNIT_DATA = [
  { name: 'ว่าง',    value: 75, color: KK.gray },
  { name: 'จอง',    value: 69, color: KK.blue },
  { name: 'ขาย',    value: 90, color: KK.red },
  { name: 'ยกเลิก', value: 25, color: KK.orange },
];

const MOCK_PAYMENT_DATA = [
  { name: 'ชำระแล้ว', value: 56, color: KK.green },
  { name: 'ค้างชำระ', value: 44, color: KK.grayLight },
];

const MOCK_CUSTOMER_STATUS_DATA = [
  { status: 'SALES 001-01', value: 90, color: KK.red },
  { status: 'SALES 002-02', value: 85, color: KK.orange },
  { status: 'SALES 003-03', value: 75, color: KK.blue },
  { status: 'SALES 004-04', value: 70, color: KK.green },
  { status: 'SALES 005-05', value: 65, color: KK.purple },
  { status: 'SALES 006-06', value: 60, color: KK.gray },
  { status: 'SALES 007-07', value: 50, color: KK.red },
];

const MOCK_MONTHLY_CUSTOMER_DATA = [
  { month: 'ม.ค.', customer: 45, conversion: 30, leads: 60 },
  { month: 'ก.พ.', customer: 52, conversion: 35, leads: 65 },
  { month: 'มี.ค.', customer: 61, conversion: 42, leads: 75 },
  { month: 'เม.ย.', customer: 70, conversion: 50, leads: 85 },
  { month: 'พ.ค.', customer: 65, conversion: 45, leads: 80 },
  { month: 'มิ.ย.', customer: 75, conversion: 55, leads: 90 },
  { month: 'ก.ค.', customer: 85, conversion: 65, leads: 100 },
  { month: 'ส.ค.', customer: 80, conversion: 60, leads: 95 },
  { month: 'ก.ย.', customer: 90, conversion: 70, leads: 105 },
  { month: 'ต.ค.', customer: 100, conversion: 80, leads: 115 },
  { month: 'พ.ย.', customer: 95, conversion: 75, leads: 110 },
  { month: 'ธ.ค.', customer: 105, conversion: 85, leads: 120 },
];

const MOCK_SALES_TABLE_DATA = [
  { id: 1, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '24/33', amount: 26432992, paid: 26000250, date: '04-03-24' },
  { id: 2, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '90/38', amount: 27000000, paid: 24000000, date: '04-03-24' },
  { id: 3, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '29/7',  amount: 28356321, paid: 20000000, date: '04-02-24' },
  { id: 4, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '28/7',  amount: 10000000, paid: 17990000, date: '29-01-24' },
  { id: 5, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '28/7',  amount: 8500000,  paid: 8000000,  date: '28-01-24' },
];

const MOCK_PURPOSE_DATA = [
  { name: 'อยู่อาศัย',         value: 31, color: KK.red },
  { name: 'เก็งกำไร',         value: 23, color: KK.blue },
  { name: 'ปล่อยเช่ารายเดือน', value: 33, color: KK.orange },
  { name: 'ปล่อยเช่ารายวัน',   value: 12, color: KK.green },
  { name: 'ซ่อมแล้วขาย',      value: 17, color: KK.purple },
  { name: 'อื่นๆ',             value: 17, color: KK.gray },
];

const MOCK_SOURCE_DATA = [
  { name: 'ออนไลน์', value: 50, color: KK.red },
  { name: 'ออฟไลน์', value: 33, color: KK.blue },
  { name: 'อื่นๆ',   value: 17, color: KK.gray },
];

const MOCK_ONLINE_MEDIA_DATA = [
  { name: 'Google',    value: 8 },
  { name: 'YouTube',   value: 7 },
  { name: 'Instagram', value: 6 },
  { name: 'LINE',      value: 5 },
  { name: 'TikTok',   value: 5 },
  { name: 'Facebook',  value: 5 },
  { name: 'Twitter',   value: 4 },
  { name: 'เว็บไซต์',  value: 3 },
  { name: 'อื่นๆ',     value: 2 },
];

const MOCK_OFFLINE_MEDIA_DATA = [
  { name: 'ป้ายโฆษณา',    value: 8 },
  { name: 'แผ่นพับ',      value: 7 },
  { name: 'สื่อสิ่งพิมพ์', value: 6 },
  { name: 'ใบปลิว',       value: 5 },
  { name: 'โทรทัศน์/วิทยุ', value: 5 },
  { name: 'เพื่อนแนะนำ',  value: 4 },
  { name: 'อื่นๆ',         value: 2 },
];

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const tooltipStyle = {
  backgroundColor: 'white',
  border: `1px solid ${KK.border}`,
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
};

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [salesChartData, setSalesChartData] = useState<SalesChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        const [stats, chartData] = await Promise.all([
          getDashboardStatistics(),
          getSalesChartData(),
        ]);
        setDashboardStats(stats);
        setSalesChartData(chartData);
      } catch {
        try {
          await testDashboardData();
          const stats = await getSimpleDashboardStats();
          const chartData = await getRealisticChartData();
          setDashboardStats({ projects: stats.projects, units: stats.units, leads: stats.leads });
          setSalesChartData(chartData);
        } catch {
          setDashboardStats({
            projects: { total: 20, completed: 5, inProgress: 15 },
            units: { reserved: 69, sold: 90, available: 75, conversionRate: 67.8 },
            leads: { newLeads: 42, convertedToCustomers: 18, totalLeads: 167 },
          });
          setSalesChartData({
            unitDistribution: MOCK_UNIT_DATA,
            paymentStatus: MOCK_PAYMENT_DATA,
            customerStatus: [],
            monthlyData: [],
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-4 lg:p-6 space-y-4 lg:space-y-6">

          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Overview Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">ภาพรวมระบบ CHATEAU Platform</p>
            </div>
            <Button style={{ backgroundColor: KK.red, color: '#fff', border: 'none' }} className="rounded-lg text-sm">
              + เพิ่มข้อมูล
            </Button>
          </div>

          {/* Filters */}
          <Card className="bg-white border border-gray-200 rounded-xl shadow-soft">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1.5 block">โครงการ</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="h-9 rounded-lg border-gray-200 text-sm focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': KK.red + '33' } as React.CSSProperties}>
                      <SelectValue placeholder="เลือกโครงการ" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200 shadow-soft-lg">
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="baan-issara">BAAN ISSARA</SelectItem>
                      <SelectItem value="project-2">Project 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1.5 block">วันที่เริ่มต้น</Label>
                  <input
                    type="date"
                    defaultValue="2024-01-01"
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                    style={{ '--tw-ring-color': KK.red + '33' } as React.CSSProperties}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1.5 block">วันที่สิ้นสุด</Label>
                  <input
                    type="date"
                    defaultValue="2024-12-31"
                    className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                    style={{ '--tw-ring-color': KK.red + '33' } as React.CSSProperties}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* === KPI Stats === */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: KK.red }} />
              <span className="ml-2 text-sm text-gray-500">กำลังโหลดข้อมูล...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {/* โครงการ */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" style={{ color: KK.red }} />
                  สถิติโครงการอสังหา
                </h3>
                <div className="space-y-2.5">
                  <KPICard icon={Building2} label="โครงการทั้งหมด"   value={dashboardStats?.projects.total.toString() || "0"}      bg={KK.redLight}    color={KK.red} />
                  <KPICard icon={CheckCircle} label="เสร็จสิ้นแล้ว"  value={dashboardStats?.projects.completed.toString() || "0"}   bg={KK.greenLight}  color={KK.green} />
                  <KPICard icon={Clock}       label="กำลังดำเนินการ" value={dashboardStats?.projects.inProgress.toString() || "0"}  bg={KK.orangeLight} color={KK.orange} />
                </div>
              </div>

              {/* ยูนิตและการขาย */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Home className="w-4 h-4" style={{ color: KK.blue }} />
                  สถานะยูนิตและการขาย
                </h3>
                <div className="space-y-2.5">
                  <KPICard icon={ShoppingCart} label="ยูนิตจอง"   value={dashboardStats?.units.reserved.toString() || "0"}                 bg={KK.blueLight}   color={KK.blue} />
                  <KPICard icon={CheckCircle}  label="ยูนิตขาย"   value={dashboardStats?.units.sold.toString() || "0"}                      bg={KK.redLight}    color={KK.red} />
                  <KPICard icon={Home}         label="ยูนิตว่าง"   value={dashboardStats?.units.available.toString() || "0"}                 bg={KK.grayLight}   color={KK.gray} />
                  <KPICard icon={TrendingUp}   label="อัตราแปลง"  value={`${dashboardStats?.units.conversionRate || 0}%`}                   bg={KK.purpleLight} color={KK.purple} />
                </div>
              </div>

              {/* ลูกค้าและ Leads */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Users className="w-4 h-4" style={{ color: KK.orange }} />
                  ลูกค้าและ Leads
                </h3>
                <div className="space-y-2.5">
                  <KPICard icon={Users}     label="Leads ใหม่"       value={dashboardStats?.leads.newLeads.toString() || "0"}              bg={KK.redLight}   color={KK.red} />
                  <KPICard icon={UserCheck} label="แปลงเป็นลูกค้า"  value={dashboardStats?.leads.convertedToCustomers.toString() || "0"}  bg={KK.greenLight} color={KK.green} />
                </div>
              </div>
            </div>
          )}

          {/* รายงานการขาย */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">รายงานการขาย</h2>
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="w-full bg-white animate-pulse rounded-xl">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-100 rounded mb-4 w-1/2" />
                      <div className="h-40 bg-gray-100 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

                {/* สัดส่วนยูนิต */}
                <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-gray-800">สัดส่วนยูนิต</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={salesChartData?.unitDistribution || MOCK_UNIT_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={78} paddingAngle={3} dataKey="value">
                          {(salesChartData?.unitDistribution || MOCK_UNIT_DATA).map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {(salesChartData?.unitDistribution || MOCK_UNIT_DATA).map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-xs text-gray-600">{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* สถานะลูกค้า */}
                <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-gray-800">สถานะลูกค้า</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-2.5">
                      {(salesChartData?.customerStatus || MOCK_CUSTOMER_STATUS_DATA).map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-24 flex-shrink-0">{item.status}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-800 w-6 text-right">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* % ยอดชำระ */}
                <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-gray-800">% ยอดชำระ</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={salesChartData?.paymentStatus || MOCK_PAYMENT_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={78} paddingAngle={3} dataKey="value">
                          {(salesChartData?.paymentStatus || MOCK_PAYMENT_DATA).map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-2">
                      {(salesChartData?.paymentStatus || MOCK_PAYMENT_DATA).map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs text-gray-600">{item.name}: {item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Customer / Lead */}
                <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-gray-800">Customer / Lead</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={salesChartData?.monthlyData?.length ? salesChartData.monthlyData : MOCK_MONTHLY_CUSTOMER_DATA}>
                        <defs>
                          <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={KK.red}    stopOpacity={0.15} />
                            <stop offset="95%" stopColor={KK.red}    stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={KK.orange} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={KK.orange} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="customer" stroke={KK.red}    strokeWidth={2} fill="url(#gradRed)"    dot={false} />
                        <Area type="monotone" dataKey="leads"    stroke={KK.orange} strokeWidth={2} fill="url(#gradOrange)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-1">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.red }} /><span className="text-xs text-gray-500">Customer</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.orange }} /><span className="text-xs text-gray-500">Leads</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* การจอง / ยกเลิก */}
                <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-gray-800">การจอง / ยกเลิก</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={salesChartData?.monthlyData?.length ? salesChartData.monthlyData : MOCK_MONTHLY_CUSTOMER_DATA}>
                        <defs>
                          <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={KK.green} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={KK.green} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradGray" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={KK.gray} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={KK.gray} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="booking" stroke={KK.green} strokeWidth={2} fill="url(#gradGreen)" dot={false} />
                        <Area type="monotone" dataKey="cancel"  stroke={KK.gray}  strokeWidth={2} fill="url(#gradGray)"  dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-1">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.green }} /><span className="text-xs text-gray-500">จอง</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.gray }} /><span className="text-xs text-gray-500">ยกเลิก</span></div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </div>

          {/* Sales Table */}
          <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-gray-800">รายการขาย</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">ผู้ซื้อ</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">โครงการ</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">ยูนิต</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">ยอดขาย</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">ชำระแล้ว</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500">วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_SALES_TABLE_DATA.map((row) => (
                      <tr key={row.id} className="border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7">
                              <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: KK.red }}>
                                {row.buyer[2]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-gray-800 text-xs">{row.buyer}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs font-medium text-gray-700">{row.project}</td>
                        <td className="px-5 py-3 text-xs text-gray-600">{row.unit}</td>
                        <td className="px-5 py-3 text-right text-xs font-semibold text-gray-900">{row.amount.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-xs font-semibold" style={{ color: KK.green }}>{row.paid.toLocaleString()}</td>
                        <td className="px-5 py-3 text-center text-xs text-gray-500">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Purpose & Source */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-gray-800">วัตถุประสงค์การซื้อ</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {MOCK_PURPOSE_DATA.map((item, i) => (
                    <div key={i} className="text-center p-3 border border-gray-100 rounded-xl hover:shadow-soft transition-shadow" style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}>
                      <div className="text-xl font-bold" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.name}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-gray-800">แหล่งที่มาของลูกค้า</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {MOCK_SOURCE_DATA.map((item, i) => (
                    <div key={i} className="text-center p-3 border border-gray-100 rounded-xl" style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}>
                      <div className="text-xl font-bold" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.name}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Analysis */}
          <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-gray-800">วิเคราะห์รายเดือน</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <Tabs defaultValue={MONTHS[0]} className="w-full">
                <TabsList className="grid grid-cols-6 md:grid-cols-12 h-auto gap-0.5 bg-gray-100 p-0.5 rounded-lg">
                  {MONTHS.map((month) => (
                    <TabsTrigger key={month} value={month} className="text-xs px-1 py-1 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      {month.substring(0, 3)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {MONTHS.map((month) => (
                  <TabsContent key={month} value={month} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                      {/* Purpose Pie */}
                      <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                        <CardHeader className="pb-1 pt-4 px-5">
                          <CardTitle className="text-sm font-semibold text-gray-800">วัตถุประสงค์การซื้อ</CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie data={MOCK_PURPOSE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                                {MOCK_PURPOSE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {MOCK_PURPOSE_DATA.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-gray-600 truncate">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Source Pie */}
                      <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                        <CardHeader className="pb-1 pt-4 px-5">
                          <CardTitle className="text-sm font-semibold text-gray-800">แหล่งที่มาของลูกค้า</CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie data={MOCK_SOURCE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                                {MOCK_SOURCE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex justify-center gap-4 mt-2">
                            {MOCK_SOURCE_DATA.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-gray-600">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Online Media Bar */}
                      <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                        <CardHeader className="pb-1 pt-4 px-5">
                          <CardTitle className="text-sm font-semibold text-gray-800">สื่อออนไลน์</CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={MOCK_ONLINE_MEDIA_DATA}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-40} textAnchor="end" height={72} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="value" fill={KK.red} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Offline Media Bar */}
                      <Card className="bg-white border border-gray-100 rounded-xl shadow-soft">
                        <CardHeader className="pb-1 pt-4 px-5">
                          <CardTitle className="text-sm font-semibold text-gray-800">สื่อออฟไลน์</CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={MOCK_OFFLINE_MEDIA_DATA}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-40} textAnchor="end" height={72} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="value" fill={KK.blue} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  );
};

// KPI Card — Kids Kingdom style
interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  bg: string;
  color: string;
}

const KPICard = ({ icon: Icon, label, value, bg, color }: KPICardProps) => (
  <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-soft flex items-center gap-3 hover:shadow-soft-lg transition-shadow">
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
      <Icon className="w-4 h-4" style={{ color }} strokeWidth={2} />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-bold text-gray-900 leading-tight">{value}</div>
      <div className="text-xs text-gray-500 truncate">{label}</div>
    </div>
  </div>
);

export default Index;
