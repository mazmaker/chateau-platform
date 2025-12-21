import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", target: 8000, reality: 6500 },
  { month: "Feb", target: 9000, reality: 8200 },
  { month: "Mar", target: 10000, reality: 9500 },
  { month: "Apr", target: 11000, reality: 10800 },
  { month: "May", target: 12000, reality: 11200 },
];

export const TargetRealityChart = () => {
  return (
    <div className="bg-card rounded-xl p-6 card-shadow h-full">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Target vs Reality</h3>
        <p className="text-sm text-muted-foreground">Monthly performance comparison</p>
      </div>
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-chart-3" />
          <span className="text-muted-foreground">Reality</span>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 91%)" vertical={false} />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 15%, 91%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Bar 
              dataKey="target" 
              fill="hsl(276, 42%, 53%)" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="reality" 
              fill="hsl(145, 63%, 49%)" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
