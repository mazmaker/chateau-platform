import { Home, DollarSign, Calendar, Users, UserCheck, HelpCircle, Globe, Phone, MessageSquare } from "lucide-react";

const objectives = [
  { icon: Home, value: 31, label: "อาคารหรืออยู่อาศัย", color: "text-primary" },
  { icon: DollarSign, value: 33, label: "เพื่อลงทุน", color: "text-primary" },
  { icon: Calendar, value: 12, label: "ผ่อนเพื่อซื้อบ้าน", color: "text-primary" },
  { icon: Users, value: 17, label: "ผ่อนระยะสั้น", color: "text-primary" },
  { icon: UserCheck, value: 10, label: "ซ่อมแซมบำรุง", color: "text-primary" },
  { icon: HelpCircle, value: 3, label: "อื่น", color: "text-muted-foreground" },
];

const sources = [
  { icon: Globe, value: 50, label: "เว็บออนไลน์", color: "text-primary" },
  { icon: MessageSquare, value: 33, label: "ส่งออฟไลน์", color: "text-primary" },
  { icon: Phone, value: 17, label: "อื่น", color: "text-muted-foreground" },
];

export const CustomerObjectives = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Objectives */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">ภาพรวมวัตถุประสงค์การซื้อของลูกค้า</h3>
          <div className="flex flex-wrap items-center gap-4">
            {objectives.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sources */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">แหล่งที่มา</h3>
          <div className="flex flex-wrap items-center gap-4">
            {sources.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
