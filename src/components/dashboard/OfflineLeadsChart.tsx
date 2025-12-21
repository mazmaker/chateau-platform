import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const data = [
  { name: "ป้ายหมู่บ้าน", value: 80 },
  { name: "แผ่นพับ", value: 70 },
  { name: "ส่งทีเผยแพร่", value: 60 },
  { name: "โปสเตอร์", value: 40 },
  { name: "วิทยุ", value: 30 },
  { name: "เพื่อนแนะนำ", value: 20 },
  { name: "อื่น", value: 10 },
  { name: "อื่น", value: 5 },
];

interface OfflineLeadsChartProps {
  title: string;
  color?: string;
}

export const OfflineLeadsChart = ({ title, color = "hsl(340, 82%, 65%)" }: OfflineLeadsChartProps) => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-xs font-semibold text-foreground mb-4">{title}</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 91%)" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 9 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 10 }}
              domain={[0, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 15%, 91%)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Bar 
              dataKey="value" 
              fill={color}
              radius={[4, 4, 0, 0]}
              barSize={20}
            >
              <LabelList 
                dataKey="value" 
                position="top" 
                formatter={(value: any) => `${value}%`}
                style={{ fontSize: '9px', fill: 'hsl(215, 16%, 47%)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
