import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { month: "ม.ค", customers: 180, conversions: 150, leads: 120 },
  { month: "ก.พ", customers: 220, conversions: 180, leads: 140 },
  { month: "มี.ค", customers: 250, conversions: 200, leads: 160 },
  { month: "เม.ย", customers: 280, conversions: 220, leads: 180 },
  { month: "พ.ค", customers: 320, conversions: 260, leads: 200 },
  { month: "มิ.ย", customers: 290, conversions: 240, leads: 190 },
  { month: "ก.ค", customers: 310, conversions: 250, leads: 210 },
  { month: "ส.ค", customers: 280, conversions: 230, leads: 185 },
  { month: "ก.ย", customers: 300, conversions: 245, leads: 195 },
  { month: "ต.ค", customers: 330, conversions: 270, leads: 220 },
  { month: "พ.ย", customers: 350, conversions: 290, leads: 240 },
  { month: "ธ.ค", customers: 380, conversions: 310, leads: 260 },
];

export const CustomerLeadChart = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">รายงานลูกค้า / Lead</h3>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
              domain={[0, 400]}
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
            <Line 
              type="monotone" 
              dataKey="customers" 
              name="Customers"
              stroke="hsl(276, 42%, 53%)" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="conversions" 
              name="Conversions"
              stroke="hsl(180, 70%, 50%)" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="leads" 
              name="Leads"
              stroke="hsl(340, 82%, 65%)" 
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
