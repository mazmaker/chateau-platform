import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { week: "W1", score: 75 },
  { week: "W2", score: 82 },
  { week: "W3", score: 78 },
  { week: "W4", score: 88 },
  { week: "W5", score: 92 },
  { week: "W6", score: 85 },
  { week: "W7", score: 90 },
];

export const CustomerSatisfactionChart = () => {
  return (
    <div className="bg-card rounded-xl p-6 card-shadow h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Customer Satisfaction</h3>
        <p className="text-sm text-muted-foreground">Weekly trend</p>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl font-bold text-foreground">90%</span>
        <span className="text-sm text-success font-medium">+5%</span>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSatisfaction" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(145, 63%, 49%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(145, 63%, 49%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="week" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 10 }}
            />
            <YAxis hide domain={[60, 100]} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 15%, 91%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value) => [`${value}%`, 'Satisfaction']}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(145, 63%, 49%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSatisfaction)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
