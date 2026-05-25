import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import ProjectsContent from "@/components/properties/ProjectsContent";
import { SalesGuard } from "@/components/auth/PermissionGuard";

const Projects = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Projects Content */}
        <main className="p-6">
          <SalesGuard>
            <ProjectsContent />
          </SalesGuard>
        </main>
      </div>
    </div>
  );
};

export default Projects;