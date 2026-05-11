import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Construction } from "lucide-react";
import { AdminProjectMatrix } from "./AdminProjectMatrix";
import { SalesProjectMatrix } from "./SalesProjectMatrix";
import { SalesUnitMatrix } from "./SalesUnitMatrix";
import { AgentUnitMatrix } from "./AgentUnitMatrix";

const ComingSoon = ({ name }: { name: string }) => (
  <Card>
    <CardContent className="pt-12 pb-12 text-center">
      <Construction className="w-12 h-12 mx-auto text-gray-300 mb-3" />
      <h3 className="text-lg font-semibold text-gray-700">{name}</h3>
      <p className="text-sm text-gray-500 mt-1">
        อยู่ระหว่างพัฒนา — รอ Phase 1D ส่วนถัดไป
      </p>
    </CardContent>
  </Card>
);

const PermissionsContent = () => {
  const { userRole } = useSimpleAuth();
  const isOwner = userRole === "owner";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-chateau-50 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-chateau" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">สิทธิ์ผู้ใช้งาน</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              จัดการการมอบหมายโครงการ / ยูนิต ให้ Admin / Sales / Agent
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={isOwner ? "admin-projects" : "sales-projects"} className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-gray-100">
          <TabsTrigger value="admin-projects" className="data-[state=active]:bg-white">
            🔧 Admin × Projects
          </TabsTrigger>
          <TabsTrigger value="sales-projects" className="data-[state=active]:bg-white">
            💼 Sales × Projects
          </TabsTrigger>
          <TabsTrigger value="sales-units" className="data-[state=active]:bg-white">
            💼 Sales × Units
          </TabsTrigger>
          <TabsTrigger value="agent-units" className="data-[state=active]:bg-white">
            🤝 Agent × Units
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin-projects" className="pt-4">
          <AdminProjectMatrix />
        </TabsContent>

        <TabsContent value="sales-projects" className="pt-4">
          <SalesProjectMatrix />
        </TabsContent>

        <TabsContent value="sales-units" className="pt-4">
          <SalesUnitMatrix />
        </TabsContent>

        <TabsContent value="agent-units" className="pt-4">
          <AgentUnitMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PermissionsContent;
