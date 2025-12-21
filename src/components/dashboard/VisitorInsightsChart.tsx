import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", loyal: 100, new: 50 },
  { month: "Feb", loyal: 120, new: 80 },
  { month: "Mar", loyal: 150, new: 60 },
  { month: "Apr", loyal: 180, new: 90 },
  { month: "May", loyal: 200, new: 110 },
  { month: "Jun", loyal: 220, new: 130 },
  { month: "Jul", loyal: 250, new: 150 },
];

export const VisitorInsightsChart = () => {
  return (
    <div className="bg-card rounded-xl p-6 card-shadow h-full">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Visitor Insights</h3>
        <p className="text-sm text-muted-foreground">Customer comparison</p>
      </div>
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">Loyal Customers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-chart-4" />
          <span className="text-muted-foreground">New Customers</span>
        </div>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 91%)" />
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
            <Line
              type="monotone"
              dataKey="loyal"
              stroke="hsl(276, 42%, 53%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(276, 42%, 53%)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="new"
              stroke="hsl(28, 87%, 55%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(28, 87%, 55%)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
