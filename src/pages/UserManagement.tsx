import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import UserManagementContent from "@/components/users/UserManagementContent";

const UserManagement = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* User Management Content */}
        <main className="p-6 lg:p-8">
          <AdminGuard>
            <UserManagementContent />
          </AdminGuard>
        </main>
      </div>
    </div>
  );
};

export default UserManagement;