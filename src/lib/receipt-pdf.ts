// Receipt PDF Generator สำหรับใบเสร็จรับเงิน
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from './supabase';

interface ReceiptData {
  id: string;
  tenant_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  subscription_plan: string;
  due_date: string;
  paid_at?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  tenant?: {
    name: string;
    slug: string;
    billing_address?: string;
    billing_email?: string;
    billing_phone?: string;
    tax_id?: string;
  };
}

interface PaymentLog {
  id: string;
  payment_info: any;
  changed_by: string;
  created_at: string;
  reason: string | null;
}

export class ReceiptPDF {
  private formatCurrency(amount: number): string {
    return `${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  }

  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private formatDateTime(date: string): string {
    return new Date(date).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private getPlanName(plan: string): string {
    const plans: Record<string, string> = {
      starter: 'Starter Plan',
      professional: 'Professional Plan',
      enterprise: 'Enterprise Plan'
    };
    return plans[plan] || plan;
  }

  private getPaymentMethodName(method: string): string {
    const methods: Record<string, string> = {
      bank_transfer: 'โอนเงิน',
      credit_card: 'เครดิตการ์ด',
      cash: 'เงินสด',
      cheque: 'เช็ค'
    };
    return methods[method] || method;
  }

  private async fetchPaymentInfo(invoiceId: string): Promise<PaymentLog | null> {
    try {
      const { data, error } = await supabase
        .from('invoice_status_logs')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('new_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error fetching payment info:', error);
      return null;
    }
  }

  public async generateReceiptPDF(invoice: ReceiptData): Promise<void> {
    try {
      console.log('🧾 Creating receipt PDF...');

      // Fetch payment information
      const paymentLog = await this.fetchPaymentInfo(invoice.id);

      const subtotal = invoice.amount / 1.07;
      const vat = invoice.amount * 0.07 / 1.07;

      // สร้างเลขที่ใบเสร็จ
      const receiptNumber = `RC-${invoice.invoice_number.replace('INV-', '')}`;

      // Create receipt container
      const container = document.createElement('div');
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 800px;
        background: white;
        padding: 40px;
        z-index: 9999;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #333;
      `;

      container.innerHTML = `
        <!-- Header -->
        <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #ddd;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="background: #16a34a; color: white; padding: 15px 20px; border-radius: 8px; display: inline-block;">
                <div style="font-size: 18px; font-weight: bold;">CHATEAU</div>
                <div style="font-size: 12px;">PLATFORM</div>
              </div>
            </div>
            <div style="text-align: right; font-size: 12px;">
              <div>บริษัท ชาโต แพลตฟอร์ม จำกัด</div>
              <div>123 Technology Park, Bangkok 10110</div>
              <div>โทร: 02-XXX-XXXX</div>
              <div>อีเมล: billing@chateau-platform.com</div>
              <div>เลขประจำตัวผู้เสียภาษี: 0123456789012</div>
            </div>
          </div>
        </div>

        <!-- Title -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 24px; font-weight: bold; color: #16a34a; margin-bottom: 8px;">ใบเสร็จรับเงิน / RECEIPT</h1>
          <div style="font-size: 12px; color: #16a34a; font-weight: 600;">✓ เอกสารภาษีอิเล็กทรอนิกส์</div>
        </div>

        <!-- Receipt Info Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
          <!-- Left Column -->
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border: 1px solid #16a34a;">
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; border-bottom: 1px solid #16a34a; padding-bottom: 5px; color: #16a34a;">ข้อมูลใบเสร็จ</div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">เลขที่ใบเสร็จ:</span>
              <span style="font-weight: 600; color: #16a34a;">${receiptNumber}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">อ้างอิงใบแจ้งหนี้:</span>
              <span style="font-weight: 600;">${invoice.invoice_number}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">วันที่ออกบิล:</span>
              <span style="font-weight: 600;">${this.formatDate(invoice.created_at)}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">วันที่ชำระ:</span>
              <span style="font-weight: 600; color: #16a34a;">
                ${invoice.paid_at ? this.formatDate(invoice.paid_at) :
                  (paymentLog?.payment_info?.date ? this.formatDate(paymentLog.payment_info.date) :
                  this.formatDate(new Date().toISOString()))}
              </span>
            </div>

            <div>
              <span style="display: inline-block; width: 120px; color: #666;">สถานะ:</span>
              <span style="
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                background: #dcfce7;
                color: #166534;
              ">ชำระแล้ว ✓</span>
            </div>
          </div>

          <!-- Right Column -->
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border: 1px solid #16a34a;">
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; border-bottom: 1px solid #16a34a; padding-bottom: 5px; color: #16a34a;">ชำระเงินให้</div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">ชื่อบริษัท:</span>
              <span style="font-weight: 600;">${invoice.tenant?.name || 'ไม่ระบุ'}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">รหัสลูกค้า:</span>
              <span style="font-weight: 600; font-family: monospace;">${invoice.tenant?.slug || 'ไม่ระบุ'}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">แผนบริการ:</span>
              <span style="font-weight: 600;">${this.getPlanName(invoice.subscription_plan)}</span>
            </div>
          </div>
        </div>

        <!-- Payment Method -->
        ${paymentLog?.payment_info ? `
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">รายละเอียดการชำระเงิน</div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            ${paymentLog.payment_info.method ? `
            <div>
              <span style="display: inline-block; width: 120px; color: #666;">วิธีการชำระ:</span>
              <span style="font-weight: 600;">${this.getPaymentMethodName(paymentLog.payment_info.method)}</span>
            </div>
            ` : ''}

            ${paymentLog.payment_info.reference ? `
            <div>
              <span style="display: inline-block; width: 120px; color: #666;">หมายเลขอ้างอิง:</span>
              <span style="font-weight: 600; font-family: monospace;">${paymentLog.payment_info.reference}</span>
            </div>
            ` : ''}

            ${paymentLog.payment_info.amount ? `
            <div>
              <span style="display: inline-block; width: 120px; color: #666;">จำนวนที่ชำระ:</span>
              <span style="font-weight: 600; color: #16a34a;">${this.formatCurrency(paymentLog.payment_info.amount)}</span>
            </div>
            ` : ''}
          </div>

          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666;">
            ชำระโดย: ${paymentLog.changed_by} • ${this.formatDateTime(paymentLog.created_at)}
          </div>
        </div>
        ` : ''}

        <!-- Service Details -->
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e5e7eb;">
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">รายการบริการ</div>

          <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-weight: 600;">รายการ</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd; font-weight: 600;">จำนวน</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; font-weight: 600;">ราคา</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background: white;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-weight: 600;">${this.getPlanName(invoice.subscription_plan)}</div>
                    <div style="font-size: 12px; color: #666;">ค่าบริการรายเดือน</div>
                    ${invoice.description ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${invoice.description}</div>` : ''}
                  </td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">1</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
                    ${this.formatCurrency(subtotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Payment Summary -->
        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f7fa 100%); padding: 25px; border-radius: 12px; border: 2px solid #16a34a;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #16a34a; text-align: center;">สรุปการชำระเงิน</div>

          <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #16a34a;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>ยอดก่อน VAT:</span>
              <span style="font-weight: 600;">${this.formatCurrency(subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb;">
              <span>VAT 7%:</span>
              <span style="font-weight: 600;">${this.formatCurrency(vat)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 18px; font-weight: 600; color: #16a34a;">ยอดรวม:</span>
              <span style="font-size: 24px; font-weight: 700; color: #16a34a;">${this.formatCurrency(invoice.amount)}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
          <div style="margin-bottom: 10px;">
            <strong style="color: #16a34a;">ขอบคุณที่ใช้บริการ CHATEAU PLATFORM</strong>
          </div>
          <div style="margin-bottom: 8px;">
            เอกสารฉบับนี้ออกโดยระบบอัตโนมัติ • วันที่พิมพ์: ${this.formatDateTime(new Date().toISOString())}
          </div>
          <div>
            หากมีข้อสงสัย กรุณาติดต่อ: billing@chateau-platform.com หรือ 02-XXX-XXXX
          </div>
        </div>
      `;

      // Add to DOM temporarily
      document.body.appendChild(container);

      // Generate PDF
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // Remove from DOM
      document.body.removeChild(container);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save the PDF
      pdf.save(`ใบเสร็จ_${receiptNumber}.pdf`);
      console.log('✅ Receipt PDF generated successfully');

    } catch (error) {
      console.error('❌ Error generating receipt PDF:', error);
      throw error;
    }
  }
}

// Export a convenience function
export const generateReceiptPDF = async (invoice: ReceiptData) => {
  const generator = new ReceiptPDF();
  return generator.generateReceiptPDF(invoice);
};