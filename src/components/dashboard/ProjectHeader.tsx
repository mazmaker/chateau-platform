import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const projectMetrics = [
  { label: "แบบบ้าน", value: "12" },
  { label: "จำนวนยูนิต", value: "258" },
  { label: "ขาย", value: "80" },
  { label: "ว่าง", value: "50", highlight: true },
  { label: "ว่าง", value: "15" },
  { label: "มูลค่าโครงการ", value: "1,580,827,000" },
  { label: "ยอดขายตั้งจริงหมด", value: "469,743,000", highlight: true },
  { label: "ยอดโอน", value: "378,562,000" },
  { label: "รอออก", value: "37" },
  { label: "รอออกโอน", value: "12" },
  { label: "รอออกยกเลิก", value: "12" },
];

export const ProjectHeader = () => {
  return (
    <div className="bg-card rounded-xl p-4 card-shadow mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Project Info */}
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">โครงการ</span>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">CI</span>
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">CHARN</h2>
              <h2 className="font-bold gradient-primary-text text-lg">ISSARA</h2>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          {projectMetrics.map((metric, index) => (
            <div key={index} className="text-center">
              <p className={`text-lg font-bold ${metric.highlight ? 'text-primary' : 'text-foreground'}`}>
                {metric.value}
              </p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Date Range & Filters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <Button variant="outline" size="sm" className="text-xs">วัน</Button>
            <Button variant="outline" size="sm" className="text-xs">สัปดาห์</Button>
            <Button variant="default" size="sm" className="text-xs gradient-primary border-0">เดือน</Button>
            <input 
              type="text" 
              className="w-8 text-center text-xs border rounded px-1 py-1" 
              defaultValue="0" 
            />
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">26 มกราคม 2024 - 7 มีนาคม 2024</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
};
