// Email Notification Service for CHATEAU Platform
// ระบบส่งอีเมลแจ้งเตือนสำหรับการเรียกเก็บเงิน

import { Resend } from 'resend';

interface EmailTemplate {
  subject: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
}

interface InvoiceEmailData {
  tenant_name: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  days_past_due?: number;
  tenant_email?: string;
  login_url?: string;
}

export class EmailService {
  private static instance: EmailService;
  private resend: Resend | null = null;
  private emailQueue: Array<{
    to: string;
    subject: string;
    body: string;
    priority: string;
    scheduledFor?: Date;
  }> = [];

  private isProduction: boolean = import.meta.env.MODE === 'production';
  private fromEmail: string = import.meta.env.VITE_FROM_EMAIL || 'onboarding@resend.dev';
  private fromName: string = import.meta.env.VITE_FROM_NAME || 'CHATEAU Platform';

  private constructor() {
    // Initialize Resend with API key (only in production)
    if (this.isProduction) {
      const apiKey = import.meta.env.RESEND_API_KEY || import.meta.env.VITE_RESEND_API_KEY;
      if (apiKey) {
        this.resend = new Resend(apiKey);
        console.log('✅ Resend initialized for production');
      } else {
        console.warn('⚠️ RESEND_API_KEY not found, using mock email');
        this.isProduction = false;
      }
    }
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  // Email Templates
  private getTemplates(): Record<string, EmailTemplate> {
    return {
      // วันที่ส่งใบแจ้งหนี้
      invoice_created: {
        subject: '🧾 ใบแจ้งหนี้ใหม่ - CHATEAU Platform',
        body: `
เรียน {{tenant_name}}

เรามีความยินดีที่จะแจ้งให้ทราบว่า ใบแจ้งหนี้สำหรับบริการของท่านได้ถูกสร้างแล้ว

รายละเอียดใบแจ้งหนี้:
📄 หมายเลข: {{invoice_number}}
💰 จำนวนเงิน: {{amount}} บาท
📅 กำหนดชำระ: {{due_date}}

วิธีการชำระเงิน:
🏦 โอนเข้าบัญชี: xxx-x-xxxxx-x ธนาคารกสิกรไทย
📱 สแกน QR Code PromptPay: (แนบในเอกสาร)
💳 เช็คสำหรับองค์กร

เมื่อชำระเงินแล้ว กรุณาแจ้งกลับมาที่:
📧 ${process.env.VITE_BILLING_EMAIL || 'billing@chateau-platform.com'}
📞 ${process.env.VITE_SUPPORT_PHONE || '02-xxx-xxxx'}

ขอขอบคุณที่ใช้บริการ CHATEAU Platform
        `,
        priority: 'normal'
      },

      // 4 วันหลังส่งใบแจ้งหนี้ (เหลือ 3 วัน)
      reminder_3_days: {
        subject: '⏰ แจ้งเตือน: เหลือ 3 วัน ครบกำหนดชำระ',
        body: `
เรียน {{tenant_name}}

แจ้งเตือนการชำระเงิน - เหลือ 3 วันก่อนครบกำหนด

รายละเอียด:
📄 ใบแจ้งหนี้: {{invoice_number}}
💰 จำนวนเงิน: {{amount}} บาท
📅 ครบกำหนด: {{due_date}}
⏰ เหลือเวลา: 3 วัน

หากชำระเงินแล้ว กรุณาแจ้งกลับมาเพื่อยืนยัน
        `,
        priority: 'normal'
      },

      // 14 วันหลังส่งใบแจ้งหนี้ (เหลือ 1 วัน)
      reminder_1_day: {
        subject: '🚨 ด่วน: พรุ่งนี้ครบกำหนดชำระ',
        body: `
เรียน {{tenant_name}}

แจ้งเตือนด่วน - พรุ่งนี้ครบกำหนดชำระเงิน

รายละเอียด:
📄 ใบแจ้งหนี้: {{invoice_number}}
💰 จำนวนเงิน: {{amount}} บาท
📅 ครบกำหนด: {{due_date}}
⚠️ เหลือเวลา: 1 วัน

เพื่อป้องกันการหยุดบริการ กรุณาชำระภายในวันพรุ่งนี้
        `,
        priority: 'high'
      },

      // 16 วัน (เกินกำหนด 1 วัน)
      overdue_notice: {
        subject: '❌ เกินกำหนดชำระ - กรุณาชำระด่วน',
        body: `
เรียน {{tenant_name}}

แจ้งเตือน: การชำระเงินเกินกำหนดแล้ว {{days_past_due}} วัน

รายละเอียด:
📄 ใบแจ้งหนี้: {{invoice_number}}
💰 จำนวนเงิน: {{amount}} บาท
📅 เกินกำหนด: {{days_past_due}} วัน
⚠️ Grace Period: เหลือ {{grace_days_left}} วัน

กรุณาชำระเงินโดยเร็วที่สุด เพื่อป้องกันการระงับบริการ
        `,
        priority: 'high'
      },

      // 20 วัน (เกินกำหนด 5 วัน)
      final_warning: {
        subject: '🔴 คำเตือนสุดท้าย - บริการจะถูกระงับใน 2 วัน',
        body: `
เรียน {{tenant_name}}

คำเตือนสุดท้าย - บริการจะถูกระงับในอีก 2 วัน

รายละเอียด:
📄 ใบแจ้งหนี้: {{invoice_number}}
💰 จำนวนเงิน: {{amount}} บาท
📅 เกินกำหนด: {{days_past_due}} วัน
🔴 บริการจะหยุด: {{suspension_date}}

กรุณาติดต่อเราโดยด่วนเพื่อหาทางแก้ไข:
📧 ${process.env.VITE_BILLING_EMAIL || 'billing@chateau-platform.com'}
📞 ${process.env.VITE_SUPPORT_PHONE || '02-xxx-xxxx'} (กด 2 สำหรับฝ่ายการเงิน)
        `,
        priority: 'urgent'
      },

      // 22 วัน (ระงับบริการ)
      service_suspended: {
        subject: '🚫 บริการถูกระงับ - กรุณาติดต่อด่วน',
        body: `
เรียน {{tenant_name}}

บริการ CHATEAU Platform ของท่านถูกระงับแล้ว

สาเหตุ: การชำระเงินเกินกำหนด {{days_past_due}} วัน
📄 ใบแจ้งหนี้: {{invoice_number}}
💰 ยอดค้าง: {{amount}} บาท

ข้อมูลของท่านยังปลอดภัย แต่ไม่สามารถใช้งานระบบได้จนกว่าจะชำระเงิน

เมื่อชำระเงินแล้ว บริการจะกลับมาใช้งานได้ทันที

ติดต่อเรา:
📧 ${process.env.VITE_BILLING_EMAIL || 'billing@chateau-platform.com'}
📞 ${process.env.VITE_SUPPORT_PHONE || '02-xxx-xxxx'} (กด 2 สำหรับฝ่ายการเงิน)
💬 Line: @chateau-support
        `,
        priority: 'urgent'
      },

      // เมื่อชำระเงินแล้ว
      payment_received: {
        subject: '✅ ยืนยันการรับชำระเงิน - ขอบคุณ',
        body: `
เรียน {{tenant_name}}

ขอบคุณสำหรับการชำระเงิน

รายละเอียด:
📄 ใบแจ้งหนี้: {{invoice_number}}
💰 จำนวนเงิน: {{amount}} บาท
📅 วันที่ชำระ: {{payment_date}}
✅ สถานะ: ชำระเงินแล้ว

บริการของท่านพร้อมใช้งานแล้ว
เข้าสู่ระบบที่: {{login_url}}

ขอบคุณที่ใช้บริการ CHATEAU Platform
        `,
        priority: 'normal'
      }
    };
  }

  // Replace template variables
  private fillTemplate(template: string, data: InvoiceEmailData): string {
    let result = template;

    result = result.replace(/{{tenant_name}}/g, data.tenant_name);
    result = result.replace(/{{invoice_number}}/g, data.invoice_number);
    result = result.replace(/{{amount}}/g, data.amount.toLocaleString());
    result = result.replace(/{{due_date}}/g, new Date(data.due_date).toLocaleDateString('th-TH'));

    // Replace environment variables
    result = result.replace(/\${process\.env\.VITE_BILLING_EMAIL \|\| 'billing@chateau-platform\.com'}/g,
      import.meta.env.VITE_BILLING_EMAIL || 'billing@chateau-platform.com');
    result = result.replace(/\${process\.env\.VITE_SUPPORT_PHONE \|\| '02-xxx-xxxx'}/g,
      import.meta.env.VITE_SUPPORT_PHONE || '02-xxx-xxxx');

    if (data.days_past_due !== undefined) {
      result = result.replace(/{{days_past_due}}/g, data.days_past_due.toString());
      result = result.replace(/{{grace_days_left}}/g, Math.max(0, 7 - data.days_past_due).toString());

      const suspensionDate = new Date(data.due_date);
      suspensionDate.setDate(suspensionDate.getDate() + 7);
      result = result.replace(/{{suspension_date}}/g, suspensionDate.toLocaleDateString('th-TH'));
    }

    if (data.login_url) {
      result = result.replace(/{{login_url}}/g, data.login_url);
    }

    const paymentDate = new Date().toLocaleDateString('th-TH');
    result = result.replace(/{{payment_date}}/g, paymentDate);

    return result;
  }

  // Queue email for sending
  public async queueEmail(
    templateType: string,
    data: InvoiceEmailData,
    scheduledFor?: Date
  ): Promise<boolean> {
    try {
      const templates = this.getTemplates();
      const template = templates[templateType];

      if (!template) {
        console.error(`❌ Email template '${templateType}' not found`);
        return false;
      }

      const email = {
        to: data.tenant_email || import.meta.env.VITE_BILLING_EMAIL || 'billing@chateau-platform.com',
        subject: this.fillTemplate(template.subject, data),
        body: this.fillTemplate(template.body, data),
        priority: template.priority,
        scheduledFor: scheduledFor || new Date()
      };

      this.emailQueue.push(email);
      console.log(`📧 Queued email: ${email.subject} to ${email.to}`);

      // Send email (real or mock)
      if (this.isProduction) {
        await this.sendRealEmail(email);
      } else {
        this.mockSendEmail(email);
      }

      return true;
    } catch (error) {
      console.error('❌ Error queueing email:', error);
      return false;
    }
  }

  // Send real email via Resend
  private async sendRealEmail(email: any): Promise<void> {
    try {
      if (!this.resend) {
        throw new Error('Resend not initialized');
      }

      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [email.to],
        subject: email.subject,
        text: email.body,
        html: email.body.replace(/\n/g, '<br>') // Convert line breaks to HTML
      });

      if (error) {
        console.error('❌ Resend API error:', error);
        throw error;
      }

      console.log(`✅ Email sent successfully to ${email.to}`, data);
    } catch (error) {
      console.error('❌ Error sending email via Resend:', error);
      throw error;
    }
  }

  // Mock email sending (for development/testing)
  private mockSendEmail(email: any) {
    setTimeout(() => {
      console.log(`\n📨 EMAIL SENT (Mock):`);
      console.log(`To: ${email.to}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Priority: ${email.priority}`);
      console.log(`Body:\n${email.body}`);
      console.log(`\n✅ Email delivered successfully (Mock)!\n`);
    }, 1000);
  }

  // Schedule email based on invoice status
  public scheduleInvoiceEmails(invoiceData: InvoiceEmailData): void {
    const dueDate = new Date(invoiceData.due_date);
    const now = new Date();
    const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Schedule all future emails based on NEW TIMELINE
    const schedules = [
      { days: 0, template: 'invoice_created' },      // Day 0: Invoice created (7 days before anniversary)
      { days: 4, template: 'reminder_3_days' },      // Day 4: 3 days before due date
      { days: 6, template: 'reminder_1_day' },       // Day 6: 1 day before due date
      { days: 8, template: 'overdue_notice' },       // Day 8: 1 day overdue (after 7-day payment term)
      { days: 12, template: 'final_warning' },       // Day 12: 5 days overdue (warning before suspension)
      { days: 14, template: 'service_suspended' },   // Day 14: 7 days overdue (suspension day)
    ];

    schedules.forEach(schedule => {
      const emailDate = new Date(dueDate);
      emailDate.setDate(emailDate.getDate() + schedule.days);

      // Only schedule future emails
      if (emailDate > now) {
        this.queueEmail(schedule.template, invoiceData, emailDate);
      }
    });
  }

  // Get email queue status
  public getQueueStatus(): { total: number; scheduled: number; sent: number } {
    const now = new Date();
    const scheduled = this.emailQueue.filter(email =>
      email.scheduledFor && email.scheduledFor > now
    ).length;

    return {
      total: this.emailQueue.length,
      scheduled,
      sent: this.emailQueue.length - scheduled
    };
  }

  // Process email queue (call this in cron job)
  public async processQueue(): Promise<void> {
    const now = new Date();
    const readyToSend = this.emailQueue.filter(email =>
      email.scheduledFor && email.scheduledFor <= now
    );

    for (const email of readyToSend) {
      try {
        if (this.isProduction) {
          await this.sendRealEmail(email);
        } else {
          this.mockSendEmail(email);
        }
      } catch (error) {
        console.error(`❌ Failed to send email to ${email.to}:`, error);
      }
    }

    // Remove sent emails from queue
    this.emailQueue = this.emailQueue.filter(email =>
      email.scheduledFor && email.scheduledFor > now
    );

    if (readyToSend.length > 0) {
      console.log(`📧 Processed ${readyToSend.length} emails from queue`);
    }
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();