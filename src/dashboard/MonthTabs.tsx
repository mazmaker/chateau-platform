import { Button } from "@/components/ui/button";

const months = [
  "ทั้งหมด", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", 
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", 
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

interface MonthTabsProps {
  activeMonth?: string;
  onMonthChange?: (month: string) => void;
}

export const MonthTabs = ({ activeMonth = "ทั้งหมด", onMonthChange }: MonthTabsProps) => {
  return (
    <div className="flex flex-wrap gap-1 mb-4">
      {months.map((month) => (
        <Button
          key={month}
          variant={activeMonth === month ? "default" : "ghost"}
          size="sm"
          className={`text-xs px-3 py-1 h-7 ${
            activeMonth === month 
              ? "gradient-primary text-primary-foreground" 
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onMonthChange?.(month)}
        >
          {month}
        </Button>
      ))}
    </div>
  );
};
