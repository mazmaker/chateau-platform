// Thai Invoice PDF Generator using HTML2Canvas + jsPDF
// ระบบสร้าง PDF ภาษาไทยด้วย HTML Template

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
  };
}

export class ThaiInvoicePDFGenerator {
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

  private createInvoiceHTML(invoice: InvoiceData): string {
    const subtotal = invoice.amount / 1.07;
    const vat = invoice.amount * 0.07 / 1.07;

    return `
      <div style="
        font-family: 'Sarabun', 'Segoe UI', Tahoma, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        background: white;
        width: 794px;
        min-height: 1123px;
        padding: 40px;
        box-sizing: border-box;
      ">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }

            .company-logo {
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              color: white;
              padding: 15px 20px;
              border-radius: 8px;
              text-align: center;
            }

            .company-name {
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 5px;
            }

            .company-subtitle {
              font-size: 12px;
              opacity: 0.9;
            }

            .company-info {
              text-align: right;
              font-size: 12px;
              line-height: 1.8;
            }

            .invoice-title {
              text-align: center;
              margin-bottom: 30px;
            }

            .invoice-title h1 {
              font-size: 28px;
              font-weight: 700;
              color: #1e40af;
              margin-bottom: 8px;
            }

            .document-note {
              font-size: 12px;
              color: #6b7280;
              font-style: italic;
            }

            .invoice-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-bottom: 30px;
            }

            .invoice-info, .customer-info {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
            }

            .section-title {
              font-size: 16px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 15px;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 5px;
            }

            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }

            .info-label {
              font-weight: 500;
              color: #6b7280;
            }

            .info-value {
              font-weight: 600;
              color: #1f2937;
            }

            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-align: center;
            }

            .status-paid { background: #dcfce7; color: #166534; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-overdue { background: #fee2e2; color: #dc2626; }
            .status-cancelled { background: #f3f4f6; color: #6b7280; }

            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }

            .items-table th {
              background: #f3f4f6;
              padding: 15px;
              text-align: left;
              font-weight: 600;
              color: #374151;
              border-bottom: 1px solid #d1d5db;
            }

            .items-table td {
              padding: 15px;
              border-bottom: 1px solid #e5e7eb;
            }

            .items-table tr:last-child td {
              border-bottom: none;
            }

            .totals {
              margin-left: auto;
              width: 300px;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding: 5px 0;
            }

            .total-row.grand-total {
              border-top: 2px solid #1e40af;
              padding-top: 15px;
              margin-top: 15px;
              font-weight: 700;
              font-size: 16px;
              color: #1e40af;
            }

            .payment-info {
              margin-top: 40px;
              padding: 20px;
              background: #fefefe;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
            }

            .payment-title {
              font-size: 18px;
              font-weight: 600;
              color: #1e40af;
              margin-bottom: 20px;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 10px;
            }

            .payment-methods {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }

            .payment-method {
              background: white;
              padding: 15px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }

            .method-title {
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 10px;
            }

            .method-details {
              font-size: 13px;
              line-height: 1.6;
              color: #6b7280;
            }

            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 12px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div class="company-logo">
              <div class="company-name">CHATEAU</div>
              <div class="company-subtitle">PLATFORM</div>
            </div>
            <div class="company-info">
              บริษัท ชาโต แพลตฟอร์ม จำกัด<br>
              123 Technology Park, Bangkok 10110<br>
              โทร: 02-XXX-XXXX<br>
              อีเมล: billing@chateau-platform.com<br>
              เลขประจำตัวผู้เสียภาษี: 0123456789012
            </div>
          </div>

          <!-- Invoice Title -->
          <div class="invoice-title">
            <h1>ใบแจ้งหนี้ / INVOICE</h1>
            <div class="document-note">(เอกสารฉบับนี้ไม่ใช่ใบเสร็จรับเงิน)</div>
          </div>

          <!-- Invoice Details -->
          <div class="invoice-details">
            <div class="invoice-info">
              <div class="section-title">ข้อมูลใบแจ้งหนี้</div>
              <div class="info-row">
                <span class="info-label">เลขที่บิล:</span>
                <span class="info-value">${invoice.invoice_number}</span>
              </div>
              <div class="info-row">
                <span class="info-label">วันออกบิล:</span>
                <span class="info-value">${this.formatDate(invoice.created_at)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">กำหนดชำระ:</span>
                <span class="info-value">${this.formatDate(invoice.due_date)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">สถานะ:</span>
                <span class="status-badge status-${invoice.status}">${this.getStatusText(invoice.status)}</span>
              </div>
            </div>

            <div class="customer-info">
              <div class="section-title">ออกบิลให้</div>
              <div class="info-row">
                <span class="info-label">ชื่อบริษัท:</span>
                <span class="info-value">${invoice.tenant?.name || 'ไม่ระบุ'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">บัญชีผู้ใช้:</span>
                <span class="info-value">${invoice.tenant?.slug || 'ไม่ระบุ'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">แผนการใช้งาน:</span>
                <span class="info-value">${this.getPlanName(invoice.subscription_plan)}</span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th>รายละเอียด</th>
                <th width="100px">จำนวน</th>
                <th width="120px">ราคาต่อหน่วย</th>
                <th width="120px">ยอดเงิน</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${this.getPlanName(invoice.subscription_plan)} - รายเดือน<br>
                    <small style="color: #6b7280;">${invoice.description || ''}</small></td>
                <td>1</td>
                <td>${this.formatCurrency(invoice.amount)}</td>
                <td>${this.formatCurrency(invoice.amount)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals">
            <div class="total-row">
              <span>ยอดค้างชำระ:</span>
              <span>${this.formatCurrency(subtotal)}</span>
            </div>
            <div class="total-row">
              <span>7.00% ภาษีมูลค่าเพิ่ม/VAT:</span>
              <span>${this.formatCurrency(vat)}</span>
            </div>
            <div class="total-row">
              <span>หักเครดิต:</span>
              <span>0.00 บาท</span>
            </div>
            <div class="total-row grand-total">
              <span>ทั้งหมด:</span>
              <span>${this.formatCurrency(invoice.amount)}</span>
            </div>
          </div>

          <!-- Payment Information -->
          <div class="payment-info">
            <div class="payment-title">วิธีการชำระเงิน</div>
            <div class="payment-methods">
              <div class="payment-method">
                <div class="method-title">🏦 โอนเงินผ่านธนาคาร</div>
                <div class="method-details">
                  ธนาคารกสิกรไทย สาขาสีลม<br>
                  เลขที่บัญชี: 123-4-56789-0<br>
                  ชื่อบัญชี: บริษัท ชาโต แพลตฟอร์ม จำกัด
                </div>
              </div>
              <div class="payment-method">
                <div class="method-title">📱 PromptPay QR Code</div>
                <div class="method-details">
                  สแกน QR Code หรือโอนไปที่<br>
                  เลขประจำตัวผู้เสียภาษี: 0123456789012
                </div>
              </div>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #eff6ff; border-radius: 6px; border-left: 4px solid #3b82f6;">
              <div style="font-weight: 600; color: #1e40af; margin-bottom: 5px;">📝 หมายเหตุสำคัญ:</div>
              <div style="font-size: 13px; color: #1e40af;">
                • กรุณาแจ้งการชำระเงินกลับมาที่ billing@chateau-platform.com<br>
                • แนบหลักฐานการโอนเงิน เพื่อความรวดเร็วในการตรวจสอบ<br>
                • ติดต่อสอบถาม: 02-XXX-XXXX กด 2 (ฝ่ายการเงิน)
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            PDF Generated on ${this.formatDate(new Date().toISOString())}<br>
            สร้างโดยระบบ CHATEAU Platform อัตโนมัติ
          </div>
        </body>
      </html>
    `;
  }

  public async generateInvoicePDF(invoice: InvoiceData): Promise<void> {
    try {
      console.log('🚀 Starting PDF generation...');

      // Create container element that's visible but positioned off-screen
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0px';
      container.style.left = '0px';
      container.style.width = '794px';
      container.style.height = 'auto';
      container.style.zIndex = '9999';
      container.style.backgroundColor = '#ffffff';
      container.style.overflow = 'visible';

      // Create the HTML content
      const htmlContent = this.createInvoiceHTML(invoice);
      container.innerHTML = htmlContent;

      // Add to DOM
      document.body.appendChild(container);

      // Wait for fonts to load
      console.log('⏳ Loading fonts...');
      await document.fonts.ready;

      // Wait additional time for complete rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find the actual content (body element from the HTML)
      const bodyElement = container.querySelector('body');
      if (!bodyElement) {
        throw new Error('HTML body not found');
      }

      console.log('📸 Capturing screenshot...');

      // Generate canvas
      const canvas = await html2canvas(bodyElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        scrollX: 0,
        scrollY: 0,
        logging: false
      });

      // Remove container
      document.body.removeChild(container);

      console.log('📄 Creating PDF...');

      // Create PDF with better dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Get A4 dimensions
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm

      // Calculate image dimensions maintaining aspect ratio
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // Add image to PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95); // Use JPEG with good quality
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));

      // Generate filename
      const filename = `${invoice.invoice_number}_${invoice.tenant?.name || 'Invoice'}.pdf`;

      // Save PDF
      pdf.save(filename);

      console.log(`✅ PDF generated successfully: ${filename}`);
    } catch (error) {
      console.error('❌ Error generating Thai PDF:', error);
      throw new Error(`ไม่สามารถสร้าง PDF ได้: ${error.message}`);
    }
  }
}

// Export utility function
export const generateThaiInvoicePDF = (invoice: InvoiceData): Promise<void> => {
  const generator = new ThaiInvoicePDFGenerator();
  return generator.generateInvoicePDF(invoice);
};