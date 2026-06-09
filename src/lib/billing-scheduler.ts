// Billing Automation Scheduler
// ระบบจัดการงานอัตโนมัติสำหรับ Billing และ Suspension

import { emailService } from './email-service';
import { suspensionService } from './suspension-service';
import { supabase } from './supabase';

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'paused' | 'error';
  runCount: number;
  errorCount: number;
}

interface JobResult {
  success: boolean;
  message: string;
  data?: any;
  duration: number;
}

class BillingScheduler {
  private static instance: BillingScheduler;
  private jobs: Map<string, ScheduledJob> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  private constructor() {
    this.setupDefaultJobs();
  }

  static getInstance(): BillingScheduler {
    if (!BillingScheduler.instance) {
      BillingScheduler.instance = new BillingScheduler();
    }
    return BillingScheduler.instance;
  }

  // Setup default billing jobs
  private setupDefaultJobs(): void {
    const defaultJobs: Omit<ScheduledJob, 'id'>[] = [
      {
        name: 'Auto Generate Invoices',
        schedule: 'daily:09:00', // ทุกวัน 9 โมงเช้า
        status: 'active',
        runCount: 0,
        errorCount: 0
      },
      {
        name: 'Process Suspensions',
        schedule: 'daily:10:00', // ทุกวัน 10 โมงเช้า
        status: 'active',
        runCount: 0,
        errorCount: 0
      },
      {
        name: 'Send Email Notifications',
        schedule: 'hourly', // ทุกชั่วโมง
        status: 'active',
        runCount: 0,
        errorCount: 0
      },
      {
        name: 'Update Invoice Status',
        schedule: 'daily:08:00', // ทุกวัน 8 โมงเช้า
        status: 'active',
        runCount: 0,
        errorCount: 0
      },
      {
        name: 'Billing Analytics Update',
        schedule: 'daily:23:00', // ทุกวัน 11 โมงเย็น
        status: 'active',
        runCount: 0,
        errorCount: 0
      }
    ];

    defaultJobs.forEach(job => {
      const jobId = this.generateJobId(job.name);
      this.jobs.set(jobId, {
        id: jobId,
        ...job,
        nextRun: this.calculateNextRun(job.schedule)
      });
    });

    console.log('⚙️ Setup default billing jobs:', Array.from(this.jobs.keys()));
  }

  // Generate unique job ID
  private generateJobId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_');
  }

  // Calculate next run time based on schedule
  private calculateNextRun(schedule: string): Date {
    const now = new Date();
    const [type, time] = schedule.split(':');

    switch (type) {
      case 'hourly':
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        return nextHour;

      case 'daily':
        if (time) {
          const [hour, minute] = time.split(':').map(Number);
          const nextDay = new Date(now);
          nextDay.setHours(hour, minute, 0, 0);

          // If time has passed today, schedule for tomorrow
          if (nextDay <= now) {
            nextDay.setDate(nextDay.getDate() + 1);
          }
          return nextDay;
        }
        break;

      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;

      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
    }

    // Default: run in 1 hour
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  // Start the scheduler
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting billing scheduler...');

    // Check jobs every minute
    const checkInterval = setInterval(() => {
      this.checkAndRunJobs();
    }, 60000); // 1 minute

    this.intervals.set('main', checkInterval);
    console.log('✅ Billing scheduler started');
  }

  // Stop the scheduler
  public stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler is not running');
      return;
    }

    this.isRunning = false;

    // Clear all intervals
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals.clear();

    console.log('⏹️ Billing scheduler stopped');
  }

  // Check and run due jobs
  private checkAndRunJobs(): void {
    const now = new Date();

    this.jobs.forEach((job, jobId) => {
      if (job.status === 'active' && job.nextRun && job.nextRun <= now) {
        this.runJob(jobId);
      }
    });
  }

  // Run a specific job
  public async runJob(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return {
        success: false,
        message: `Job ${jobId} not found`,
        duration: 0
      };
    }

    const startTime = Date.now();
    console.log(`🔄 Running job: ${job.name}`);

    try {
      let result: JobResult;

      switch (jobId) {
        case 'auto_generate_invoices':
          result = await this.runAutoGenerateInvoices();
          break;
        case 'process_suspensions':
          result = await this.runProcessSuspensions();
          break;
        case 'send_email_notifications':
          result = await this.runSendEmailNotifications();
          break;
        case 'update_invoice_status':
          result = await this.runUpdateInvoiceStatus();
          break;
        case 'billing_analytics_update':
          result = await this.runBillingAnalyticsUpdate();
          break;
        default:
          result = {
            success: false,
            message: `Unknown job: ${jobId}`,
            duration: Date.now() - startTime
          };
      }

      // Update job status
      job.runCount++;
      job.lastRun = new Date();
      job.nextRun = this.calculateNextRun(job.schedule);
      job.status = result.success ? 'active' : 'error';

      if (!result.success) {
        job.errorCount++;
      }

      console.log(`${result.success ? '✅' : '❌'} Job ${job.name} completed: ${result.message}`);
      return result;

    } catch (error) {
      console.error(`❌ Job ${job.name} error:`, error);
      const errorResult = {
        success: false,
        message: `Job error: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };

      job.errorCount++;
      job.status = 'error';
      job.lastRun = new Date();
      job.nextRun = this.calculateNextRun(job.schedule);

      console.error(`❌ Job ${job.name} failed:`, error);
      return errorResult;
    }
  }

  // Job implementations
  private async runAutoGenerateInvoices(): Promise<JobResult> {
    const startTime = Date.now();
    try {

      // Get all active tenants
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, subscription_plan, created_at, email')
        .eq('status', 'active');

      if (error) throw error;

      // Pull live prices from the Owner-managed plans catalog (no more hardcoding).
      const planPrices = await this.fetchPlanPrices();

      const today = new Date();
      const invoicesGenerated: string[] = [];

      for (const tenant of tenants || []) {
        const createdDate = new Date(tenant.created_at);

        // Calculate next billing anniversary (1 month cycle)
        const nextAnniversary = new Date(createdDate);
        nextAnniversary.setMonth(nextAnniversary.getMonth() + 1);

        // Calculate invoice generation date (7 days before anniversary)
        const invoiceDate = new Date(nextAnniversary);
        invoiceDate.setDate(invoiceDate.getDate() - 7);

        // Check if today is the invoice generation day (7 days before anniversary)
        const isInvoiceDay = today.toDateString() === invoiceDate.toDateString();

        if (isInvoiceDay) {
          // Check if invoice already exists for this billing cycle
          const { data: existingInvoices } = await supabase
            .from('invoices')
            .select('id')
            .eq('tenant_id', tenant.id)
            .gte('created_at', new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString()) // Check last 24 hours
            .lt('created_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()); // Check next 24 hours

          if (!existingInvoices || existingInvoices.length === 0) {
            const amount = planPrices[tenant.subscription_plan] ?? 0;

            // Free / ฿0 plans are not billed — skip. (The old hardcoded path wrongly
            // charged them 2900 via a `|| 2900` fallback.)
            if (amount <= 0) {
              console.log(`⏭️ Skip billing ${tenant.name} — plan "${tenant.subscription_plan}" is ฿0`);
              continue;
            }

            // Generate invoice with 7-day payment terms
            const dueDate = new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days after invoice
            const success = await this.createInvoiceForTenant(tenant, dueDate, amount);

            if (success) {
              invoicesGenerated.push(`${tenant.name} (due: ${dueDate.toLocaleDateString('th-TH')})`);

              // Schedule email notifications for this invoice
              if (tenant.email) {
                emailService.scheduleInvoiceEmails({
                  tenant_name: tenant.name,
                  invoice_number: this.generateInvoiceNumber(),
                  amount: amount,
                  due_date: dueDate.toISOString(),
                  tenant_email: tenant.email
                });
              }

              console.log(`📄 Generated invoice for ${tenant.name}:`);
              console.log(`   Created: ${createdDate.toLocaleDateString('th-TH')}`);
              console.log(`   Anniversary: ${nextAnniversary.toLocaleDateString('th-TH')}`);
              console.log(`   Invoice Date: ${invoiceDate.toLocaleDateString('th-TH')} (7 days before)`);
              console.log(`   Due Date: ${dueDate.toLocaleDateString('th-TH')} (7 days after invoice)`);
            }
          }
        }
      }

      return {
        success: true,
        message: `Generated ${invoicesGenerated.length} invoices: ${invoicesGenerated.join(', ')}`,
        data: { invoicesGenerated },
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ Auto billing error:', error);
      return {
        success: false,
        message: `Error generating invoices: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async runProcessSuspensions(): Promise<JobResult> {
    const startTime = Date.now();
    const result = await suspensionService.processSuspensions();

    return {
      success: result.errors === 0,
      message: `Checked: ${result.checked}, Suspended: ${result.suspended}, Warnings: ${result.warnings}, Errors: ${result.errors}`,
      data: result,
      duration: Date.now() - startTime
    };
  }

  private async runSendEmailNotifications(): Promise<JobResult> {
    const startTime = Date.now();
    emailService.processQueue();

    const queueStatus = emailService.getQueueStatus();

    return {
      success: true,
      message: `Processed email queue. Total: ${queueStatus.total}, Scheduled: ${queueStatus.scheduled}`,
      data: queueStatus,
      duration: Date.now() - startTime
    };
  }

  private async runUpdateInvoiceStatus(): Promise<JobResult> {
    const startTime = Date.now();
    try {

      // Update overdue invoices
      const { data: updatedInvoices, error } = await supabase
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString());

      if (error) throw error;

      return {
        success: true,
        message: `Updated ${updatedInvoices?.length || 0} invoices to overdue status`,
        data: { updatedCount: updatedInvoices?.length || 0 },
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ Invoice status update error:', error);
      return {
        success: false,
        message: `Error updating invoice status: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async runBillingAnalyticsUpdate(): Promise<JobResult> {
    const startTime = Date.now();

    // Update analytics (placeholder)
    console.log('📊 Updating billing analytics...');

    return {
      success: true,
      message: 'Analytics updated successfully',
      duration: Date.now() - startTime
    };
  }

  // Helper methods
  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()) + String(now.getMinutes());
    return `INV-${year}${month}${day}-${time}`;
  }

  // Live plan prices from the Owner-managed `plans` catalog (replaces hardcoded values
  // so invoices always match what the Owner set in PackageCatalog). Returns
  // { planId: price_monthly }; empty on error → callers treat missing as ฿0 (skip).
  private async fetchPlanPrices(): Promise<Record<string, number>> {
    const { data, error } = await (supabase as any)
      .from('plans')
      .select('id, price_monthly');

    if (error || !data) {
      console.error('❌ Could not load plan prices from `plans`:', error);
      return {};
    }
    return Object.fromEntries(data.map((p: any) => [p.id, Number(p.price_monthly)]));
  }

  private async createInvoiceForTenant(tenant: any, dueDate?: Date, amount: number = 0): Promise<boolean> {
    try {
      const defaultDueDate = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      const invoiceData = {
        tenant_id: tenant.id,
        invoice_number: this.generateInvoiceNumber(),
        amount: amount,
        currency: 'THB',
        status: 'pending',
        subscription_plan: tenant.subscription_plan,
        due_date: defaultDueDate.toISOString(),
        description: `Monthly subscription - Auto-generated (7 days before anniversary)`,
        created_at: new Date().toISOString()
      };

      console.log(`📄 Auto-generating invoice for ${tenant.name}:`, invoiceData);

      const { data, error } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select();

      if (error) {
        console.error(`❌ Database error creating invoice for ${tenant.name}:`, error);
        throw error;
      }

      console.log(`✅ Successfully created invoice for ${tenant.name}:`, data);
      return true;

    } catch (error) {
      console.error(`❌ Error creating invoice for ${tenant.name}:`, error);
      return false;
    }
  }

  // Get job status
  public getJobStatus(jobId?: string): ScheduledJob[] | ScheduledJob | null {
    if (jobId) {
      return this.jobs.get(jobId) || null;
    }
    return Array.from(this.jobs.values());
  }

  // Get scheduler status
  public getSchedulerStatus(): {
    isRunning: boolean;
    totalJobs: number;
    activeJobs: number;
    errorJobs: number;
    uptime: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      isRunning: this.isRunning,
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'active').length,
      errorJobs: jobs.filter(j => j.status === 'error').length,
      uptime: this.isRunning ? Date.now() : 0
    };
  }

  // Manual job controls
  public pauseJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'paused';
      console.log(`⏸️ Paused job: ${job.name}`);
      return true;
    }
    return false;
  }

  public resumeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'active';
      job.nextRun = this.calculateNextRun(job.schedule);
      console.log(`▶️ Resumed job: ${job.name}`);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const billingScheduler = BillingScheduler.getInstance();