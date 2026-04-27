import { Users, TrendingUp, UserCheck, Percent, UserCog, UserPlus, Clock } from "lucide-react";

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  iconBg?: string;
}

const StatCard = ({ icon, value, label, iconBg = "bg-secondary" }: StatCardProps) => (
  <div className="flex items-center gap-3">
    <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
      {icon}
    </div>
    <div>
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

export const StatsCards = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      {/* Customer Stats */}
      <div className="bg-card rounded-xl p-4 card-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">สถิติลูกค้า</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            icon={<Users className="w-5 h-5 text-primary" />}
            value="10"
            label="Leads"
          />
          <StatCard 
            icon={<TrendingUp className="w-5 h-5 text-primary" />}
            value="33"
            label="Conversions"
          />
          <StatCard 
            icon={<UserCheck className="w-5 h-5 text-primary" />}
            value="150"
            label="Customers"
          />
          <StatCard 
            icon={<Percent className="w-5 h-5 text-success" />}
            value="89.99%"
            label="Conversion Rates"
            iconBg="bg-success/10"
          />
        </div>
      </div>

      {/* Sales Team Stats */}
      <div className="bg-card rounded-xl p-4 card-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">พนักงานขาย</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            icon={<UserCog className="w-5 h-5 text-primary" />}
            value="50"
            label="พนักงานขาย"
          />
          <StatCard 
            icon={<UserPlus className="w-5 h-5 text-primary" />}
            value="33"
            label="เพิ่มใช้งาน"
          />
          <StatCard 
            icon={<Clock className="w-5 h-5 text-primary" />}
            value="17"
            label="นัดหมาย"
          />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold text-muted-foreground">-</p>
              <p className="text-xs text-muted-foreground">อื่นๆ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
