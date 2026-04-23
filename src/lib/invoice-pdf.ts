// Invoice PDF Generation Service
// ระบบสร้าง PDF ใบแจ้งหนี้

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

export class InvoicePDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;

  constructor() {
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.pageHeight = this.pdf.internal.pageSize.height;

    // Configure fonts for better Thai text support
    this.setupFonts();
  }

  private setupFonts() {
    try {
      // Use Helvetica which supports basic Thai characters better
      this.pdf.setFont('helvetica');
    } catch (error) {
      console.log('Using default font configuration');
    }
  }

  // Helper function to handle Thai text properly
  private addThaiText(text: string, x: number, y: number, options?: any) {
    try {
      // Direct text rendering - modern browsers handle Thai better
      this.pdf.text(text, x, y, options);
    } catch (error) {
      console.log('Text rendering error:', error);
      // Fallback to basic text
      this.pdf.text(text, x, y, options);
    }
  }

  private formatCurrency(amount: number): string {
    return `${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  }

  private formatDate(date: string): string {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private getPlanName(plan: string): string {
    // TODO: Connect with packageConfig from TenantManagement
    const plans: Record<string, string> = {
      starter: 'Starter Plan - ฿2,900/เดือน',
      professional: 'Professional Plan - ฿5,900/เดือน',
      enterprise: 'Enterprise Plan - ฿15,900/เดือน'
    };
    return plans[plan] || plan;
  }

  private getPlanNameEng(plan: string): string {
    const plans: Record<string, string> = {
      starter: 'Starter Plan - THB 2,900/month',
      professional: 'Professional Plan - THB 5,900/month',
      enterprise: 'Enterprise Plan - THB 15,900/month'
    };
    return plans[plan] || plan;
  }

  private getStatusText(status: string): string {
    const statuses: Record<string, string> = {
      paid: 'ชำระแล้ว',
      pending: 'รอชำระ',
      overdue: 'เกินกำหนด',
      cancelled: 'ยกเลิก'
    };
    return statuses[status] || status;
  }

  private getStatusTextEng(status: string): string {
    const statuses: Record<string, string> = {
      paid: 'PAID',
      pending: 'PENDING',
      overdue: 'OVERDUE',
      cancelled: 'CANCELLED'
    };
    return statuses[status] || status.toUpperCase();
  }

  private addHeader() {
    // Company Logo Area (placeholder)
    this.pdf.setFillColor(59, 130, 246); // Blue color
    this.pdf.rect(this.margin, this.margin, 40, 20, 'F');

    // Company name in white on blue background
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('CHATEAU', this.margin + 3, this.margin + 8);
    this.pdf.setFontSize(10);
    this.pdf.text('PLATFORM', this.margin + 3, this.margin + 15);

    // Company info
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    const companyInfo = [
      'CHATEAU Platform Co., Ltd.',
      '123 Technology Park, Bangkok 10110',
      'Tel: 02-XXX-XXXX',
      'Email: billing@chateau-platform.com',
      'Tax ID: 0123456789012'
    ];

    let y = this.margin + 5;
    companyInfo.forEach(line => {
      this.pdf.text(line, this.pageWidth - this.margin - 60, y);
      y += 4;
    });

    return this.margin + 35;
  }

  private addInvoiceTitle(startY: number, invoice: InvoiceData) {
    const y = startY + 10;

    // Invoice title
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.addThaiText('ใบแจ้งหนี้ / INVOICE', this.margin, y);

    // Document status note
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.addThaiText('(เอกสารฉบับนี้ไม่ใช่ใบเสร็จรับเงิน)', this.margin, y + 8);

    // Invoice number and date
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    this.addThaiText(`เลขที่บิล: ${invoice.invoice_number}`, this.margin, y + 20);
    this.addThaiText(`วันออกบิล: ${this.formatDate(invoice.created_at)}`, this.margin, y + 26);
    this.addThaiText(`กำหนดชำระ: ${this.formatDate(invoice.due_date)}`, this.margin, y + 32);

    // Status badge
    const statusThai = this.getStatusText(invoice.status);
    const statusColors = {
      'ชำระแล้ว': [34, 197, 94], // green
      'รอชำระ': [251, 191, 36], // amber
      'เกินกำหนด': [239, 68, 68], // red
      'ยกเลิก': [107, 114, 128] // gray
    };

    const color = statusColors[statusThai as keyof typeof statusColors] || [239, 68, 68];
    this.pdf.setFillColor(color[0], color[1], color[2]);
    this.pdf.rect(this.pageWidth - this.margin - 40, y + 5, 35, 8, 'F');

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.addThaiText(statusThai, this.pageWidth - this.margin - 38, y + 11);
    this.pdf.setTextColor(0, 0, 0);

    return y + 35;
  }

  private addCustomerInfo(startY: number, invoice: InvoiceData) {
    const y = startY + 10;

    // Customer section header
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.addThaiText('ออกบิลให้', this.margin, y);

    // Customer details (without box for cleaner look like example)
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'normal');
    const customerY = y + 8;

    this.addThaiText(invoice.tenant?.name || 'ไม่ระบุ', this.margin, customerY);
    this.addThaiText(`บัญชีผู้ใช้: ${invoice.tenant?.slug || 'ไม่ระบุ'}`, this.margin, customerY + 6);
    this.addThaiText(`แผนการใช้งาน: ${this.getPlanName(invoice.subscription_plan)}`, this.margin, customerY + 12);

    return y + 35;
  }

  private addItemsTable(startY: number, invoice: InvoiceData) {
    const y = startY + 10;
    const tableWidth = this.pageWidth - 2 * this.margin;
    const rowHeight = 10;

    // Table structure
    this.pdf.setFillColor(245, 245, 245);
    this.pdf.rect(this.margin, y, tableWidth, rowHeight, 'F');
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.rect(this.margin, y, tableWidth, rowHeight);

    // Headers
    this.pdf.setFontSize(11);
    this.pdf.setFont('helvetica', 'bold');
    this.addThaiText('รายละเอียด', this.margin + 2, y + 7);
    this.addThaiText('ยอดเงิน', this.pageWidth - this.margin - 25, y + 7);

    // Item row
    const itemY = y + rowHeight;
    this.pdf.rect(this.margin, itemY, tableWidth, rowHeight + 5);

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(10);
    const planDescription = `${this.getPlanName(invoice.subscription_plan)} - รายเดือน`;
    this.addThaiText(planDescription, this.margin + 2, itemY + 7);
    this.addThaiText(`${this.formatCurrency(invoice.amount)}`, this.pageWidth - this.margin - 35, itemY + 7);

    // Totals section
    const totalsY = itemY + rowHeight + 15;
    const totalsX = this.pageWidth - this.margin - 70;

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(11);

    // Subtotal
    this.addThaiText('ยอดค้างชำระ', totalsX, totalsY);
    this.addThaiText(this.formatCurrency(invoice.amount / 1.07), totalsX + 40, totalsY);

    // VAT
    this.addThaiText('7.00% ภาษีมูลค่าเพิ่ม/VAT', totalsX, totalsY + 6);
    this.addThaiText(this.formatCurrency(invoice.amount * 0.07 / 1.07), totalsX + 40, totalsY + 6);

    // Credit deduction
    this.addThaiText('หักเครดิต', totalsX, totalsY + 12);
    this.addThaiText('0.00 บาท', totalsX + 40, totalsY + 12);

    // Total
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(12);
    this.addThaiText('ทั้งหมด', totalsX, totalsY + 20);
    this.addThaiText(this.formatCurrency(invoice.amount), totalsX + 40, totalsY + 20);

    return totalsY + 30;
  }

  private addPaymentInfo(startY: number) {
    const y = startY + 15;

    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.addThaiText('วิธีการชำระเงิน', this.margin, y);

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');

    const paymentInfo = [
      'วิธีการชำระเงิน:',
      '1. โอนเงินผ่านธนาคาร:',
      '   ธนาคารกสิกรไทย สาขาสีลม',
      '   เลขที่บัญชี: 123-4-56789-0',
      '   ชื่อบัญชี: บริษัท ชาโต แพลตฟอร์ม จำกัด',
      '',
      '2. PromptPay QR Code:',
      '   สแกน QR Code หรือโอนไปที่เลขประจำตัวผู้เสียภาษี',
      '   เลขประจำตัวผู้เสียภาษี: 0123456789012',
      '',
      '3. เช็คธนาคาร:',
      '   สั่งจ่าย: บริษัท ชาโต แพลตฟอร์ม จำกัด',
      '',
      'หมายเหตุ:',
      '• กรุณาแจ้งการชำระเงินกลับมาที่ billing@chateau-platform.com',
      '• แนบหลักฐานการโอนเงิน เพื่อความรวดเร็วในการตรวจสอบ',
      '• ติดต่อสอบถาม: 02-XXX-XXXX กด 2 (ฝ่ายการเงิน)',
    ];

    let currentY = y + 8;
    paymentInfo.forEach(line => {
      if (line.startsWith('•') || line.match(/^\d+\./)) {
        this.pdf.setFont('helvetica', 'normal');
      } else if (line.includes(':')) {
        this.pdf.setFont('helvetica', 'bold');
      } else {
        this.pdf.setFont('helvetica', 'normal');
      }

      this.addThaiText(line, this.margin + (line.startsWith('   ') ? 10 : line.startsWith('•') ? 5 : 0), currentY);
      currentY += 4;
    });

    return currentY;
  }

  private addFooter() {
    const footerY = this.pageHeight - 20;

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'italic');
    this.pdf.setTextColor(128, 128, 128);

    const today = new Date().toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const footerText = `PDF Generated on ${today}`;
    this.addThaiText(footerText, this.pageWidth / 2, footerY, { align: 'center' });
  }

  public generateInvoicePDF(invoice: InvoiceData): void {
    try {
      // Generate PDF content
      let currentY = this.addHeader();
      currentY = this.addInvoiceTitle(currentY, invoice);
      currentY = this.addCustomerInfo(currentY, invoice);
      currentY = this.addItemsTable(currentY, invoice);
      currentY = this.addPaymentInfo(currentY);

      this.addFooter();

      // Save the PDF
      const filename = `${invoice.invoice_number}_${invoice.tenant?.name || 'Invoice'}.pdf`;
      this.pdf.save(filename);

      console.log(`✅ PDF generated: ${filename}`);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      throw new Error('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่');
    }
  }
}

// Export utility function
export const generateInvoicePDF = (invoice: InvoiceData): void => {
  const generator = new InvoicePDFGenerator();
  generator.generateInvoicePDF(invoice);
};