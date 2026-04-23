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
  Calendar,
  UserCheck,
  UserX,
  ShoppingCart,
  XCircle,
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
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDashboardStatistics, getSalesChartData, DashboardStats, SalesChartData } from "@/lib/api/dashboard";
import { testDashboardData, getSimpleDashboardStats, getRealisticChartData } from "@/lib/api/dashboard-test";

// Mock Data with Luxury Color Palette
const MOCK_UNIT_DATA = [
  { name: 'ว่าง', value: 75, color: '#6b7280' },      // Luxury Gray
  { name: 'จอง', value: 69, color: '#8b5a2b' },      // Warm Brown
  { name: 'ขาย', value: 90, color: '#ca8a04' },      // Royal Gold
  { name: 'ยกเลิก', value: 25, color: '#1c1917' },  // Charcoal Gray
];

const MOCK_PAYMENT_DATA = [
  { name: 'ชำระแล้ว', value: 56, color: '#ca8a04' },  // Royal Gold
  { name: 'ค้างชำระ', value: 44, color: '#6b7280' },  // Luxury Gray
];

const MOCK_CUSTOMER_STATUS_DATA = [
  { status: 'SALES 001-01', value: 90, color: '#ca8a04' },  // Royal Gold
  { status: 'SALES 002-02', value: 85, color: '#1c1917' },  // Charcoal Gray
  { status: 'SALES 003-03', value: 75, color: '#8b5a2b' },  // Warm Brown
  { status: 'SALES 004-04', value: 70, color: '#6b7280' },  // Luxury Gray
  { status: 'SALES 005-05', value: 65, color: '#ca8a04' },  // Royal Gold
  { status: 'SALES 006-06', value: 60, color: '#1c1917' },  // Charcoal Gray
  { status: 'SALES 007-07', value: 50, color: '#8b5a2b' },  // Warm Brown
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

const MOCK_BOOKING_DATA = [
  { month: 'ม.ค.', booking: 50, cancel: 10 },
  { month: 'ก.พ.', booking: 55, cancel: 12 },
  { month: 'มี.ค.', booking: 60, cancel: 15 },
  { month: 'เม.ย.', booking: 65, cancel: 18 },
  { month: 'พ.ค.', booking: 58, cancel: 14 },
  { month: 'มิ.ย.', booking: 70, cancel: 20 },
  { month: 'ก.ค.', booking: 75, cancel: 22 },
  { month: 'ส.ค.', booking: 72, cancel: 19 },
  { month: 'ก.ย.', booking: 80, cancel: 25 },
  { month: 'ต.ค.', booking: 85, cancel: 28 },
  { month: 'พ.ย.', booking: 82, cancel: 24 },
  { month: 'ธ.ค.', booking: 90, cancel: 30 },
];

const MOCK_SALES_TABLE_DATA = [
  { id: 1, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '24/33', amount: 26432992, paid: 26000250, date: '04-03-24' },
  { id: 2, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '90/38', amount: 27000000, paid: 24000000, date: '04-03-24' },
  { id: 3, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '29/7', amount: 28356321, paid: 20000000, date: '04-02-24' },
  { id: 4, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '28/7', amount: 10000000, paid: 17990000, date: '29-01-24' },
  { id: 5, buyer: 'คุณวิน ศรีธนพล', project: 'BAAN ISSARA', unit: '28/7', amount: 8500000, paid: 8000000, date: '28-01-24' },
];

const MOCK_PURPOSE_DATA = [
  { name: 'อยู่อาศัย', value: 31, color: '#ca8a04' },     // Royal Gold
  { name: 'เก็งกำไร', value: 23, color: '#1c1917' },     // Charcoal Gray
  { name: 'ปล่อยเช่ารายเดือน', value: 33, color: '#8b5a2b' },  // Warm Brown
  { name: 'ปล่อยเช่ารายวัน', value: 12, color: '#6b7280' },   // Luxury Gray
  { name: 'ซ่อมแล้วขาย', value: 17, color: '#ca8a04' },  // Royal Gold
  { name: 'อื่นๆ', value: 17, color: '#8b5a2b' },        // Warm Brown
];

const MOCK_SOURCE_DATA = [
  { name: 'ออนไลน์', value: 50, color: '#ca8a04' },     // Royal Gold
  { name: 'ออฟไลน์', value: 33, color: '#1c1917' },     // Charcoal Gray
  { name: 'อื่นๆ', value: 17, color: '#6b7280' },       // Luxury Gray
];

const MOCK_ONLINE_MEDIA_DATA = [
  { name: 'Google', value: 8, color: '#ca8a04' },      // Royal Gold
  { name: 'YouTube', value: 7, color: '#1c1917' },     // Charcoal Gray
  { name: 'Instagram', value: 6, color: '#8b5a2b' },   // Warm Brown
  { name: 'LINE', value: 5, color: '#6b7280' },        // Luxury Gray
  { name: 'TikTok', value: 5, color: '#ca8a04' },      // Royal Gold
  { name: 'Facebook', value: 5, color: '#1c1917' },    // Charcoal Gray
  { name: 'Twitter', value: 4, color: '#8b5a2b' },     // Warm Brown
  { name: 'เว็บไซต์', value: 3, color: '#6b7280' },     // Luxury Gray
  { name: 'อื่นๆ', value: 2, color: '#ca8a04' },        // Royal Gold
];

const MOCK_OFFLINE_MEDIA_DATA = [
  { name: 'ป้ายโฆษณา', value: 8, color: '#ca8a04' },    // Royal Gold
  { name: 'แผ่นพับ', value: 7, color: '#1c1917' },      // Charcoal Gray
  { name: 'สื่อสิ่งพิมพ์', value: 6, color: '#8b5a2b' }, // Warm Brown
  { name: 'ใบปลิว', value: 5, color: '#6b7280' },       // Luxury Gray
  { name: 'โทรทัศน์/วิทยุ', value: 5, color: '#ca8a04' }, // Royal Gold
  { name: 'เพื่อนแนะนำ', value: 4, color: '#1c1917' },  // Charcoal Gray
  { name: 'อื่นๆ', value: 2, color: '#8b5a2b' },         // Warm Brown
];

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('มกราคม');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [salesChartData, setSalesChartData] = useState<SalesChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        console.log('🔄 Loading real dashboard data...');

        // Use real API functions to get data from database
        const [stats, chartData] = await Promise.all([
          getDashboardStatistics(),
          getSalesChartData(),
        ]);

        console.log('✅ Dashboard data loaded successfully');

        setDashboardStats(stats);
        setSalesChartData(chartData);

      } catch (error) {
        console.error('❌ Error loading dashboard data:', error);

        // If real data fails, use test functions as fallback
        console.log('🔄 Trying fallback methods...');

        try {
          await testDashboardData();
          const stats = await getSimpleDashboardStats();
          const chartData = await getRealisticChartData();

          const dashboardStats: DashboardStats = {
            projects: stats.projects,
            units: stats.units,
            leads: stats.leads,
          };

          setDashboardStats(dashboardStats);
          setSalesChartData(chartData);

          console.log('⚠️ Using fallback data due to:', error.message);

        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);

          // Ultimate fallback with realistic data
          setDashboardStats({
            projects: { total: 20, completed: 5, inProgress: 15 },
            units: { reserved: 69, sold: 90, available: 75, conversionRate: 67.8 },
            leads: { newLeads: 42, convertedToCustomers: 18, totalLeads: 167 },
          });

          setSalesChartData({
            unitDistribution: [
              { name: 'ว่าง', value: 75, color: '#6b7280' },
              { name: 'จอง', value: 69, color: '#8b5a2b' },
              { name: 'ขาย', value: 90, color: '#ca8a04' },
              { name: 'ไม่พร้อมขาย', value: 0, color: '#1c1917' },
            ],
            paymentStatus: [
              { name: 'ชำระแล้ว', value: 108, color: '#ca8a04' },
              { name: 'ค้างชำระ', value: 51, color: '#6b7280' },
            ],
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

        <main className="p-4 lg:p-6 space-y-4 lg:space-y-6 bg-background">
          {/* Page Title */}
          <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow duration-300" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
            <CardContent className="p-4 lg:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center shadow-xl">
                    <TrendingUp className="w-6 h-6 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Overview Dashboard</h1>
                    <p className="text-sm text-gray-600 font-medium">ภาพรวมระบบ</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow duration-300" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">โครงการ</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 hover:border-gray-400 transition-all duration-200">
                      <SelectValue placeholder="เลือกโครงการ" className="text-gray-900" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200 rounded-xl shadow-xl z-50">
                      <SelectItem value="all" className="text-gray-900 hover:bg-gray-50 focus:bg-amber-50 focus:text-amber-900 rounded-lg mx-1 my-1">ทั้งหมด</SelectItem>
                      <SelectItem value="baan-issara" className="text-gray-900 hover:bg-gray-50 focus:bg-amber-50 focus:text-amber-900 rounded-lg mx-1 my-1">BAAN ISSARA</SelectItem>
                      <SelectItem value="project-2" className="text-gray-900 hover:bg-gray-50 focus:bg-amber-50 focus:text-amber-900 rounded-lg mx-1 my-1">Project 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">วันที่เริ่มต้น</Label>
                  <input
                    type="date"
                    className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 hover:border-gray-400 transition-all duration-200"
                    defaultValue="2024-01-01"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">วันที่สิ้นสุด</Label>
                  <input
                    type="date"
                    className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 hover:border-gray-400 transition-all duration-200"
                    defaultValue="2024-12-31"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* === Dashboard Statistics === */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-600">กำลังโหลดข้อมูล...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {/* Project Overview */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" style={{ color: '#1c1917' }} />
                  สถิติโครงการอสังหา
                </h3>
                <div className="space-y-3">
                  <LuxuryKPICard
                    icon={Building2}
                    label="โครงการทั้งหมด"
                    value={dashboardStats?.projects.total.toString() || "0"}
                    iconColor="#1c1917"
                  />
                  <LuxuryKPICard
                    icon={CheckCircle}
                    label="เสร็จสิ้นแล้ว"
                    value={dashboardStats?.projects.completed.toString() || "0"}
                    iconColor="#ca8a04"
                  />
                  <LuxuryKPICard
                    icon={Clock}
                    label="กำลังดำเนินการ"
                    value={dashboardStats?.projects.inProgress.toString() || "0"}
                    iconColor="#6b7280"
                  />
                </div>
              </div>

              {/* Sales & Units */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Home className="w-5 h-5" style={{ color: '#8b5a2b' }} />
                  สถานะยูนิตและการขาย
                </h3>
                <div className="space-y-3">
                  <LuxuryKPICard
                    icon={ShoppingCart}
                    label="ยูนิตจอง"
                    value={dashboardStats?.units.reserved.toString() || "0"}
                    iconColor="#8b5a2b"
                  />
                  <LuxuryKPICard
                    icon={CheckCircle}
                    label="ยูนิตขาย"
                    value={dashboardStats?.units.sold.toString() || "0"}
                    iconColor="#ca8a04"
                  />
                  <LuxuryKPICard
                    icon={Home}
                    label="ยูนิตว่าง"
                    value={dashboardStats?.units.available.toString() || "0"}
                    iconColor="#6b7280"
                  />
                  <LuxuryKPICard
                    icon={TrendingUp}
                    label="อัตราแปลง"
                    value={`${dashboardStats?.units.conversionRate || 0}%`}
                    iconColor="#1c1917"
                  />
                </div>
              </div>

              {/* Customer & Leads */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" style={{ color: '#ca8a04' }} />
                  ลูกค้าและ Leads
                </h3>
                <div className="space-y-3">
                  <LuxuryKPICard
                    icon={Users}
                    label="Leads ใหม่"
                    value={dashboardStats?.leads.newLeads.toString() || "0"}
                    iconColor="#ca8a04"
                  />
                  <LuxuryKPICard
                    icon={UserCheck}
                    label="แปลงเป็นลูกค้า"
                    value={dashboardStats?.leads.convertedToCustomers.toString() || "0"}
                    iconColor="#1c1917"
                  />
                </div>
              </div>
            </div>
          )}

          {/* รายงานการขาย */}
          <div>
            <h2 className="text-lg font-semibold mb-6 text-gray-900">รายงานการขาย</h2>
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="w-full bg-white animate-pulse" style={{ borderRadius: '12px' }}>
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-4"></div>
                      <div className="h-32 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">

              {/* สัดส่วนยูนิต */}
              <Card className="w-full bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900">สัดส่วนยูนิต</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={salesChartData?.unitDistribution || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(salesChartData?.unitDistribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-2">
                    <div className="text-2xl font-bold text-gray-900">
                      {(salesChartData?.unitDistribution || []).reduce((sum, item) => sum + item.value, 0)}
                    </div>
                    <div className="text-xs text-gray-600">ยูนิตทั้งหมด</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    {(salesChartData?.unitDistribution || []).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-700">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* สถานะลูกค้า */}
              <Card className="w-full bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900">สถานะลูกค้า</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(salesChartData?.customerStatus || []).map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">{item.status}</span>
                        <div className="flex items-center gap-2 flex-1 ml-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${item.value}%`,
                                backgroundColor: item.color
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold w-8 text-right text-gray-900">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* % ยอดชำระ */}
              <Card className="w-full bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900">% ยอดชำระ</CardTitle>
                </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={salesChartData?.paymentStatus || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {(salesChartData?.paymentStatus || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-center mt-2">
                      <div className="text-2xl font-bold text-gray-900">
                        {salesChartData?.paymentStatus?.[0]?.value || 0}%
                      </div>
                      <div className="text-xs text-gray-600">ชำระแล้ว</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      {(salesChartData?.paymentStatus || []).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-700">{item.name}: {item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              {/* Customer / Lead */}
              <Card className="w-full bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900">Customer / Lead</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={salesChartData?.monthlyData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Area type="monotone" dataKey="customer" stackId="1" stroke="#1c1917" fill="#1c1917" fillOpacity={0.8} />
                      <Area type="monotone" dataKey="leads" stackId="1" stroke="#ca8a04" fill="#ca8a04" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* การจอง / ยกเลิก */}
              <Card className="w-full bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900">การจอง / ยกเลิก</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={salesChartData?.monthlyData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Area type="monotone" dataKey="booking" stackId="1" stroke="#ca8a04" fill="#ca8a04" fillOpacity={0.8} />
                      <Area type="monotone" dataKey="cancel" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              </div>
            )}
          </div>

          {/* Sales Table */}
          <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
            <CardHeader>
              <CardTitle className="text-gray-900">รายการขาย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b-2 border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">ผู้ซื้อ</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">โครงการ</th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-900">ยูนิต</th>
                      <th className="px-6 py-4 text-right font-semibold text-gray-900">ยอดขาย</th>
                      <th className="px-6 py-4 text-right font-semibold text-gray-900">ชำระแล้ว</th>
                      <th className="px-6 py-4 text-center font-semibold text-gray-900">วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_SALES_TABLE_DATA.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors duration-300">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback
                                className="text-white font-medium"
                                style={{ backgroundColor: '#ca8a04' }}
                              >
                                {row.buyer[2]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-gray-900">{row.buyer}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium" style={{ color: '#1c1917' }}>{row.project}</td>
                        <td className="px-6 py-4 text-gray-700">{row.unit}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {row.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-medium" style={{ color: '#ca8a04' }}>
                          {row.paid.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-500">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Purpose & Source Statistics */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
              <CardHeader>
                <CardTitle className="text-gray-900">วัตถุประสงค์การซื้อ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                  {MOCK_PURPOSE_DATA.map((item, idx) => (
                    <div key={idx} className="text-center p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                      <div className="text-2xl font-bold text-gray-900" style={{ color: item.color }}>
                        {item.value}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{item.name}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
              <CardHeader>
                <CardTitle className="text-gray-900">แหล่งที่มาของลูกค้า</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                  {MOCK_SOURCE_DATA.map((item, idx) => (
                    <div key={idx} className="text-center p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                      <div className="text-2xl font-bold text-gray-900" style={{ color: item.color }}>
                        {item.value}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{item.name}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Analysis Tabs */}
          <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
            <CardHeader>
              <CardTitle className="text-gray-900">วิเคราะห์รายเดือน</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={MONTHS[0]} className="w-full">
                <TabsList className="grid grid-cols-6 md:grid-cols-12 gap-1 h-auto">
                  {MONTHS.map((month) => (
                    <TabsTrigger key={month} value={month} className="text-xs px-2 py-1">
                      {month.substring(0, 3)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {MONTHS.map((month) => (
                  <TabsContent key={month} value={month} className="space-y-6 mt-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                      {/* Purpose Pie Chart */}
                      <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold text-gray-900">วัตถุประสงค์การซื้อ</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={MOCK_PURPOSE_DATA}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label
                              >
                                {MOCK_PURPOSE_DATA.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Source Pie Chart */}
                      <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold text-gray-900">แหล่งที่มาของลูกค้า</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={MOCK_SOURCE_DATA}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label
                              >
                                {MOCK_SOURCE_DATA.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Online Media Bar Chart */}
                      <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold text-gray-900">สื่อออนไลน์</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={MOCK_ONLINE_MEDIA_DATA}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: '#6b7280' }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                axisLine={{ stroke: '#e5e7eb' }}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: '#6b7280' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {MOCK_ONLINE_MEDIA_DATA.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Offline Media Bar Chart */}
                      <Card className="bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold text-gray-900">สื่อออฟไลน์</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={MOCK_OFFLINE_MEDIA_DATA}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: '#6b7280' }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                axisLine={{ stroke: '#e5e7eb' }}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: '#6b7280' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {MOCK_OFFLINE_MEDIA_DATA.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
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

// Luxury KPI Card Component
interface LuxuryKPICardProps {
  icon: any;
  label: string;
  value: string;
  iconColor: string;
}

const LuxuryKPICard = ({ icon: Icon, label, value, iconColor }: LuxuryKPICardProps) => {
  // Function to get the appropriate gradient background based on color category
  const getGradientBackground = (color: string) => {
    switch (color) {
      case '#ca8a04': // Royal Gold/Success stats
        return 'bg-gradient-to-br from-amber-600 to-amber-700';
      case '#6b7280': // Luxury Gray/Neutral stats
        return 'bg-gradient-to-br from-gray-600 to-gray-700';
      case '#8b5a2b': // Warm Brown/Secondary stats
        return 'bg-gradient-to-br from-amber-800 to-amber-900';
      case '#1c1917': // Charcoal/Primary stats
      default:
        return 'bg-gradient-to-br from-gray-800 to-gray-900';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow duration-300" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${getGradientBackground(iconColor)}`}>
          <Icon
            className="w-5 h-5 text-white"
            strokeWidth={2}
          />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-600">{label}</div>
        </div>
      </div>
    </div>
  );
};

// Compact KPI Card Component for smaller cards
interface CompactKPICardProps {
  icon: any;
  label: string;
  value: string;
  iconColor: string;
}

const CompactKPICard = ({ icon: Icon, label, value, iconColor }: CompactKPICardProps) => {
  // Function to get the appropriate gradient background based on color category
  const getGradientBackground = (color: string) => {
    switch (color) {
      case '#ca8a04': // Royal Gold/Success stats
        return 'bg-gradient-to-br from-amber-600 to-amber-700';
      case '#6b7280': // Luxury Gray/Neutral stats
        return 'bg-gradient-to-br from-gray-600 to-gray-700';
      case '#8b5a2b': // Warm Brown/Secondary stats
        return 'bg-gradient-to-br from-amber-800 to-amber-900';
      case '#1c1917': // Charcoal/Primary stats
      default:
        return 'bg-gradient-to-br from-gray-800 to-gray-900';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow duration-300" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${getGradientBackground(iconColor)}`}>
          <Icon
            className="w-5 h-5 text-white"
            strokeWidth={2}
          />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold text-gray-900 truncate">{value}</div>
          <div className="text-xs text-gray-600 truncate">{label}</div>
        </div>
      </div>
    </div>
  );
};

export default Index;
