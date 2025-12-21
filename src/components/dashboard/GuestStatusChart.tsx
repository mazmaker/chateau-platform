import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const guestStatusData = [
  { name: 'Checked-in', value: 68, color: '#10b981' },
  { name: 'Confirmed', value: 24, color: '#3b82f6' },
  { name: 'Pending', value: 8, color: '#f59e0b' },
];

export const GuestStatusChart = () => {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Guest Status</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={guestStatusData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {guestStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: any) => [`${value}%`, 'Percentage']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {guestStatusData.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-600">{item.name}</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};