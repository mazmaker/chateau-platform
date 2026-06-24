import { ReactNode } from 'react';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';

// Lets an Owner analytics page render either as a full standalone page (chrome +
// sidebar + header) OR embedded as a tab panel inside another page (just spacing).
// Stable module-level component so embedded children don't remount each render.
export const PageShell = ({ embedded = false, sidebarOpen, setSidebarOpen, children }: {
  embedded?: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  children: ReactNode;
}) => {
  if (embedded) return <div className="space-y-7">{children}</div>;
  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">{children}</main>
        </div>
      </div>
    </OwnerGuard>
  );
};
