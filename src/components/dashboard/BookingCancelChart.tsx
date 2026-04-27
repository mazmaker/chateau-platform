import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { month: "ม.ค", booking: 25, cancel: 8 },
  { month: "ก.พ", booking: 32, cancel: 12 },
  { month: "มี.ค", booking: 28, cancel: 10 },
  { month: "เม.ย", booking: 45, cancel: 15 },
  { month: "พ.ค", booking: 38, cancel: 18 },
  { month: "มิ.ย", booking: 52, cancel: 20 },
  { month: "ก.ค", booking: 48, cancel: 16 },
  { month: "ส.ค", booking: 42, cancel: 14 },
  { month: "ก.ย", booking: 55, cancel: 22 },
  { month: "ต.ค", booking: 60, cancel: 25 },
  { month: "พ.ย", booking: 58, cancel: 20 },
  { month: "ธ.ค", booking: 65, cancel: 18 },
];

export const BookingCancelChart = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">รายการการจอง / ยกเลิก</h3>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 91%)" vertical={false} />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 10 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 10 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 15%, 91%)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '10px' }}
              iconSize={8}
            />
            <Bar 
              dataKey="booking" 
              name="การจอง"
              fill="hsl(180, 70%, 50%)" 
              radius={[2, 2, 0, 0]}
              barSize={12}
            />
            <Bar 
              dataKey="cancel" 
              name="ยกเลิก"
              fill="hsl(340, 82%, 65%)" 
              radius={[2, 2, 0, 0]}
              barSize={12}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
