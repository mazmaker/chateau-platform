import React from 'react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import SuspendedPage from './SuspendedPage';
import { UserRole } from '@/lib/database-types';

interface TenantStatusGuardProps {
  children: React.ReactNode;
  requireOwner?: boolean; // If true, only check for owner role (bypasses tenant status check for platform owner)
}

/**
 * TenantStatusGuard - Checks if the current tenant is suspended
 * If suspended, shows SuspendedPage instead of children
 * Platform Owner (owner role) can bypass this check when requireOwner is false
 */
export const TenantStatusGuard: React.FC<TenantStatusGuardProps> = ({
  children,
  requireOwner = false
}) => {
  const { user, loading, authChecked, tenantSuspended, userRole } = useSimpleAuth();

  // Show nothing while loading or before auth is checked
  if (loading || !authChecked) {
    return null;
  }

  // If no user, let the app handle routing (don't show SuspendedPage)
  if (!user) {
    return <>{children}</>;
  }

  // Platform Owner viewing their own dashboard - bypass tenant status check
  if (userRole === UserRole.OWNER && !requireOwner) {
    return <>{children}</>;
  }

  // If tenant is suspended, show SuspendedPage
  if (tenantSuspended) {
    return <SuspendedPage />;
  }

  // Otherwise, render children normally
  return <>{children}</>;
};

export default TenantStatusGuard;
