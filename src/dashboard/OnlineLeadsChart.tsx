import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { ResponsiveContainer } from '@/components/charts/SmoothResponsiveContainer';

const data = [
  { name: "จุลส์", value: 90 },
  { name: "อุบล", value: 60 },
  { name: "สินดาเลซ", value: 50 },
  { name: "Lazada", value: 40 },
  { name: "ที่ดินศิริ", value: 30 },
  { name: "เครส/เกลา", value: 20 },
  { name: "เว็บไซต์", value: 15 },
  { name: "อื่นๆ", value: 10 },
];

interface OnlineLeadsChartProps {
  title: string;
  color?: string;
}

export const OnlineLeadsChart = ({ title, color = "hsl(180, 70%, 50%)" }: OnlineLeadsChartProps) => {
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
                formatter={((value: any) => `${value}%`) as any}
                style={{ fontSize: '9px', fill: 'hsl(215, 16%, 47%)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
