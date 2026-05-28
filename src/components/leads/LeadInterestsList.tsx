import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Plus, Edit2, Trash2, Building2, Calendar, ChevronDown, ChevronUp, ChevronRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import {
  LeadInterestWithDetails,
  InterestStatus,
  InterestLevel,
  INTEREST_STATUS_OPTIONS,
  INTEREST_LEVEL_OPTIONS,
} from "@/types/lead-interest";

interface Property {
  id: string;
  name: string;
  type: string;
}

interface Unit {
  id: string;
  unit_number: string;
  project_id: string;
  price?: number;
  status?: string;
}

interface LeadInterestsListProps {
  leadId: string;
  onInterestsChange?: () => void;
}

export interface LeadInterestsListRef {
  fetchInterests: () => Promise<void>;
  getExistingUnitIds: () => string[];
}

const LeadInterestsList = forwardRef<LeadInterestsListRef, LeadInterestsListProps>(({ leadId, onInterestsChange }, ref) => {
  const { currentTenant } = useSimpleAuth();

  const [interests, setInterests] = useState<LeadInterestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Inline Add Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormLoading, setAddFormLoading] = useState(false);
  const [addFormError, setAddFormError] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [addFormData, setAddFormData] = useState({
    property_id: "",
    unit_id: "",
    status: "interested" as InterestStatus,
    interest_level: "medium" as InterestLevel,
    notes: "",
    viewing_date: "",
  });

  // Inline Edit state (instead of modal)
  const [editingInterestId, setEditingInterestId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    status: "interested" as InterestStatus,
    interest_level: "medium" as InterestLevel,
    notes: "",
    viewing_date: "",
  });

  useEffect(() => {
    if (leadId) {
      fetchInterests();
    }
  }, [leadId]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    fetchInterests,
    getExistingUnitIds: () => interests.map((i) => i.unit_id),
  }), [interests]);

  const fetchInterests = async () => {
    setLoading(true);
    try {
      // Exclude soft-deleted interests (status='dropped'/'lost') so the UI matches
      // what UnitDetail and the delete-from-unit feature operate on. Otherwise
      // Lead Detail would show interests that the user already removed.
      let { data, error } = await supabase
        .from("lead_interests")
        .select(`
          *,
          property:properties(id, name, type),
          unit:units(id, unit_number, price, status)
        `)
        .eq("lead_id", leadId)
        .not("status", "in", '("dropped","lost")')
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Full query failed, trying simple query:", error.message);
        const result = await supabase
          .from("lead_interests")
          .select("*")
          .eq("lead_id", leadId)
          .not("status", "in", '("dropped","lost")')
          .order("created_at", { ascending: false });

        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setInterests(data || []);
    } catch (error) {
      console.error("Error fetching interests:", error);
      setInterests([]);
    } finally {
      setLoading(false);
    }
  };

  // Add Form functions
  const fetchProperties = async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, type")
      .eq("tenant_id", currentTenant?.id)
      .order("name");
    setProperties(data || []);
  };

  const fetchUnits = async (propertyId: string) => {
    const { data } = await supabase
      .from("units")
      .select("id, unit_number, project_id, price, status")
      .eq("project_id", propertyId)
      .order("unit_number");

    const existingUnitIds = interests.map((i) => i.unit_id);
    const availableUnits = (data || []).filter(
      (unit) => !existingUnitIds.includes(unit.id)
    );
    setUnits(availableUnits);
  };

  const handleOpenAddForm = () => {
    setAddFormData({
      property_id: "",
      unit_id: "",
      status: "interested",
      interest_level: "medium",
      notes: "",
      viewing_date: "",
    });
    setAddFormError("");
    setUnits([]);
    fetchProperties();
    setShowAddForm(true);
  };

  const handleCloseAddForm = () => {
    setShowAddForm(false);
    setAddFormError("");
  };

  const handlePropertyChange = (propertyId: string) => {
    setAddFormData(prev => ({ ...prev, property_id: propertyId, unit_id: "" }));
    if (propertyId) {
      fetchUnits(propertyId);
    } else {
      setUnits([]);
    }
  };

  const handleAddSubmit = async () => {
    if (!addFormData.property_id || !addFormData.unit_id) {
      setAddFormError("กรุณาเลือกโครงการและยูนิต");
      return;
    }

    setAddFormLoading(true);
    setAddFormError("");

    try {
      const { error: insertError } = await supabase
        .from("lead_interests")
        .insert({
          tenant_id: currentTenant?.id,
          lead_id: leadId,
          property_id: addFormData.property_id,
          unit_id: addFormData.unit_id,
          status: addFormData.status,
          interest_level: addFormData.interest_level,
          notes: addFormData.notes || null,
          viewing_date: addFormData.viewing_date || null,
        });

      if (insertError) throw insertError;

      // Log activity for interest creation
      try {
        const property = properties.find(p => p.id === addFormData.property_id);
        const unit = units.find(u => u.id === addFormData.unit_id);
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: null,
          p_activity_type: 'lead_interest_created',
          p_description: `เพิ่มความสนใจยูนิต: ${unit?.unit_number || addFormData.unit_id} (${property?.name || addFormData.property_id})`,
          p_metadata: {
            lead_id: leadId,
            property_id: addFormData.property_id,
            property_name: property?.name,
            unit_id: addFormData.unit_id,
            unit_number: unit?.unit_number,
            status: addFormData.status,
            interest_level: addFormData.interest_level
          }
        });
      } catch {
        // Ignore log_activity errors
      }

      await fetchInterests();
      setShowAddForm(false);
      onInterestsChange?.();
    } catch (err: any) {
      console.error("Error adding interest:", err);
      if (err.code === "23505") {
        setAddFormError("ยูนิตนี้ถูกเพิ่มไปแล้ว");
      } else {
        setAddFormError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } finally {
      setAddFormLoading(false);
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return "";
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Edit functions - now inline instead of modal
  const startEditing = (interest: LeadInterestWithDetails) => {
    setEditingInterestId(interest.id);
    setEditForm({
      status: interest.status,
      interest_level: interest.interest_level,
      notes: interest.notes || "",
      viewing_date: interest.viewing_date
        ? new Date(interest.viewing_date).toISOString().slice(0, 16)
        : "",
    });
  };

  const cancelEditing = () => {
    setEditingInterestId(null);
  };

  const handleEditSubmit = async (interestId: string) => {
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from("lead_interests")
        .update({
          status: editForm.status,
          interest_level: editForm.interest_level,
          notes: editForm.notes || null,
          viewing_date: editForm.viewing_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", interestId);

      if (error) throw error;

      // Log activity for interest update
      try {
        const interest = interests.find(i => i.id === interestId);
        if (interest) {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant?.id,
            p_user_id: null,
            p_activity_type: 'lead_interest_updated',
            p_description: `แก้ไขความสนใจยูนิต: ${interest.unit?.unit_number || interest.unit_id} (${interest.property?.name || interest.property_id})`,
            p_metadata: {
              lead_id: leadId,
              interest_id: interestId,
              property_id: interest.property_id,
              property_name: interest.property?.name,
              unit_id: interest.unit_id,
              unit_number: interest.unit?.unit_number,
              status: editForm.status,
              interest_level: editForm.interest_level
            }
          });
        }
      } catch {
        // Ignore log_activity errors
      }

      await fetchInterests();
      setEditingInterestId(null);
      onInterestsChange?.();
    } catch (error) {
      console.error("Error updating interest:", error);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (interestId: string) => {
    if (!deleteReason.trim()) {
      // UI requires a reason — same as UnitDetail's trash flow, so deletes from
      // either entry point produce consistent audit records.
      return;
    }
    setDeleteLoading(true);
    const interest = interests.find(i => i.id === interestId);
    try {
      // Soft delete via status='dropped' (NOT hard DELETE). Keeps the row in DB
      // so audit + lead scoring history are preserved, and so that if the
      // customer re-expresses interest on the same unit the existing row gets
      // flipped back to 'interested' (same id, traceable journey) instead of a
      // fresh row being inserted every time. Mirrors the trash flow in
      // UnitDetail.tsx — both entry points behave identically now.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update({
          status: 'dropped',
          notes: `[ลบจาก Lead Detail ${interest?.unit?.unit_number || ''}] ${deleteReason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", interestId);

      if (error) throw error;

      // Cancel any pending/confirmed bookings tied to this lead+unit so the
      // customer's status timeline doesn't keep showing "ชำระมัดจำ ✓" for an
      // interest that no longer exists. Mirrors UnitDetail.submitDeleteInterest.
      if (interest?.unit_id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('bookings') as any)
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('tenant_id', currentTenant?.id)
            .filter('notes->>unit_id', 'eq', interest.unit_id)
            .filter('notes->>lead_id', 'eq', leadId)
            .in('status', ['pending', 'confirmed']);
        } catch { /* non-blocking */ }
      }

      // Audit log — using the SAME activity_type as the trash button on Unit
      // Detail (lead_interest_removed) so notification + report filters can
      // treat both as one event class.
      try {
        if (interest) {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant?.id,
            p_user_id: null,
            p_activity_type: 'lead_interest_removed',
            p_description: `ลบความสนใจยูนิต ${interest.unit?.unit_number || interest.unit_id} (${interest.property?.name || ''}) — ${deleteReason.trim()}`,
            p_metadata: {
              lead_id: leadId,
              interest_id: interestId,
              property_id: interest.property_id,
              property_name: interest.property?.name,
              unit_id: interest.unit_id,
              unit_number: interest.unit?.unit_number,
              previous_status: interest.status,
              reason: deleteReason.trim(),
              source: 'lead_detail',
            }
          });
        }
      } catch {
        // Ignore log_activity errors
      }

      // Recompute lead score because removing an interest changes the lead's
      // estimated_value (max unit price across active interests).
      try {
        const { recomputeLeadScore } = await import('@/lib/recomputeLeadScore');
        await recomputeLeadScore(leadId);
      } catch { /* non-fatal */ }

      await fetchInterests();
      setShowDeleteConfirm(null);
      setDeleteReason("");
      onInterestsChange?.();
    } catch (error) {
      console.error("Error deleting interest:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status: InterestStatus) => {
    const option = INTEREST_STATUS_OPTIONS.find((o) => o.value === status);
    if (!option) return null;
    return (
      <Badge className={`${option.color} font-normal`}>
        {option.icon} {option.label}
      </Badge>
    );
  };

  const getInterestLevelIcon = (level: InterestLevel) => {
    const option = INTEREST_LEVEL_OPTIONS.find((o) => o.value === level);
    return option ? <span className={option.color}>{option.icon}</span> : null;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Split interests by intent so Sales / Admin sees one bucket per workflow stage,
  // matching the customer-side mental model:
  //   • ขอติดต่อ     — interest_level='high' OR sales has progressed it (viewing+).
  //                    These need follow-up; live at the top.
  //   • บันทึกไว้    — passive bookmarks (interest_level='low'/'medium'). Low-priority,
  //                    collapsed by default in the modal so the form stays compact.
  //   • ยกเลิก       — soft-deleted history (status='dropped'/'lost'). Audit trail.
  const ACTIVE_STATUSES_INTEREST = new Set(['viewing_scheduled', 'viewed', 'negotiating', 'reserved', 'deposit_paid', 'won']);
  const priorityInterests = interests.filter(
    (i) => i.status !== 'dropped' && i.status !== 'lost'
      && (i.interest_level === 'high' || ACTIVE_STATUSES_INTEREST.has(i.status as string))
  );
  const bookmarkInterests = interests.filter(
    (i) => i.status !== 'dropped' && i.status !== 'lost'
      && i.interest_level !== 'high' && !ACTIVE_STATUSES_INTEREST.has(i.status as string)
  );
  const droppedInterests = interests.filter(
    (i) => i.status === 'dropped' || i.status === 'lost'
  );

  // Helper: group a subset of interests by property (kept so each section can render
  // unit rows under a "Project Name" header — same hierarchy as before).
  const groupByProperty = (rows: LeadInterestWithDetails[]) =>
    rows.reduce((acc, interest) => {
      const propertyId = interest.property_id;
      if (!acc[propertyId]) {
        acc[propertyId] = { property: interest.property, interests: [] };
      }
      acc[propertyId].interests.push(interest);
      return acc;
    }, {} as Record<string, { property: any; interests: LeadInterestWithDetails[] }>);

  // System-generated notes pollute the display — these were intended as audit metadata,
  // not user-facing copy. Suppress them from the row UI; Sales can still see the raw
  // value when they edit a row.
  const SYSTEM_NOTE_PATTERNS = [
    /^บันทึกไว้ดูทีหลัง \(heart\)/i,
    /^ลูกค้ากดสนใจ.*จาก Customer Portal/i,
    /^ลูกค้ากดสนใจอีกครั้ง/i,
    /^บันทึกจาก Customer Portal/i,
    /^\[ลบจาก Lead Detail/i,
  ];
  const isSystemNote = (notes?: string | null) =>
    !!notes && SYSTEM_NOTE_PATTERNS.some((re) => re.test(notes.trim()));

  // Single source of truth for rendering each unit row (edit form / delete confirm /
  // normal view). Extracted so the 3 sections — ขอติดต่อ / บันทึกไว้ / ยกเลิก —
  // can all reuse the same row UI without duplicating ~200 lines of JSX.
  const renderUnitRows = (rows: LeadInterestWithDetails[]) => rows.map((interest) => (
    <div key={interest.id}>
      {editingInterestId === interest.id ? (
        <div className="p-4 bg-chateau-50 border-l-4 border-chateau-300 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-chateau-700 flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              แก้ไข: ยูนิต {interest.unit?.unit_number}
            </h4>
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">สถานะ</Label>
              <Select
                value={editForm.status}
                onValueChange={(value: InterestStatus) => setEditForm((prev) => ({ ...prev, status: value }))}
                disabled={editLoading}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTEREST_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.icon} {option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ระดับความสนใจ</Label>
              <Select
                value={editForm.interest_level}
                onValueChange={(value: InterestLevel) => setEditForm((prev) => ({ ...prev, interest_level: value }))}
                disabled={editLoading}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTEREST_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.icon} {option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(editForm.status === "viewing_scheduled" || editForm.status === "viewed") && (
            <div className="space-y-1">
              <Label className="text-xs">วันที่นัดดู / ดูแล้ว</Label>
              <Input
                type="datetime-local"
                value={editForm.viewing_date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, viewing_date: e.target.value }))}
                disabled={editLoading}
                className="h-9"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">บันทึก</Label>
            <Textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="บันทึกเพิ่มเติม..."
              disabled={editLoading}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelEditing} disabled={editLoading}>ยกเลิก</Button>
            <Button size="sm" onClick={() => handleEditSubmit(interest.id)} disabled={editLoading}>
              {editLoading ? "กำลังบันทึก..." : (<><Check className="w-4 h-4 mr-1" />บันทึก</>)}
            </Button>
          </div>
        </div>
      ) : showDeleteConfirm === interest.id ? (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 space-y-3">
          <div>
            <p className="font-medium text-red-800">ลบความสนใจยูนิต "{interest.unit?.unit_number}"?</p>
            <p className="text-xs text-red-700 mt-0.5">Lead ยังอยู่ในระบบ — แค่ตัดความเชื่อมโยงกับยูนิตนี้ออก + เก็บประวัติไว้</p>
          </div>
          <textarea
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="ระบุเหตุผล (เช่น เลือกยูนิตผิด, ลูกค้าเปลี่ยนใจ, ติดต่อไม่ได้นาน...)"
            rows={2}
            disabled={deleteLoading}
            className="w-full text-sm border border-red-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowDeleteConfirm(null); setDeleteReason(""); }} disabled={deleteLoading}>ยกเลิก</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(interest.id)} disabled={deleteLoading || !deleteReason.trim()}>
              {deleteLoading ? "กำลังลบ..." : "ยืนยันลบ"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-medium">{interest.unit?.unit_number || "-"}</span>
              {getStatusBadge(interest.status)}
              {getInterestLevelIcon(interest.interest_level)}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {interest.unit?.price && (
                <span className="text-blue-600 font-medium">{formatPrice(interest.unit.price)}</span>
              )}
              {interest.viewing_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(interest.viewing_date)}
                </span>
              )}
            </div>
            {interest.notes && !isSystemNote(interest.notes) && (
              <p className="text-sm text-gray-600 mt-1 bg-gray-50 px-2 py-1 rounded">{interest.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => startEditing(interest)}><Edit2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setShowDeleteConfirm(interest.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  ));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-lg font-medium hover:text-primary transition-colors"
        >
          <Building2 className="w-5 h-5 text-blue-600" />
          ยูนิตที่สนใจ ({interests.length})
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {!showAddForm && (
          <Button size="sm" onClick={handleOpenAddForm}>
            <Plus className="w-4 h-4 mr-1" />
            เพิ่มยูนิต
          </Button>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="space-y-4">
          {/* Inline Add Form */}
          {showAddForm && (
            <div className="border-2 border-gray-200 rounded-lg p-4 bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  เพิ่มยูนิตที่สนใจ
                </h4>
                <Button variant="ghost" size="sm" onClick={handleCloseAddForm}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Property Selection */}
                <div className="space-y-2">
                  <Label>โครงการ *</Label>
                  <Select
                    value={addFormData.property_id}
                    onValueChange={handlePropertyChange}
                    disabled={addFormLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกโครงการ" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Unit Selection */}
                <div className="space-y-2">
                  <Label>ยูนิต *</Label>
                  <Select
                    value={addFormData.unit_id}
                    onValueChange={(value) =>
                      setAddFormData((prev) => ({ ...prev, unit_id: value }))
                    }
                    disabled={addFormLoading || !addFormData.property_id}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          addFormData.property_id ? "เลือกยูนิต" : "เลือกโครงการก่อน"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {units.length === 0 && addFormData.property_id ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          ไม่มียูนิตที่พร้อมเพิ่ม
                        </div>
                      ) : (
                        units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{unit.unit_number}</span>
                              {unit.price && (
                                <span className="text-muted-foreground ml-2">
                                  {formatPrice(unit.price)}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>สถานะ</Label>
                  <Select
                    value={addFormData.status}
                    onValueChange={(value: InterestStatus) =>
                      setAddFormData((prev) => ({ ...prev, status: value }))
                    }
                    disabled={addFormLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span>
                            {option.icon} {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Interest Level */}
                <div className="space-y-2">
                  <Label>ระดับความสนใจ</Label>
                  <Select
                    value={addFormData.interest_level}
                    onValueChange={(value: InterestLevel) =>
                      setAddFormData((prev) => ({ ...prev, interest_level: value }))
                    }
                    disabled={addFormLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_LEVEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span>
                            {option.icon} {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Viewing Date */}
              {(addFormData.status === "viewing_scheduled" ||
                addFormData.status === "viewed") && (
                <div className="space-y-2">
                  <Label>วันที่นัดดู / ดูแล้ว</Label>
                  <Input
                    type="datetime-local"
                    value={addFormData.viewing_date}
                    onChange={(e) =>
                      setAddFormData((prev) => ({
                        ...prev,
                        viewing_date: e.target.value,
                      }))
                    }
                    disabled={addFormLoading}
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>บันทึก</Label>
                <Textarea
                  value={addFormData.notes}
                  onChange={(e) =>
                    setAddFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="บันทึกเพิ่มเติม..."
                  disabled={addFormLoading}
                  rows={2}
                />
              </div>

              {/* Error Message */}
              {addFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {addFormError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseAddForm}
                  disabled={addFormLoading}
                >
                  ยกเลิก
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddSubmit}
                  disabled={addFormLoading}
                >
                  {addFormLoading ? (
                    "กำลังบันทึก..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      บันทึก
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              กำลังโหลด...
            </div>
          ) : interests.length === 0 && !showAddForm ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">ยังไม่มียูนิตที่สนใจ</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleOpenAddForm}
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มยูนิตแรก
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {(() => {
                const renderGroupRows = (rows: LeadInterestWithDetails[]) => {
                  const grouped = groupByProperty(rows);
                  return Object.entries(grouped).map(([propertyId, group]) => (
                    <div key={propertyId} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b">
                        <h4 className="font-medium text-gray-800 flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {group.property?.name || "ไม่ทราบโครงการ"}
                        </h4>
                      </div>
                      <div className="divide-y">{renderUnitRows(group.interests)}</div>
                    </div>
                  ));
                };
                return (
                  <>
                    {priorityInterests.length > 0 && (
                      <section>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-bold text-chateau">ลูกค้าแสดงความสนใจ — โปรดติดต่อกลับ</h4>
                          <span className="text-xs font-semibold text-chateau">{priorityInterests.length} รายการ</span>
                        </div>
                        <div className="space-y-3">{renderGroupRows(priorityInterests)}</div>
                      </section>
                    )}
                    {bookmarkInterests.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer list-none flex items-center justify-between mb-2 select-none">
                          <h4 className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                            รายการที่ลูกค้าบันทึกไว้ดูทีหลัง
                          </h4>
                          <span className="text-xs font-medium text-gray-400">{bookmarkInterests.length} รายการ</span>
                        </summary>
                        <div className="space-y-3 mt-2">{renderGroupRows(bookmarkInterests)}</div>
                      </details>
                    )}
                    {droppedInterests.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer list-none flex items-center justify-between mb-2 select-none">
                          <h4 className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                            รายการที่ยกเลิกแล้ว
                          </h4>
                          <span className="text-xs font-medium text-gray-400">{droppedInterests.length} รายการ</span>
                        </summary>
                        <div className="space-y-3 mt-2 opacity-75">{renderGroupRows(droppedInterests)}</div>
                      </details>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

LeadInterestsList.displayName = "LeadInterestsList";

export default LeadInterestsList;
