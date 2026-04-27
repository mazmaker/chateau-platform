import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { month: "Jan", totalSales: 4000, totalOrder: 2400 },
  { month: "Feb", totalSales: 3000, totalOrder: 1398 },
  { month: "Mar", totalSales: 2000, totalOrder: 9800 },
  { month: "Apr", totalSales: 2780, totalOrder: 3908 },
  { month: "May", totalSales: 1890, totalOrder: 4800 },
  { month: "Jun", totalSales: 2390, totalOrder: 3800 },
  { month: "Jul", totalSales: 3490, totalOrder: 4300 },
];

export const SalesSummaryChart = () => {
  return (
    <div className="bg-card rounded-xl p-6 card-shadow h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Sales Summary</h3>
          <p className="text-sm text-muted-foreground">Monthly sales performance</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Total Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-chart-3" />
            <span className="text-muted-foreground">Total Order</span>
          </div>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(276, 42%, 53%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(276, 42%, 53%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorOrder" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(145, 63%, 49%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(145, 63%, 49%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="totalSales"
              stroke="hsl(276, 42%, 53%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSales)"
            />
            <Area
              type="monotone"
              dataKey="totalOrder"
              stroke="hsl(145, 63%, 49%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorOrder)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
