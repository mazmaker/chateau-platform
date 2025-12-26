import React from 'react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { UserRole } from '@/lib/database-types';
import { Lock } from 'lucide-react';

export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'manage_users'
  | 'manage_settings'
  | 'manage_billing'
  | 'manage_customers'
  | 'manage_properties'
  | 'manage_leads'
  | 'view_all_tenants';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
  requiredPermission?: Permission | Permission[];
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

// =====================================================
// 3-ROLE SYSTEM PERMISSIONS
// =====================================================
// OWNER = Platform Owner - manages all tenants, billing, subscriptions
// ADMIN = Company Admin - manages own company, properties, leads, theme customization
// SALES = Sales Staff - manages customers, leads for their company
// =====================================================

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    'read',
    'write',
    'delete',
    'manage_users',
    'manage_settings',
    'manage_billing',
    'manage_properties',
    'manage_leads',
    'view_all_tenants' // Platform Owner can see all tenants
  ],
  [UserRole.ADMIN]: [
    'read',
    'write',
    'delete',
    'manage_users',
    'manage_settings',
    'manage_properties',
    'manage_leads',
    'manage_customers'
    // Admins CANNOT: manage_billing, view_all_tenants
  ],
  [UserRole.SALES]: [
    'read',
    'write',
    'manage_customers',
    'manage_leads'
    // Sales CANNOT: delete, manage_users, manage_settings, manage_properties, manage_billing
  ]
};

const hasPermission = (userRole: UserRole | undefined, permission: Permission): boolean => {
  if (!userRole) return false;
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
};

const hasRequiredRole = (userRole: UserRole | undefined, requiredRoles: UserRole[]): boolean => {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
};

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredRole,
  requiredPermission,
  fallback = null,
  showMessage = true
}) => {
  const { userRole } = useSimpleAuth();

  // Check if user has required role
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!hasRequiredRole(userRole as UserRole, roles)) {
      return fallback || (showMessage && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              การเข้าถึงถูกจำกัด
            </p>
            <p className="text-xs text-amber-700">
              คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (ต้องการ: {roles.map(r => r.toUpperCase()).join(' หรือ ')})
            </p>
          </div>
        </div>
      ));
    }
  }

  // Check if user has required permission
  if (requiredPermission) {
    const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasAnyPermission = permissions.some(permission => hasPermission(userRole as UserRole, permission));

    if (!hasAnyPermission) {
      return fallback || (showMessage && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              การเข้าถึงถูกจำกัด
            </p>
            <p className="text-xs text-amber-700">
              คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้
            </p>
          </div>
        </div>
      ));
    }
  }

  return <>{children}</>;
};

// =====================================================
// Permission-specific components
// =====================================================

export const ReadGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="read" fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const WriteGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="write" fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const DeleteGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="delete" fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const ManageUsersGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="manage_users" fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const ManageSettingsGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="manage_settings" fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const ManageBillingGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="manage_billing" fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const ManagePropertiesGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="manage_properties" fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const ManageLeadsGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredPermission="manage_leads" fallback={fallback}>
    {children}
  </PermissionGuard>
);

// =====================================================
// Role-specific components (3-role system)
// =====================================================

// Platform Owner only (for billing, tenant management)
export const OwnerGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredRole={UserRole.OWNER} fallback={fallback}>
    {children}
  </PermissionGuard>
);

// Platform Owner OR Company Admin (for property/lead management)
export const AdminGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredRole={[UserRole.OWNER, UserRole.ADMIN]} fallback={fallback}>
    {children}
  </PermissionGuard>
);

// Platform Owner, Company Admin, OR Sales (for customer/lead viewing)
export const SalesGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => (
  <PermissionGuard requiredRole={[UserRole.OWNER, UserRole.ADMIN, UserRole.SALES]} fallback={fallback}>
    {children}
  </PermissionGuard>
);

// =====================================================
// Hook for checking permissions
// =====================================================

export const usePermissions = () => {
  const { userRole } = useSimpleAuth();

  const checkPermission = (permission: Permission): boolean => {
    return hasPermission(userRole as UserRole, permission);
  };

  const checkRole = (role: UserRole | UserRole[]): boolean => {
    const roles = Array.isArray(role) ? role : [role];
    return hasRequiredRole(userRole as UserRole, roles);
  };

  return {
    userRole,
    // Permission checks
    canRead: checkPermission('read'),
    canWrite: checkPermission('write'),
    canDelete: checkPermission('delete'),
    canManageUsers: checkPermission('manage_users'),
    canManageSettings: checkPermission('manage_settings'),
    canManageBilling: checkPermission('manage_billing'),
    canManageProperties: checkPermission('manage_properties'),
    canManageLeads: checkPermission('manage_leads'),
    canManageCustomers: checkPermission('manage_customers'),
    canViewAllTenants: checkPermission('view_all_tenants'),

    // Role checks
    isOwner: userRole === UserRole.OWNER,
    isAdmin: userRole === UserRole.ADMIN,
    isSales: userRole === UserRole.SALES,

    // Combined role checks (for convenience)
    isPlatformOwner: userRole === UserRole.OWNER,
    isCompanyAdmin: userRole === UserRole.ADMIN,
    isSalesStaff: userRole === UserRole.SALES,
    canManageCompany: [UserRole.OWNER, UserRole.ADMIN].includes(userRole as UserRole),
    canAccessAllData: userRole === UserRole.OWNER,

    checkPermission,
    checkRole
  };
};

// Legacy export for backwards compatibility
export default PermissionGuard;
