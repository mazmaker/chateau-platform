import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface HandoffLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  customerName?: string;
  /** When provided, filter Sales list to only those with permission on this unit (via unit OR project assignment). */
  unitId?: string;
  projectId?: string;
  onSuccess?: () => void;
}

interface SalesUser {
  id: string;
  full_name: string | null;
  email: string;
  hasPermission?: boolean;
}

const HandoffLeadDialog = ({ open, onOpenChange, leadId, customerName, unitId, projectId, onSuccess }: HandoffLeadDialogProps) => {
  const { currentTenant, userProfile } = useSimpleAuth();
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [selectedSalesId, setSelectedSalesId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);

  useEffect(() => {
    if (open && currentTenant) {
      fetchSalesUsers();
      setSelectedSalesId('');
    }
  }, [open, currentTenant?.id]);

  const fetchSalesUsers = async () => {
    setFetchLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allSales, error } = await (supabase.from('users') as any)
        .select('id, full_name, email')
        .eq('tenant_id', currentTenant?.id)
        .eq('role', 'sales')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      const list: SalesUser[] = (allSales as SalesUser[]) || [];

      // If unit/project context given → mark which Sales have permission
      if ((unitId || projectId) && list.length > 0) {
        const ids = list.map((s) => s.id);
        const [unitAssigns, projAssigns] = await Promise.all([
          unitId
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (supabase.from('sales_unit_assignments') as any)
                .select('sales_user_id')
                .eq('unit_id', unitId)
                .is('revoked_at', null)
                .in('sales_user_id', ids)
            : Promise.resolve({ data: [] }),
          projectId
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (supabase.from('sales_project_assignments') as any)
                .select('sales_user_id')
                .eq('project_id', projectId)
                .is('revoked_at', null)
                .in('sales_user_id', ids)
            : Promise.resolve({ data: [] }),
        ]);
        const permitted = new Set<string>();
        ((unitAssigns.data as any[]) || []).forEach((r: any) => permitted.add(r.sales_user_id));
        ((projAssigns.data as any[]) || []).forEach((r: any) => permitted.add(r.sales_user_id));
        list.forEach((s) => { s.hasPermission = permitted.has(s.id); });
      }
      setSalesUsers(list);
    } catch (error) {
      console.error('Error fetching sales users:', error);
      toast.error('ไม่สามารถโหลดรายชื่อพนักงานขายได้');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleHandoff = async () => {
    if (!leadId || !selectedSalesId) return;
    setLoading(true);
    try {
      const salesUser = salesUsers.find((s) => s.id === selectedSalesId);
      const agentName = userProfile?.full_name || userProfile?.email || 'Agent';
      const handoffNote = `\n[${new Date().toLocaleString('th-TH')}] ส่งต่อจาก ${agentName} → ${salesUser?.full_name || salesUser?.email}`;

      // Fetch existing notes to append (not overwrite)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase.from('leads') as any)
        .select('notes').eq('id', leadId).single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('leads') as any)
        .update({
          assigned_to: selectedSalesId,
          notes: ((existing as { notes?: string } | null)?.notes || '') + handoffNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) throw error;
      toast.success(`ส่งต่อ Lead ให้ ${salesUser?.full_name || 'Sales'} สำเร็จ`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error handing off lead:', error);
      toast.error(error.message || 'ส่งต่อไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-chateau" />
            ส่งต่อ Lead ให้ Sales
          </DialogTitle>
          <DialogDescription>
            {customerName ? `ลูกค้า: ${customerName}` : 'เลือกพนักงานขายที่จะรับช่วงต่อ'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              หลังส่งต่อแล้ว คุณจะไม่เห็น Lead นี้ในรายการ "Leads ของฉัน" แต่ยังคงดูได้ในประวัติ
            </p>
          </div>

          <div>
            <Label className="mb-2 block">เลือกพนักงานขาย</Label>
            <Select value={selectedSalesId} onValueChange={setSelectedSalesId} disabled={fetchLoading || loading}>
              <SelectTrigger>
                <SelectValue placeholder={fetchLoading ? 'กำลังโหลด...' : 'เลือกพนักงานขาย...'} />
              </SelectTrigger>
              <SelectContent>
                {salesUsers.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-gray-500 text-center">ไม่มีพนักงานขายในบริษัทนี้</div>
                ) : (unitId || projectId) ? (() => {
                  const permitted = salesUsers.filter((s) => s.hasPermission);
                  const notPermitted = salesUsers.filter((s) => !s.hasPermission);
                  return (
                    <>
                      {permitted.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 sticky top-0">
                            ✅ มีสิทธิ์บนยูนิตนี้ ({permitted.length})
                          </div>
                          {permitted.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.full_name || s.email}
                              {s.full_name && <span className="text-gray-400 text-xs ml-2">{s.email}</span>}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {notPermitted.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 sticky top-0 mt-1">
                            ⚠️ ไม่มีสิทธิ์บนยูนิตนี้ — Admin ต้องมอบหมายก่อน ({notPermitted.length})
                          </div>
                          {notPermitted.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="text-gray-500">{s.full_name || s.email}</span>
                              {s.full_name && <span className="text-gray-400 text-xs ml-2">{s.email}</span>}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {permitted.length === 0 && (
                        <div className="px-2 py-2 text-xs text-amber-700 bg-amber-50 border-t">
                          💡 ยังไม่มี Sales ที่มีสิทธิ์บนยูนิตนี้ — แจ้ง Admin มอบหมายก่อน
                        </div>
                      )}
                    </>
                  );
                })() : (
                  salesUsers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.email}
                      {s.full_name && <span className="text-gray-400 text-xs ml-2">{s.email}</span>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {(unitId || projectId) && selectedSalesId && salesUsers.find((s) => s.id === selectedSalesId)?.hasPermission === false && (
              <p className="text-xs text-amber-700 mt-1.5">
                ⚠️ Sales คนนี้ยังไม่มีสิทธิ์บนยูนิตนี้ — ส่งต่อได้ แต่ต้องแจ้ง Admin มอบหมาย Sales บนยูนิตก่อนจึงจะบันทึกการจองได้
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button onClick={handleHandoff} disabled={!selectedSalesId || loading}>
            {loading ? 'กำลังส่งต่อ...' : 'ยืนยันส่งต่อ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HandoffLeadDialog;
