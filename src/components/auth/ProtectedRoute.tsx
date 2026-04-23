import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  onlyPublic?: boolean; // Only for non-authenticated users (public pages)
  onlyGuests?: boolean; // Only for guests (can't be logged in)
}

const ProtectedRoute = ({
  children,
  requireAuth = true,
  redirectTo = '/auth/login',
  onlyPublic = false,
  onlyGuests = false
}: ProtectedRouteProps) => {
  const { user, loading, userRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Public pages (registration) - Block Admin/Sales users
  if (onlyPublic) {
    if (user && userRole && userRole !== 'owner') {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-8 text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4 mx-auto">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">การเข้าถึงถูกจำกัด</h1>
              <p className="text-gray-600 mb-6">
                ไม่สามารถสร้างบัญชีใหม่ได้ในขณะที่ล็อกอินอยู่ในระบบ
              </p>
              <p className="text-sm text-gray-500 mb-6">
                เฉพาะเจ้าของบริษัทเท่านั้นที่สามารถสร้างบัญชีผู้ใช้ใหม่ผ่านหน้าจัดการผู้ใช้
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                กลับสู่แดชบอร์ด
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (user) {
      return <Navigate to="/" replace />;
    }
  }

  // Guest-only pages (login/forgot-password)
  if (onlyGuests && user) {
    return <Navigate to="/" replace />;
  }

  // Authenticated routes
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;