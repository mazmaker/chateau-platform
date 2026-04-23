// Tenant Suspension Management Service
// ระบบจัดการการระงับบริการลูกค้า

import { supabase } from './supabase';
import { emailService } from './email-service';

export interface SuspensionRule {
  gracePeriodDays: number;
  suspensionThresholdDays: number;
  autoRestore: boolean;
  notifyAdmin: boolean;
}

export interface TenantSuspensionData {
  tenant_id: string;
  tenant_name: string;
  tenant_email?: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  days_past_due: number;
  current_status: 'active' | 'suspended' | 'terminated';
  suspension_reason?: string;
  suspended_at?: string;
  suspended_by?: string;
}

class SuspensionService {
  private static instance: SuspensionService;
  private rules: SuspensionRule = {
    gracePeriodDays: 7,           // Grace period หลังครบกำหนด
    suspensionThresholdDays: 7,   // วันที่จะ suspend (เท่ากับ grace period)
    autoRestore: true,            // Auto-restore เมื่อชำระเงิน
    notifyAdmin: true             // แจ้งเตือน Admin
  };

  private constructor() {}

  static getInstance(): SuspensionService {
    if (!SuspensionService.instance) {
      SuspensionService.instance = new SuspensionService();
    }
    return SuspensionService.instance;
  }

  // Calculate suspension status for an invoice
  public calculateSuspensionStatus(invoice: any): {
    status: 'current' | 'due' | 'overdue' | 'suspend_warning' | 'suspended';
    daysPastDue: number;
    daysUntilSuspension: number;
    shouldSuspend: boolean;
    shouldWarn: boolean;
  } {
    const now = new Date();
    const dueDate = new Date(invoice.due_date);
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilSuspension = this.rules.gracePeriodDays - daysPastDue;

    let status: any = 'current';
    if (daysPastDue === 0) {
      status = 'due';
    } else if (daysPastDue > 0 && daysPastDue <= this.rules.gracePeriodDays) {
      status = 'overdue';
    } else if (daysPastDue > this.rules.gracePeriodDays - 2) {
      status = 'suspend_warning';
    } else if (daysPastDue > this.rules.gracePeriodDays) {
      status = 'suspended';
    }

    return {
      status,
      daysPastDue,
      daysUntilSuspension: Math.max(0, daysUntilSuspension),
      shouldSuspend: daysPastDue > this.rules.gracePeriodDays,
      shouldWarn: daysPastDue > this.rules.gracePeriodDays - 2 && daysPastDue <= this.rules.gracePeriodDays
    };
  }

  // Get all tenants that need suspension
  public async getTenantsForSuspension(): Promise<TenantSuspensionData[]> {
    try {
      console.log('🔍 Checking tenants for suspension...');

      // Get all overdue invoices with tenant info
      const { data: overdueInvoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          tenant_id,
          invoice_number,
          amount,
          due_date,
          status,
          tenants!inner (
            id,
            name,
            status,
            email,
            subscription_plan
          )
        `)
        .in('status', ['pending', 'overdue'])
        .lt('due_date', new Date().toISOString());

      if (error) {
        console.error('❌ Error fetching overdue invoices:', error);
        return [];
      }

      if (!overdueInvoices || overdueInvoices.length === 0) {
        console.log('✅ No overdue invoices found');
        return [];
      }

      const suspensionData: TenantSuspensionData[] = [];

      for (const invoice of overdueInvoices) {
        const suspensionStatus = this.calculateSuspensionStatus(invoice);

        if (suspensionStatus.shouldSuspend && invoice.tenants.status === 'active') {
          suspensionData.push({
            tenant_id: invoice.tenant_id,
            tenant_name: invoice.tenants.name,
            tenant_email: invoice.tenants.email,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            amount: invoice.amount,
            due_date: invoice.due_date,
            days_past_due: suspensionStatus.daysPastDue,
            current_status: invoice.tenants.status,
            suspension_reason: `Payment overdue by ${suspensionStatus.daysPastDue} days`
          });
        }
      }

      console.log(`📊 Found ${suspensionData.length} tenants for suspension`);
      return suspensionData;

    } catch (error) {
      console.error('❌ Error in getTenantsForSuspension:', error);
      return [];
    }
  }

  // Suspend a single tenant
  public async suspendTenant(tenantData: TenantSuspensionData): Promise<boolean> {
    try {
      console.log(`🔴 Suspending tenant: ${tenantData.tenant_name}`);

      // Update tenant status to suspended
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          status: 'suspended',
          suspended_at: new Date().toISOString(),
          suspension_reason: tenantData.suspension_reason
        })
        .eq('id', tenantData.tenant_id);

      if (updateError) {
        console.error(`❌ Error suspending tenant ${tenantData.tenant_name}:`, updateError);
        return false;
      }

      // Log suspension activity
      await this.logSuspensionActivity({
        tenant_id: tenantData.tenant_id,
        action: 'suspended',
        reason: tenantData.suspension_reason || 'Payment overdue',
        invoice_id: tenantData.invoice_id,
        performed_by: 'system',
        performed_at: new Date().toISOString()
      });

      // Send suspension notification email
      if (tenantData.tenant_email) {
        emailService.queueEmail('service_suspended', {
          tenant_name: tenantData.tenant_name,
          invoice_number: tenantData.invoice_number,
          amount: tenantData.amount,
          due_date: tenantData.due_date,
          days_past_due: tenantData.days_past_due,
          tenant_email: tenantData.tenant_email
        });
      }

      // Notify admin if configured
      if (this.rules.notifyAdmin) {
        await this.notifyAdminOfSuspension(tenantData);
      }

      console.log(`✅ Successfully suspended tenant: ${tenantData.tenant_name}`);
      return true;

    } catch (error) {
      console.error(`❌ Error suspending tenant ${tenantData.tenant_name}:`, error);
      return false;
    }
  }

  // Restore suspended tenant (when payment is received)
  public async restoreTenant(tenantId: string, restoredBy: string = 'system'): Promise<boolean> {
    try {
      console.log(`🟢 Restoring tenant: ${tenantId}`);

      // Get tenant info
      const { data: tenant, error: fetchError } = await supabase
        .from('tenants')
        .select('id, name, email, status')
        .eq('id', tenantId)
        .single();

      if (fetchError || !tenant) {
        console.error('❌ Error fetching tenant for restoration:', fetchError);
        return false;
      }

      if (tenant.status !== 'suspended') {
        console.log(`⚠️ Tenant ${tenant.name} is not suspended, current status: ${tenant.status}`);
        return false;
      }

      // Update tenant status to active
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          status: 'active',
          suspended_at: null,
          suspension_reason: null,
          restored_at: new Date().toISOString(),
          restored_by: restoredBy
        })
        .eq('id', tenantId);

      if (updateError) {
        console.error(`❌ Error restoring tenant ${tenant.name}:`, updateError);
        return false;
      }

      // Log restoration activity
      await this.logSuspensionActivity({
        tenant_id: tenantId,
        action: 'restored',
        reason: 'Payment received',
        performed_by: restoredBy,
        performed_at: new Date().toISOString()
      });

      // Send restoration notification email
      if (tenant.email) {
        emailService.queueEmail('payment_received', {
          tenant_name: tenant.name,
          invoice_number: 'RESTORED',
          amount: 0,
          due_date: new Date().toISOString(),
          tenant_email: tenant.email,
          login_url: 'https://chateau-platform.com/login'
        });
      }

      console.log(`✅ Successfully restored tenant: ${tenant.name}`);
      return true;

    } catch (error) {
      console.error(`❌ Error restoring tenant ${tenantId}:`, error);
      return false;
    }
  }

  // Process all suspensions (called by cron job)
  public async processSuspensions(): Promise<{
    checked: number;
    suspended: number;
    warnings: number;
    errors: number;
  }> {
    console.log('🔄 Starting suspension processing...');

    const result = {
      checked: 0,
      suspended: 0,
      warnings: 0,
      errors: 0
    };

    try {
      const tenantsForSuspension = await this.getTenantsForSuspension();
      result.checked = tenantsForSuspension.length;

      for (const tenantData of tenantsForSuspension) {
        const suspensionStatus = this.calculateSuspensionStatus({
          due_date: tenantData.due_date
        });

        if (suspensionStatus.shouldSuspend) {
          const success = await this.suspendTenant(tenantData);
          if (success) {
            result.suspended++;
          } else {
            result.errors++;
          }
        } else if (suspensionStatus.shouldWarn) {
          // Send warning email
          if (tenantData.tenant_email) {
            emailService.queueEmail('final_warning', {
              tenant_name: tenantData.tenant_name,
              invoice_number: tenantData.invoice_number,
              amount: tenantData.amount,
              due_date: tenantData.due_date,
              days_past_due: tenantData.days_past_due,
              tenant_email: tenantData.tenant_email
            });
            result.warnings++;
          }
        }
      }

      console.log(`📊 Suspension processing complete:`, result);
      return result;

    } catch (error) {
      console.error('❌ Error processing suspensions:', error);
      result.errors++;
      return result;
    }
  }

  // Log suspension activities
  private async logSuspensionActivity(activity: {
    tenant_id: string;
    action: 'suspended' | 'restored' | 'warned';
    reason: string;
    invoice_id?: string;
    performed_by: string;
    performed_at: string;
  }): Promise<void> {
    try {
      // In a real app, this would go to an audit_logs table
      console.log('📝 Suspension Activity:', {
        tenant_id: activity.tenant_id,
        action: activity.action,
        reason: activity.reason,
        performed_by: activity.performed_by,
        timestamp: activity.performed_at
      });

      // TODO: Insert into audit_logs table
      /*
      await supabase
        .from('audit_logs')
        .insert([{
          entity_type: 'tenant',
          entity_id: activity.tenant_id,
          action: activity.action,
          details: {
            reason: activity.reason,
            invoice_id: activity.invoice_id
          },
          performed_by: activity.performed_by,
          performed_at: activity.performed_at
        }]);
      */
    } catch (error) {
      console.error('❌ Error logging suspension activity:', error);
    }
  }

  // Notify admin of suspension
  private async notifyAdminOfSuspension(tenantData: TenantSuspensionData): Promise<void> {
    try {
      // Send email to admin
      console.log('📧 Notifying admin of suspension:', {
        tenant: tenantData.tenant_name,
        reason: tenantData.suspension_reason,
        amount: tenantData.amount
      });

      // TODO: Send actual admin notification
      // This could be email, Slack, or dashboard notification
    } catch (error) {
      console.error('❌ Error notifying admin:', error);
    }
  }

  // Get suspension statistics
  public async getSuspensionStats(): Promise<{
    active_tenants: number;
    suspended_tenants: number;
    overdue_invoices: number;
    total_overdue_amount: number;
  }> {
    try {
      // Get tenant counts
      const { data: tenantCounts } = await supabase
        .from('tenants')
        .select('status')
        .in('status', ['active', 'suspended']);

      const active = tenantCounts?.filter(t => t.status === 'active').length || 0;
      const suspended = tenantCounts?.filter(t => t.status === 'suspended').length || 0;

      // Get overdue invoices
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('amount')
        .in('status', ['pending', 'overdue'])
        .lt('due_date', new Date().toISOString());

      const overdueCount = overdueInvoices?.length || 0;
      const totalOverdueAmount = overdueInvoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

      return {
        active_tenants: active,
        suspended_tenants: suspended,
        overdue_invoices: overdueCount,
        total_overdue_amount: totalOverdueAmount
      };
    } catch (error) {
      console.error('❌ Error getting suspension stats:', error);
      return {
        active_tenants: 0,
        suspended_tenants: 0,
        overdue_invoices: 0,
        total_overdue_amount: 0
      };
    }
  }

  // Update suspension rules
  public updateRules(newRules: Partial<SuspensionRule>): void {
    this.rules = { ...this.rules, ...newRules };
    console.log('⚙️ Updated suspension rules:', this.rules);
  }

  // Get current rules
  public getRules(): SuspensionRule {
    return { ...this.rules };
  }
}

// Export singleton instance
export const suspensionService = SuspensionService.getInstance();