import { useState, useEffect } from 'react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { handleApiError, safeQuery } from '@/lib/api/errorHandler';
import { useToast } from '@/hooks/use-toast';
import { isAppError } from '@/types/errors';

// Hook for fetching tenant-specific data with proper isolation
export const useTenantData = <T,>(
  table: string,
  options?: {
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
    filter?: { column: string; operator: string; value: any };
    limit?: number;
  }
) => {
  const { currentTenant, user } = useSimpleAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentTenant) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from(table)
          .select(options?.select || '*')
          .eq('tenant_id', currentTenant.id);

        // Apply filters if provided
        if (options?.filter) {
          query = query.filter(
            options.filter.column,
            options.filter.operator as any,
            options.filter.value
          );
        }

        // Apply ordering if provided
        if (options?.orderBy) {
          query = query.order(
            options.orderBy.column,
            { ascending: options.orderBy.ascending ?? true }
          );
        }

        // Apply limit if provided
        if (options?.limit) {
          query = query.limit(options.limit);
        }

        // Use safeQuery for null-safe error handling
        const result = await safeQuery(
          () => query,
          {
            table,
            operation: 'select',
            userId: user?.id,
            tenantId: currentTenant.id,
          }
        );

        setData((result || []) as T[]);
      } catch (err) {
        const appError = handleApiError(err, {
          table,
          operation: 'select',
          userId: user?.id,
          tenantId: currentTenant.id,
        });

        // Show toast notification for errors
        if (isAppError(appError)) {
          toast({
            variant: 'destructive',
            title: 'ไม่สามารถโหลดข้อมูลได้',
            description: appError.userMessage,
          });
        }

        setError(appError.userMessage);
        console.error(`Error fetching tenant data from ${table}:`, appError);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentTenant, table, JSON.stringify(options), user, toast]);

  return { data, loading, error };
};

// Hook for creating tenant-specific records
export const useTenantMutation = <T,>(
  table: string,
  operation: 'insert' | 'update' | 'delete' = 'insert'
) => {
  const { currentTenant } = useSimpleAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (data: any, id?: string) => {
    if (!currentTenant && operation !== 'insert') {
      setError('No tenant selected');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      let result;

      // Always include tenant_id for data isolation
      const dataWithTenant = {
        ...data,
        tenant_id: currentTenant?.id
      };

      switch (operation) {
        case 'insert':
          result = await supabase
            .from(table)
            .insert(dataWithTenant)
            .select()
            .single();
          break;

        case 'update':
          result = await supabase
            .from(table)
            .update(dataWithTenant)
            .eq('id', id!)
            .eq('tenant_id', currentTenant!.id) // Ensure tenant isolation
            .select()
            .single();
          break;

        case 'delete':
          result = await supabase
            .from(table)
            .delete()
            .eq('id', id!)
            .eq('tenant_id', currentTenant!.id); // Ensure tenant isolation
          break;

        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      if (result.error) throw result.error;

      return result.data;
    } catch (err) {
      console.error(`Error in ${operation} operation on ${table}:`, err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
};

// Hook for checking tenant permissions
export const useTenantPermission = (permission: string) => {
  const { userRole } = useSimpleAuth();

  const permissions: Record<string, string[]> = {
    owner: ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'manage_billing', 'view_all_tenants'],
    admin: ['read', 'write', 'delete', 'manage_users', 'manage_settings', 'manage_properties', 'manage_leads'],
    sales: ['read', 'write', 'manage_customers', 'manage_leads']
  };

  return permissions[userRole || 'sales']?.includes(permission) || false;
};

// Hook for tenant analytics
export const useTenantAnalytics = () => {
  const { currentTenant } = useSimpleAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentTenant) {
        setAnalytics(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch key metrics for the current tenant
        const [
          customersResult,
          bookingsResult,
          revenueResult,
          unitsResult
        ] = await Promise.all([
          supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', currentTenant.id),
          supabase
            .from('bookings')
            .select('id, total_amount')
            .eq('tenant_id', currentTenant.id),
          supabase
            .from('bookings')
            .select('total_amount')
            .eq('tenant_id', currentTenant.id)
            .not('total_amount', 'is', null),
          supabase
            .from('units')
            .select('id')
            .eq('tenant_id', currentTenant.id)
        ]);

        const totalRevenue = revenueResult.data?.reduce(
          (sum, booking) => sum + (booking.total_amount || 0), 0
        ) || 0;

        setAnalytics({
          totalCustomers: customersResult.data?.length || 0,
          totalBookings: bookingsResult.data?.length || 0,
          totalRevenue,
          totalUnits: unitsResult.data?.length || 0
        });
      } catch (error) {
        console.error('Error fetching tenant analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [currentTenant]);

  return { analytics, loading };
};