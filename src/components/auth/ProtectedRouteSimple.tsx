import { ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimpleAuth } from '@/contexts/AuthContextSimple'
import { Building2, Loader2 } from 'lucide-react'

interface SimpleProtectedRouteProps {
  children: ReactNode
  onlyGuests?: boolean
  requireRole?: 'owner' | 'admin' | 'sales'
}

export const ProtectedRouteSimple = ({
  children,
  onlyGuests = false,
  requireRole
}: SimpleProtectedRouteProps) => {
  const { user, loading, userRole, authChecked } = useSimpleAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // For guest routes (login), redirect to home if already logged in
    if (onlyGuests && authChecked && user) {
      navigate('/', { replace: true })
    }

    // For protected routes, redirect to login if not authenticated
    if (!onlyGuests && authChecked && !user) {
      navigate('/auth/login', { replace: true })
    }

    // Check role requirements
    if (authChecked && user && requireRole && userRole !== requireRole) {
      navigate('/', { replace: true })
    }
  }, [user, onlyGuests, requireRole, userRole, navigate, authChecked])

  // ===== Guest Routes (Login, Register) =====
  if (onlyGuests) {
    // Show login page IMMEDIATELY, don't wait for auth check
    // Redirect happens in background if already logged in
    return <>{children}</>
  }

  // ===== Protected Routes =====
  // If we have a user (just logged in), show content immediately
  if (user) {
    // Check role requirements
    if (requireRole && userRole !== requireRole) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 p-8 max-w-md">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ไม่มีสิทธิ์เข้าถึง
              </h2>
              <p className="text-gray-600 mb-6">
                คุณต้องมีสิทธิ์ระดับ <strong>{requireRole}</strong> ในการเข้าถึงหน้านี้
              </p>
              <p className="text-sm text-gray-500">
                สิทธิ์ปัจจุบัน: <span className="font-semibold">{userRole || 'ไม่มี'}</span>
              </p>
            </div>
          </div>
        </div>
      )
    }
    return <>{children}</>
  }

  // Show loading only for initial auth check or explicit loading state
  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <Loader2 className="w-8 h-8 text-indigo-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600 text-lg">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  // Not logged in - will redirect via useEffect
  return null
}

// Higher-order component for role-based protection
export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole: 'owner' | 'admin' | 'sales'
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRouteSimple requireRole={requiredRole}>
        <Component {...props} />
      </ProtectedRouteSimple>
    )
  }
}

// Hook to check if user has specific role
export function useRequireRole(requiredRole: 'owner' | 'admin' | 'sales') {
  const { userRole } = useSimpleAuth()
  return userRole === requiredRole
}

// Hook to check if user has any of the specified roles
export function useRequireAnyRole(roles: ('owner' | 'admin' | 'sales')[]) {
  const { userRole } = useSimpleAuth()
  return roles.includes(userRole as any)
}
