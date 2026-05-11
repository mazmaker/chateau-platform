import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import PermissionsContent from "@/components/permissions/PermissionsContent";

const Permissions = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6">
          <AdminGuard>
            <PermissionsContent />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
};

export default Permissions;
