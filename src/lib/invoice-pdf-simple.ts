// Simple Thai Invoice PDF Generator
// ระบบสร้าง PDF ภาษาไทยแบบง่าย

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceData {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  subscription_plan: string;
  due_date: string;
  paid_at?: string;
  description?: string;
  created_at: string;
  tenant?: {
    name: string;
    slug: string;
    billing_address?: string;
    billing_email?: string;
    billing_phone?: string;
    tax_id?: string;
  };
}

export class SimpleThaiInvoicePDF {
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

  private getStatusText(status: string): string {
    const statuses: Record<string, string> = {
      paid: 'ชำระแล้ว',
      pending: 'รอชำระ',
      overdue: 'เกินกำหนด',
      cancelled: 'ยกเลิก'
    };
    return statuses[status] || 'รอชำระ';
  }

  private getPlanName(plan: string): string {
    const plans: Record<string, string> = {
      starter: 'Starter Plan',
      professional: 'Professional Plan',
      enterprise: 'Enterprise Plan'
    };
    return plans[plan] || plan;
  }

  public async generateInvoicePDF(invoice: InvoiceData): Promise<void> {
    try {
      console.log('🚀 Creating simple Thai PDF...');

      const subtotal = invoice.amount / 1.07;
      const vat = invoice.amount * 0.07 / 1.07;

      // Create a simple container div
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
              <div style="background: #2563eb; color: white; padding: 15px 20px; border-radius: 8px; display: inline-block;">
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
          <h1 style="font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 8px;">ใบแจ้งหนี้ / INVOICE</h1>
          <div style="font-size: 12px; color: #666; font-style: italic;">(เอกสารฉบับนี้ไม่ใช่ใบเสร็จรับเงิน)</div>
        </div>

        <!-- Invoice Info Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
          <!-- Left Column -->
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">ข้อมูลใบแจ้งหนี้</div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">เลขที่บิล:</span>
              <span style="font-weight: 600;">${invoice.invoice_number}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">วันออกบิล:</span>
              <span style="font-weight: 600;">${this.formatDate(invoice.created_at)}</span>
            </div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">กำหนดชำระ:</span>
              <span style="font-weight: 600;">${this.formatDate(invoice.due_date)}</span>
            </div>

            <div>
              <span style="display: inline-block; width: 120px; color: #666;">สถานะ:</span>
              <span style="
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                background: ${invoice.status === 'paid' ? '#dcfce7; color: #166534' :
                            invoice.status === 'pending' ? '#fef3c7; color: #92400e' :
                            invoice.status === 'overdue' ? '#fee2e2; color: #dc2626' :
                            '#f3f4f6; color: #6b7280'};
              ">${this.getStatusText(invoice.status)}</span>
            </div>
          </div>

          <!-- Right Column -->
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">ออกบิลให้</div>

            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">ชื่อบริษัท:</span>
              <span style="font-weight: 600;">${invoice.tenant?.name || 'ไม่ระบุ'}</span>
            </div>

            ${invoice.tenant?.tax_id ? `
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">เลขผู้เสียภาษี:</span>
              <span style="font-weight: 600;">${invoice.tenant.tax_id}</span>
            </div>
            ` : ''}

            ${invoice.tenant?.billing_address ? `
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">ที่อยู่:</span>
              <span style="font-weight: 600;">${invoice.tenant.billing_address}</span>
            </div>
            ` : ''}

            ${invoice.tenant?.billing_email ? `
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">อีเมล:</span>
              <span style="font-weight: 600;">${invoice.tenant.billing_email}</span>
            </div>
            ` : ''}

            ${invoice.tenant?.billing_phone ? `
            <div style="margin-bottom: 8px;">
              <span style="display: inline-block; width: 120px; color: #666;">เบอร์โทร:</span>
              <span style="font-weight: 600;">${invoice.tenant.billing_phone}</span>
            </div>
            ` : ''}

            <div>
              <span style="display: inline-block; width: 120px; color: #666;">แผนการใช้งาน:</span>
              <span style="font-weight: 600;">${this.getPlanName(invoice.subscription_plan)}</span>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 15px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db;">รายละเอียด</th>
              <th style="padding: 15px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; width: 80px;">จำนวน</th>
              <th style="padding: 15px; text-align: right; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; width: 120px;">ราคาต่อหน่วย</th>
              <th style="padding: 15px; text-align: right; font-weight: 600; color: #374151; border-bottom: 1px solid #d1d5db; width: 120px;">ยอดเงิน</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
                ${this.getPlanName(invoice.subscription_plan)} - รายเดือน
                ${invoice.description ? `<br><small style="color: #6b7280;">${invoice.description}</small>` : ''}
              </td>
              <td style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb;">1</td>
              <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb;">${this.formatCurrency(invoice.amount)}</td>
              <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb;">${this.formatCurrency(invoice.amount)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Totals -->
        <div style="margin-left: auto; width: 300px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding: 5px 0;">
            <span>ยอดค้างชำระ:</span>
            <span>${this.formatCurrency(subtotal)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding: 5px 0;">
            <span>7.00% ภาษีมูลค่าเพิ่ม/VAT:</span>
            <span>${this.formatCurrency(vat)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding: 5px 0;">
            <span>หักเครดิต:</span>
            <span>0.00 บาท</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-top: 2px solid #1e40af; padding-top: 15px; font-weight: 700; font-size: 16px; color: #1e40af;">
            <span>ทั้งหมด:</span>
            <span>${this.formatCurrency(invoice.amount)}</span>
          </div>
        </div>

        <!-- Payment Info -->
        <div style="padding: 20px; background: #fefefe; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="font-size: 18px; font-weight: 600; color: #1e40af; margin-bottom: 20px; border-bottom: 1px solid #d1d5db; padding-bottom: 10px;">วิธีการชำระเงิน</div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <div style="font-weight: 600; margin-bottom: 10px;">โอนเงินผ่านธนาคาร</div>
              <div style="font-size: 13px; line-height: 1.6; color: #6b7280;">
                ธนาคารกสิกรไทย สาขาสีลม<br>
                เลขที่บัญชี: 123-4-56789-0<br>
                ชื่อบัญชี: บริษัท ชาโต แพลตฟอร์ม จำกัด
              </div>
            </div>

            <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <div style="font-weight: 600; margin-bottom: 10px;">PromptPay QR Code</div>
              <div style="font-size: 13px; line-height: 1.6; color: #6b7280;">
                สแกน QR Code หรือโอนไปที่<br>
                เลขประจำตัวผู้เสียภาษี: 0123456789012
              </div>
            </div>
          </div>

          <div style="padding: 15px; background: #eff6ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 5px;">หมายเหตุสำคัญ:</div>
            <div style="font-size: 13px; color: #1e40af;">
              • กรุณาแจ้งการชำระเงินกลับมาที่ billing@chateau-platform.com<br>
              • แนบหลักฐานการโอนเงิน เพื่อความรวดเร็วในการตรวจสอบ<br>
              • ติดต่อสอบถาม: 02-XXX-XXXX กด 2 (ฝ่ายการเงิน)
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
          PDF Generated on ${this.formatDate(new Date().toISOString())}<br>
          สร้างโดยระบบ CHATEAU Platform อัตโนมัติ
        </div>
      `;

      document.body.appendChild(container);

      // Wait for rendering
      console.log('⏳ Waiting for rendering...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('📸 Capturing screenshot...');

      // Generate canvas
      const canvas = await html2canvas(container, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        height: container.offsetHeight
      });

      // Remove container
      document.body.removeChild(container);

      console.log('📄 Creating PDF...');

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/jpeg', 0.9);

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

      // Save PDF
      const filename = `${invoice.invoice_number}_${invoice.tenant?.name || 'Invoice'}.pdf`;
      pdf.save(filename);

      console.log(`✅ Simple Thai PDF generated: ${filename}`);

    } catch (error) {
      console.error('❌ Error generating simple Thai PDF:', error);
      throw new Error(`ไม่สามารถสร้าง PDF ได้: ${(error as Error).message}`);
    }
  }
}

export const generateSimpleThaiPDF = (invoice: InvoiceData): Promise<void> => {
  const generator = new SimpleThaiInvoicePDF();
  return generator.generateInvoicePDF(invoice);
};