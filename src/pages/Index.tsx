import { useState } from "react";
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

// Mock Data
const MOCK_UNIT_DATA = [
  { name: 'ว่าง', value: 75, color: '#22d3ee' },
  { name: 'จอง', value: 69, color: '#a78bfa' },
  { name: 'ขาย', value: 90, color: '#ec4899' },
  { name: 'ยกเลิก', value: 25, color: '#fb923c' },
];

const MOCK_PAYMENT_DATA = [
  { name: 'ชำระแล้ว', value: 56, color: '#8b5cf6' },
  { name: 'ค้างชำระ', value: 44, color: '#ec4899' },
];

const MOCK_CUSTOMER_STATUS_DATA = [
  { status: 'SALES 001-01', value: 90, color: '#22d3ee' },
  { status: 'SALES 002-02', value: 85, color: '#8b5cf6' },
  { status: 'SALES 003-03', value: 75, color: '#ec4899' },
  { status: 'SALES 004-04', value: 70, color: '#fb923c' },
  { status: 'SALES 005-05', value: 65, color: '#14b8a6' },
  { status: 'SALES 006-06', value: 60, color: '#06b6d4' },
  { status: 'SALES 007-07', value: 50, color: '#a78bfa' },
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
  { name: 'อยู่อาศัย', value: 31, color: '#22d3ee' },
  { name: 'เก็งกำไร', value: 23, color: '#8b5cf6' },
  { name: 'ปล่อยเช่ารายเดือน', value: 33, color: '#ec4899' },
  { name: 'ปล่อยเช่ารายวัน', value: 12, color: '#fb923c' },
  { name: 'ซ่อมแล้วขาย', value: 17, color: '#14b8a6' },
  { name: 'อื่นๆ', value: 17, color: '#a78bfa' },
];

const MOCK_SOURCE_DATA = [
  { name: 'ออนไลน์', value: 50, color: '#22d3ee' },
  { name: 'ออฟไลน์', value: 33, color: '#8b5cf6' },
  { name: 'อื่นๆ', value: 17, color: '#ec4899' },
];

const MOCK_ONLINE_MEDIA_DATA = [
  { name: 'Google', value: 8, color: '#ec4899' },
  { name: 'YouTube', value: 7, color: '#8b5cf6' },
  { name: 'Instagram', value: 6, color: '#22d3ee' },
  { name: 'LINE', value: 5, color: '#10b981' },
  { name: 'TikTok', value: 5, color: '#f59e0b' },
  { name: 'Facebook', value: 5, color: '#3b82f6' },
  { name: 'Twitter', value: 4, color: '#14b8a6' },
  { name: 'เว็บไซต์', value: 3, color: '#a78bfa' },
  { name: 'อื่นๆ', value: 2, color: '#fb923c' },
];

const MOCK_OFFLINE_MEDIA_DATA = [
  { name: 'ป้ายโฆษณา', value: 8, color: '#ec4899' },
  { name: 'แผ่นพับ', value: 7, color: '#22d3ee' },
  { name: 'สื่อสิ่งพิมพ์', value: 6, color: '#8b5cf6' },
  { name: 'ใบปลิว', value: 5, color: '#14b8a6' },
  { name: 'โทรทัศน์/วิทยุ', value: 5, color: '#f59e0b' },
  { name: 'เพื่อนแนะนำ', value: 4, color: '#10b981' },
  { name: 'อื่นๆ', value: 2, color: '#fb923c' },
];

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('มกราคม');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 space-y-6">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ภาพรวม</h1>
              <p className="text-sm text-gray-500">Overview Dashboard</p>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>โครงการ</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกโครงการ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="baan-issara">BAAN ISSARA</SelectItem>
                      <SelectItem value="project-2">Project 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>วันที่เริ่มต้น</Label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    defaultValue="2024-01-01"
                  />
                </div>
                <div>
                  <Label>วันที่สิ้นสุด</Label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    defaultValue="2024-12-31"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <StatCard icon={Building2} label="จำนวนยูนิตทั้งหมด" value="258" color="cyan" />
            <StatCard icon={CheckCircle} label="ยูนิตจอง" value="69" color="purple" />
            <StatCard icon={Home} label="ยูนิตขาย" value="90" color="pink" />
            <StatCard icon={Clock} label="ยูนิตว่าง" value="75" color="orange" />
            <StatCard icon={Users} label="จำนวน Leads" value="150" color="teal" />
            <StatCard icon={TrendingUp} label="Conversions" value="33" color="blue" />
          </div>

          {/* Second Row Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="จำนวนลูกค้า" value="150" color="purple" />
            <StatCard icon={TrendingUp} label="Conversion Rate" value="89.99%" color="pink" />
            <StatCard icon={UserCheck} label="พนักงานขาย (เปิด)" value="50" color="cyan" />
            <StatCard icon={UserX} label="พนักงานขาย (ปิด)" value="2" color="gray" />
          </div>

          {/* รายงานการขาย */}
          <div>
            <h2 className="text-lg font-semibold mb-4">รายงานการขาย</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Donut Charts */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">สัดส่วนยูนิต</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={MOCK_UNIT_DATA}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {MOCK_UNIT_DATA.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-center mt-2">
                      <div className="text-2xl font-bold">258</div>
                      <div className="text-xs text-gray-500">ยูนิตทั้งหมด</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      {MOCK_UNIT_DATA.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">% ยอดชำระ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={MOCK_PAYMENT_DATA}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {MOCK_PAYMENT_DATA.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-center mt-2">
                      <div className="text-2xl font-bold">56%</div>
                      <div className="text-xs text-gray-500">ชำระแล้ว</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      {MOCK_PAYMENT_DATA.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.name}: {item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Middle Column - Horizontal Bar Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">สถานะลูกค้า</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {MOCK_CUSTOMER_STATUS_DATA.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{item.status}</span>
                          <span className="font-semibold">{item.value}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${item.value}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Right Column - Area Charts */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Customer / Lead</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={MOCK_MONTHLY_CUSTOMER_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="customer" stackId="1" stroke="#8b5cf6" fill="#c4b5fd" />
                        <Area type="monotone" dataKey="leads" stackId="1" stroke="#ec4899" fill="#f9a8d4" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">การจอง / ยกเลิก</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={MOCK_BOOKING_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="booking" stackId="1" stroke="#22d3ee" fill="#a5f3fc" />
                        <Area type="monotone" dataKey="cancel" stackId="1" stroke="#fb923c" fill="#fdba74" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Sales Table */}
          <Card>
            <CardHeader>
              <CardTitle>รายการขาย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">ผู้ซื้อ</th>
                      <th className="px-4 py-3 text-left">โครงการ</th>
                      <th className="px-4 py-3 text-left">ยูนิต</th>
                      <th className="px-4 py-3 text-right">ยอดขาย</th>
                      <th className="px-4 py-3 text-right">ชำระแล้ว</th>
                      <th className="px-4 py-3 text-center">วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_SALES_TABLE_DATA.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-violet-100 text-violet-600">
                                {row.buyer[2]}
                              </AvatarFallback>
                            </Avatar>
                            <span>{row.buyer}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-blue-600">{row.project}</td>
                        <td className="px-4 py-3">{row.unit}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {row.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {row.paid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Purpose & Source Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>วัตถุประสงค์การซื้อ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {MOCK_PURPOSE_DATA.map((item, idx) => (
                    <div key={idx} className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold" style={{ color: item.color }}>
                        {item.value}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{item.name}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>แหล่งที่มาของลูกค้า</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {MOCK_SOURCE_DATA.map((item, idx) => (
                    <div key={idx} className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold" style={{ color: item.color }}>
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
          <Card>
            <CardHeader>
              <CardTitle>วิเคราะห์รายเดือน</CardTitle>
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Purpose Pie Chart */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">วัตถุประสงค์การซื้อ</CardTitle>
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
                                paddingAngle={2}
                                dataKey="value"
                                label
                              >
                                {MOCK_PURPOSE_DATA.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Source Pie Chart */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">แหล่งที่มาของลูกค้า</CardTitle>
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
                                paddingAngle={2}
                                dataKey="value"
                                label
                              >
                                {MOCK_SOURCE_DATA.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Online Media Bar Chart */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">สื่อออนไลน์</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={MOCK_ONLINE_MEDIA_DATA}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
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
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">สื่อออฟไลน์</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={MOCK_OFFLINE_MEDIA_DATA}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
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

// Helper Component for Statistics Cards
interface StatCardProps {
  icon: any;
  label: string;
  value: string;
  color: string;
}

const StatCard = ({ icon: Icon, label, value, color }: StatCardProps) => {
  const colorClasses = {
    cyan: 'from-cyan-500 to-cyan-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600',
    orange: 'from-orange-500 to-orange-600',
    teal: 'from-teal-500 to-teal-600',
    blue: 'from-blue-500 to-blue-600',
    gray: 'from-gray-500 to-gray-600',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-white/80">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Index;
