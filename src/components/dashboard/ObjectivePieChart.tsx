import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const data = [
  { name: "เพื่อการลงทุน", value: 19, color: "hsl(276, 42%, 53%)" },
  { name: "เพื่อทำธุรกิจ", value: 15, color: "hsl(340, 82%, 65%)" },
  { name: "ซื้อ", value: 25, color: "hsl(180, 70%, 50%)" },
  { name: "ลงทุนเพิ่ม", value: 20, color: "hsl(45, 93%, 58%)" },
  { name: "ลงทุนธุรกิจ", value: 13, color: "hsl(145, 63%, 49%)" },
  { name: "อื่น", value: 8, color: "hsl(220, 15%, 75%)" },
];

interface ObjectivePieChartProps {
  title: string;
}

export const ObjectivePieChart = ({ title }: ObjectivePieChartProps) => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-xs font-semibold text-foreground mb-2">{title}</h3>
      <div className="flex items-center gap-3">
        <div className="relative w-24 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={40}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-foreground">100%</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px] text-muted-foreground">{item.name}</span>
              <span className="text-[10px] font-bold text-foreground">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
