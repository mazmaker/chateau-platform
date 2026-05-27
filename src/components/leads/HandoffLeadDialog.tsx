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
  leadIds: string[];
  customerNames?: string[];
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

const HandoffLeadDialog = ({ open, onOpenChange, leadIds, customerNames, unitId, projectId, onSuccess }: HandoffLeadDialogProps) => {
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
    if (leadIds.length === 0 || !selectedSalesId) return;
    setLoading(true);
    try {
      const salesUser = salesUsers.find((s) => s.id === selectedSalesId);
      const agentName = userProfile?.full_name || userProfile?.email || 'Agent';
      const timestamp = new Date().toLocaleString('th-TH');
      const handoffNote = `\n[${timestamp}] ส่งต่อจาก ${agentName} → ${salesUser?.full_name || salesUser?.email}`;

      await Promise.all(leadIds.map(async (leadId, idx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from('leads') as any)
          .select('notes, status').eq('id', leadId).single();

        const currentStatus = (existing as { notes?: string; status?: string } | null)?.status || 'new';
        // Advance 'new' leads to 'contacted' — Agent has already engaged with the customer
        const newStatus = currentStatus === 'new' ? 'contacted' : currentStatus;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('leads') as any)
          .update({
            assigned_to: selectedSalesId,
            status: newStatus,
            notes: ((existing as { notes?: string } | null)?.notes || '') + handoffNote,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('activity_logs') as any).insert({
            tenant_id: currentTenant?.id,
            user_id: userProfile?.id,
            activity_type: 'handoff_to_sales',
            description: `${agentName} ส่งต่อ Lead ${customerNames?.[idx] || ''} → ${salesUser?.full_name || salesUser?.email}`,
            metadata: {
              lead_id: leadId,
              from_user_id: userProfile?.id,
              to_user_id: selectedSalesId,
              customer_name: customerNames?.[idx],
            },
          });
        } catch { /* non-blocking */ }

        // Targeted: notify the receiving Sales that a Lead was handed to them.
        try {
          if (selectedSalesId && currentTenant?.id) {
            const { createNotification } = await import('@/lib/notifications');
            await createNotification({
              tenantId: currentTenant.id,
              userId: selectedSalesId,
              activityType: 'lead_assigned',
              title: 'มอบหมาย Lead ใหม่',
              message: `${agentName} ส่งต่อ ${customerNames?.[idx] || 'Lead'} ให้คุณ`,
              severity: 'info',
              relatedEntityType: 'lead',
              relatedEntityId: leadId,
              data: { from_user_id: userProfile?.id, source: 'handoff' },
            });
          }
        } catch { /* non-blocking */ }
      }));

      const label = leadIds.length > 1 ? `${leadIds.length} Lead` : (customerNames?.[0] || 'Lead');
      toast.success(`ส่งต่อ ${label} ให้ ${salesUser?.full_name || 'Sales'} สำเร็จ`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error handing off lead:', error);
      toast.error(error.message || 'ส่งต่อไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const needsPermissionContext = !!(unitId || projectId);
  const hasAnyPermitted = salesUsers.some((s) => s.hasPermission);

  const descriptionText = () => {
    if (!customerNames || customerNames.length === 0) return 'เลือกพนักงานขายที่จะรับช่วงต่อ';
    if (customerNames.length === 1) return `ลูกค้า: ${customerNames[0]}`;
    const preview = customerNames.slice(0, 2).join(', ');
    const extra = customerNames.length > 2 ? ` และอีก ${customerNames.length - 2} คน` : '';
    return `${customerNames.length} Lead: ${preview}${extra}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-chateau" />
            ส่งต่อ Lead ให้ Sales
          </DialogTitle>
          <DialogDescription>{descriptionText()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              หลังส่งต่อแล้ว Lead {leadIds.length > 1 ? 'เหล่านี้' : 'นี้'} จะย้ายออกจากรายการของคุณ — ยังดูได้ในประวัติ Referral
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
                ) : needsPermissionContext ? (() => {
                  const permitted = salesUsers.filter((s) => s.hasPermission);
                  const notPermitted = salesUsers.filter((s) => !s.hasPermission);
                  return (
                    <>
                      {permitted.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 sticky top-0">
                            มีสิทธิ์บนยูนิตนี้ ({permitted.length})
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
                            ยังไม่มีสิทธิ์บนยูนิตนี้ ({notPermitted.length})
                          </div>
                          {notPermitted.map((s) => (
                            // Disable no-permission Sales when permitted Sales exist — force correct assignment
                            <SelectItem key={s.id} value={s.id} disabled={hasAnyPermitted}>
                              <span className={hasAnyPermitted ? 'text-gray-400' : 'text-gray-700'}>
                                {s.full_name || s.email}
                              </span>
                              {s.full_name && <span className="text-gray-400 text-xs ml-2">{s.email}</span>}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {permitted.length === 0 && (
                        <div className="px-2 py-2 text-xs text-amber-700 bg-amber-50 border-t">
                          ยังไม่มี Sales ที่มีสิทธิ์บนยูนิตนี้ — แจ้ง Admin มอบหมายก่อน
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
            {needsPermissionContext && selectedSalesId && salesUsers.find((s) => s.id === selectedSalesId)?.hasPermission === false && (
              <p className="text-xs text-amber-700 mt-1.5">
                Sales คนนี้ยังไม่มีสิทธิ์บนยูนิตนี้ — ส่งต่อได้ แต่ต้องแจ้ง Admin มอบหมายก่อนจะบันทึกการจองได้
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button onClick={handleHandoff} disabled={!selectedSalesId || loading}>
            {loading
              ? 'กำลังส่งต่อ...'
              : leadIds.length > 1
                ? `ยืนยันส่งต่อ ${leadIds.length} Lead`
                : 'ยืนยันส่งต่อ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HandoffLeadDialog;
