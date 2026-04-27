import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

const data = [
  { name: "BAAN ISSARA", percent: 35, value: 65000000, color: "hsl(276, 42%, 53%)" },
  { name: "BAAN ISSARA", percent: 28, value: 25000000, color: "hsl(180, 70%, 50%)" },
  { name: "BAAN ISSARA", percent: 23, value: 23000000, color: "hsl(340, 82%, 65%)" },
  { name: "BAAN ISSARA", percent: 16, value: 10000000, color: "hsl(45, 93%, 58%)" },
  { name: "BAAN ISSARA", percent: 0, value: 0, color: "hsl(220, 15%, 85%)" },
  { name: "BAAN ISSARA", percent: 0, value: 0, color: "hsl(220, 15%, 85%)" },
  { name: "BAAN ISSARA", percent: 0, value: 0, color: "hsl(220, 15%, 85%)" },
];

export const ProjectSalesBar = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">ยอดขาย และ % ยอดการขายแต่ละแบบบ้าน</h3>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-muted-foreground truncate">{item.name}</span>
            <div 
              className="px-2 py-0.5 rounded text-white text-[10px] font-medium min-w-[32px] text-center"
              style={{ backgroundColor: item.color }}
            >
              {item.percent}%
            </div>
            <div className="flex-1 h-4 bg-secondary rounded-sm overflow-hidden">
              <div 
                className="h-full rounded-sm transition-all"
                style={{ 
                  width: `${(item.value / 65000000) * 100}%`,
                  backgroundColor: item.color 
                }}
              />
            </div>
            <span className="w-20 text-right text-foreground font-medium">
              {item.value > 0 ? item.value.toLocaleString() : '-'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 pl-[88px]">
        <span>0</span>
        <span>20</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
};
