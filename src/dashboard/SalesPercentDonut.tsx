import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const data = [
  { name: "ขายแล้ว", value: 56, color: "hsl(276, 42%, 53%)" },
  { name: "เหลือ", value: 44, color: "hsl(220, 15%, 91%)" },
];

export const SalesPercentDonut = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground mb-2">% ยอดขายทั้งหมด</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={45}
                startAngle={90}
                endAngle={-270}
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
            <span className="text-xl font-bold text-foreground">56%</span>
            <span className="text-[10px] text-muted-foreground">ยอดขาย</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">ขายแล้ว</span>
            <span className="text-xs font-bold text-foreground">56%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-border" />
            <span className="text-xs text-muted-foreground">เหลือ</span>
            <span className="text-xs font-bold text-foreground">44%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
