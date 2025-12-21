
const statusData = [
  { label: "เข้ามาใหม่", percent: 34.4, value: 344, color: "hsl(276, 42%, 53%)" },
  { label: "มีนัดหมาย", percent: 23.2, value: 232, color: "hsl(276, 42%, 53%)" },
  { label: "เข้าพบแล้ว", percent: 18.5, value: 185, color: "hsl(180, 70%, 50%)" },
  { label: "ถูกยกเลิก", percent: 16.3, value: 163, color: "hsl(340, 82%, 65%)" },
  { label: "ออกหลัก", percent: 10, value: 100, color: "hsl(145, 63%, 49%)" },
  { label: "แล้วเสร็จ", percent: 9.8, value: 98, color: "hsl(45, 93%, 58%)" },
  { label: "ยกเลิก", percent: 6.5, value: 65, color: "hsl(4, 78%, 56%)" },
];

export const StatusReport = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">รายงานสถานะลูกค้า</h3>
      <div className="space-y-3">
        {statusData.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-16 text-xs text-muted-foreground truncate">{item.label}</span>
            <div 
              className="px-2 py-0.5 rounded text-white text-[10px] font-medium min-w-[40px] text-center"
              style={{ backgroundColor: item.color }}
            >
              {item.percent}%
            </div>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${(item.value / 344) * 100}%`,
                  backgroundColor: item.color 
                }}
              />
            </div>
            <span className="w-10 text-right text-xs font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-3 pl-[100px]">
        <span>0</span>
        <span>100</span>
        <span>200</span>
        <span>300</span>
        <span>400</span>
        <span>500</span>
      </div>
    </div>
  );
};
