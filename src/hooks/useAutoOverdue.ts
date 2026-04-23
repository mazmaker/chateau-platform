// Auto Overdue Detection Hook
// ใช้สำหรับเช็คและอัพเดท overdue status ใน frontend

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface UseAutoOverdueOptions {
  onUpdate?: () => void; // Callback เมื่อมีการอัพเดท
}

export const useAutoOverdue = (options?: UseAutoOverdueOptions) => {
  const checkAndUpdateOverdue = async () => {
    try {
      // 1. ดึงใบแจ้งหนี้ที่ pending และเกินกำหนด
      const { data: overdueInvoices, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, due_date, tenant_id')
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString().split('T')[0])
        .gte('due_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // ไม่เกิน 30 วัน

      if (error) {
        console.error('Error checking overdue invoices:', error);
        return;
      }

      if (!overdueInvoices || overdueInvoices.length === 0) {
        return; // ไม่มีบิลเกินกำหนด
      }

      // 2. อัพเดทสถานะเป็น overdue พร้อม logging
      for (const invoice of overdueInvoices) {
        try {
          // อัพเดทสถานะใน database
          const { error: updateError } = await supabase
            .from('invoices')
            .update({
              status: 'overdue',
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);

          if (updateError) {
            console.error(`Error updating invoice ${invoice.invoice_number}:`, updateError);
            continue;
          }

          // บันทึก log สำหรับการเปลี่ยนแปลงอัตโนมัติ
          const { error: logError } = await supabase
            .from('invoice_status_logs')
            .insert({
              invoice_id: invoice.id,
              tenant_id: invoice.tenant_id,
              old_status: 'pending',
              new_status: 'overdue',
              changed_by: 'SYSTEM',
              change_type: 'auto_overdue',
              reason: 'ระบบตรวจพบใบแจ้งหนี้เกินกำหนดชำระ',
              notes: `อัตโนมัติเปลี่ยนสถานะเป็นเกินกำหนด (เกินมา ${Math.ceil((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))} วัน)`,
              metadata: {
                due_date: invoice.due_date,
                auto_check_time: new Date().toISOString(),
                days_overdue: Math.ceil((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
              }
            });

          if (logError) {
            console.error(`Error logging status change for ${invoice.invoice_number}:`, logError);
          }

          console.log(`✅ Auto-updated ${invoice.invoice_number} to overdue`);
        } catch (error) {
          console.error(`Error processing invoice ${invoice.invoice_number}:`, error);
        }
      }

      // 3. แจ้งเตือนผู้ใช้และเรียก callback
      if (overdueInvoices.length > 0) {
        toast.warning(`อัพเดทสถานะ ${overdueInvoices.length} ใบแจ้งหนี้เป็นเกินกำหนดแล้ว`, {
          description: 'ระบบตรวจพบใบแจ้งหนี้ที่เกินกำหนดชำระและอัพเดทสถานะอัตโนมัติ',
          duration: 5000,
        });

        // เรียก callback เพื่อ refresh ข้อมูล
        if (options?.onUpdate) {
          options.onUpdate();
        }
      }

    } catch (error) {
      console.error('Error in auto overdue check:', error);
    }
  };

  // เรียกใช้เมื่อโหลดหน้า
  useEffect(() => {
    checkAndUpdateOverdue();
  }, []);

  // เรียกใช้ทุก 30 นาที (เฉพาะเมื่อ tab active)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        checkAndUpdateOverdue();
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, []);

  return { checkAndUpdateOverdue };
};

// การใช้งานใน InvoiceManagement.tsx:
// import { useAutoOverdue } from '@/hooks/useAutoOverdue';
//
// const InvoiceManagement = () => {
//   useAutoOverdue(); // เพิ่มบรรทัดนี้
//   // ... rest of component
// };