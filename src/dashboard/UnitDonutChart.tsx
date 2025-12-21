import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const data = [
  { name: "ขายแล้ว", value: 74, color: "hsl(276, 42%, 53%)" },
  { name: "จอง", value: 69, color: "hsl(340, 82%, 65%)" },
  { name: "โอนแล้ว", value: 90, color: "hsl(180, 70%, 50%)" },
  { name: "ยกเลิก", value: 25, color: "hsl(45, 93%, 58%)" },
];

const total = data.reduce((acc, item) => acc + item.value, 0);

export const UnitDonutChart = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground mb-2">จำนวนยูนิต</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
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
            <span className="text-2xl font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">ยูนิตทั้งหมด</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-muted-foreground">{item.name}</span>
              <span className="text-xs font-bold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
