import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, AlertTriangle, Check, ChevronRight, ChevronLeft, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CloneUser {
  id: string;
  name: string;
  email?: string;
  tenantId: string;
  tenantName?: string;
  subtitle?: string;
}

export interface CloneTarget extends CloneUser {
  existingCount: number;
}

interface CloneAssignmentsModalProps {
  open: boolean;
  onClose: () => void;
  /** All eligible users (of the relevant role) — used in both Source + Target steps */
  allUsers: CloneUser[];
  /** Function returning the item IDs (projects/units) that this user has active assignments to */
  getItemsFor: (userId: string) => string[];
  /** Optional: pre-select a source user (e.g. the one user was viewing) */
  initialSourceId?: string;
  /** "โครงการ" or "ยูนิต" */
  itemLabel: string;
  /** "Admin", "Sales", "Agent" — used in titles */
  roleLabel: string;
  /** Optional resolver: itemId → human-readable name (e.g. project name / unit number) */
  getItemName?: (itemId: string) => string;
  /** DB table */
  table: string;
  userColumn: string;
  itemColumn: string;
  queryKeyPrefix: string;
}

/* ───── Stepper ───── */
const StepIndicator = ({
  num,
  label,
  state,
}: {
  num: number;
  label: string;
  state: "done" | "active" | "pending";
}) => (
  <div className="flex items-center gap-2 flex-1 min-w-0">
    <div
      className={cn(
        "flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold flex-shrink-0",
        state === "done" && "bg-green-500 text-white",
        state === "active" && "bg-chateau text-white",
        state === "pending" && "bg-gray-100 text-gray-400"
      )}
    >
      {state === "done" ? <Check className="w-4 h-4" /> : num}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">STEP {num}</p>
      <p
        className={cn(
          "text-sm truncate",
          state === "pending" ? "text-gray-400" : "text-gray-900 font-medium"
        )}
      >
        {label}
      </p>
    </div>
  </div>
);

/* ───── User Card (for grid) ───── */
const UserCard = ({
  user,
  itemCount,
  itemLabel,
  selected,
  selectable,
  onClick,
  multi,
}: {
  user: CloneUser;
  itemCount: number;
  itemLabel: string;
  selected: boolean;
  selectable: boolean;
  onClick: () => void;
  multi: boolean;
}) => (
  <button
    type="button"
    onClick={selectable ? onClick : undefined}
    disabled={!selectable}
    className={cn(
      "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all w-full",
      selected
        ? "border-chateau bg-chateau-50/40"
        : "border-gray-200 hover:border-gray-300 bg-white",
      !selectable && "opacity-50 cursor-not-allowed"
    )}
  >
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-chateau to-purple-600 flex items-center justify-center text-white flex-shrink-0">
      <UserIcon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-gray-900 truncate">{user.name}</p>
      <p className="text-xs text-gray-500 truncate">{user.subtitle || user.email || ""}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        มีสิทธิ์ <span className="font-semibold text-gray-700">{itemCount}</span> {itemLabel}
      </p>
    </div>
    {multi ? (
      <div
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
          selected ? "bg-chateau border-chateau text-white" : "border-gray-300"
        )}
      >
        {selected && <Check className="w-3 h-3" />}
      </div>
    ) : (
      selected && (
        <div className="w-6 h-6 rounded-full bg-chateau text-white flex items-center justify-center flex-shrink-0">
          <Check className="w-3.5 h-3.5" />
        </div>
      )
    )}
  </button>
);

export const CloneAssignmentsModal = ({
  open,
  onClose,
  allUsers,
  getItemsFor,
  initialSourceId,
  itemLabel,
  roleLabel,
  getItemName,
  table,
  userColumn,
  itemColumn,
  queryKeyPrefix,
}: CloneAssignmentsModalProps) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");

  /* Reset when modal opens / closes */
  useEffect(() => {
    if (open) {
      setSourceId(initialSourceId || null);
      setTargetIds(new Set());
      setStep(1);
      setOverwrite(false);
      setSourceSearch("");
      setTargetSearch("");
    }
  }, [open, initialSourceId]);

  const source = useMemo(
    () => allUsers.find((u) => u.id === sourceId) || null,
    [allUsers, sourceId]
  );
  const sourceItemIds = useMemo(
    () => (source ? getItemsFor(source.id) : []),
    [source, getItemsFor]
  );

  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    return allUsers.filter(
      (u) => !q || u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [allUsers, sourceSearch]);

  const eligibleTargets = useMemo(() => {
    if (!source) return [];
    return allUsers.filter((u) => u.id !== source.id && u.tenantId === source.tenantId);
  }, [allUsers, source]);

  const filteredTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    return eligibleTargets.filter(
      (u) => !q || u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [eligibleTargets, targetSearch]);

  const selectedTargets = useMemo(
    () => eligibleTargets.filter((t) => targetIds.has(t.id)),
    [eligibleTargets, targetIds]
  );

  const toggleTarget = (id: string) => {
    setTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clone = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("ยังไม่ได้เลือก Source");
      if (selectedTargets.length === 0) throw new Error("ยังไม่ได้เลือก Target");
      if (sourceItemIds.length === 0) throw new Error(`Source ไม่มี${itemLabel}ที่จะโคลน`);

      for (const target of selectedTargets) {
        // 1. Overwrite mode: revoke target's existing rows that are NOT in source set
        if (overwrite) {
          let q = supabase
            .from(table)
            .update({ revoked_at: new Date().toISOString() })
            .eq(userColumn, target.id)
            .is("revoked_at", null);
          if (sourceItemIds.length > 0) {
            q = q.not(itemColumn, "in", `(${sourceItemIds.map((id) => `"${id}"`).join(",")})`);
          }
          const { error } = await q;
          if (error) throw error;
        }

        // 2. Un-revoke any existing rows for target × source's items
        const { error: unrevokeErr } = await supabase
          .from(table)
          .update({ revoked_at: null })
          .eq(userColumn, target.id)
          .in(itemColumn, sourceItemIds);
        if (unrevokeErr) throw unrevokeErr;

        // 3. Insert any missing rows (upsert)
        const rows = sourceItemIds.map((id) => ({
          [userColumn]: target.id,
          [itemColumn]: id,
          tenant_id: target.tenantId,
        }));
        const { error: insertErr } = await supabase
          .from(table)
          .upsert(rows, { onConflict: `${userColumn},${itemColumn}`, ignoreDuplicates: false });
        if (insertErr) throw insertErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      toast.success(
        `Clone ${sourceItemIds.length} ${itemLabel} → ${selectedTargets.length} ${roleLabel} สำเร็จ`
      );
      onClose();
    },
    onError: (err: any) => {
      toast.error(`Clone ไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`);
    },
  });

  const canGoNext =
    step === 1 ? !!source && sourceItemIds.length > 0 :
    step === 2 ? targetIds.size > 0 :
    false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            CLONE PERMISSIONS WIZARD
          </p>
          <h2 className="text-2xl font-bold text-gray-900">Clone สิทธิ์ {roleLabel}</h2>
          <p className="text-sm text-gray-500 mt-1">
            คัดลอกชุดสิทธิ์ {itemLabel} จาก {roleLabel} A ไปยัง {roleLabel} B (หลายคนพร้อมกัน) — เหมาะกับ {roleLabel} ใหม่ที่พึ่งเข้า
          </p>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-start gap-3">
            <StepIndicator
              num={1}
              label="เลือก Source"
              state={step === 1 ? "active" : step > 1 ? "done" : "pending"}
            />
            <div className="flex-shrink-0 h-px bg-gray-200 w-8 sm:w-16 mt-4" />
            <StepIndicator
              num={2}
              label="เลือก Targets"
              state={step === 2 ? "active" : step > 2 ? "done" : "pending"}
            />
            <div className="flex-shrink-0 h-px bg-gray-200 w-8 sm:w-16 mt-4" />
            <StepIndicator
              num={3}
              label="ตรวจสอบ + Clone"
              state={step === 3 ? "active" : "pending"}
            />
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* ───── STEP 1: Source ───── */}
          {step === 1 && (
            <div>
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900">Step 1 · เลือก Source {roleLabel}</h3>
                <p className="text-sm text-gray-500">คัดลอกสิทธิ์จาก {roleLabel} คนนี้</p>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="ค้นหา..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {filteredSources.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-500 border-2 border-dashed rounded-lg">
                  ไม่พบ {roleLabel}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredSources.map((u) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      itemCount={getItemsFor(u.id).length}
                      itemLabel={itemLabel}
                      selected={sourceId === u.id}
                      selectable={true}
                      multi={false}
                      onClick={() => setSourceId(u.id)}
                    />
                  ))}
                </div>
              )}
              {source && sourceItemIds.length === 0 && (
                <p className="mt-3 text-xs text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {roleLabel} คนนี้ไม่มี{itemLabel}ที่จะ Clone — เลือกคนอื่น
                </p>
              )}
            </div>
          )}

          {/* ───── STEP 2: Targets ───── */}
          {step === 2 && (
            <div>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Step 2 · เลือก Target {roleLabel}
                  </h3>
                  <p className="text-sm text-gray-500">
                    ติ๊ก {roleLabel} ที่จะ apply สิทธิ์เดียวกัน (เลือกได้หลายคน)
                  </p>
                </div>
                {eligibleTargets.length > 0 && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTargetIds(new Set(filteredTargets.map((t) => t.id)))}
                    >
                      เลือกทั้งหมด
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTargetIds(new Set())}
                      disabled={targetIds.size === 0}
                    >
                      ล้าง
                    </Button>
                  </div>
                )}
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="ค้นหา..."
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {eligibleTargets.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-500 border-2 border-dashed rounded-lg">
                  ไม่มี {roleLabel} คนอื่นใน tenant เดียวกัน
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredTargets.map((u) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      itemCount={getItemsFor(u.id).length}
                      itemLabel={itemLabel}
                      selected={targetIds.has(u.id)}
                      selectable={true}
                      multi={true}
                      onClick={() => toggleTarget(u.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ───── STEP 3: Review ───── */}
          {step === 3 && source && (
            <div>
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900">Step 3 · ตรวจสอบและยืนยัน</h3>
                <p className="text-sm text-gray-500">
                  ตรวจให้แน่ใจก่อนกด Clone {overwrite && "— การดำเนินการจะ override สิทธิ์ปัจจุบันของ Target"}
                </p>
              </div>

              {/* Source */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1">
                  SOURCE
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-blue-900">{source.name}</p>
                    {source.tenantName && (
                      <p className="text-xs text-blue-700">{source.tenantName}</p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white text-blue-700 font-medium">
                    มีสิทธิ์ {sourceItemIds.length} {itemLabel}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 my-2 flex items-center gap-1 px-2">
                <ChevronRight className="w-3 h-3" /> APPLY ไป
              </p>

              {/* Targets */}
              <div className="space-y-2 mb-3">
                {selectedTargets.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 border border-gray-200 rounded-lg flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                        TARGET
                      </p>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      มีอยู่ {getItemsFor(t.id).length} {itemLabel}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mode selector */}
              <div className="space-y-2 mb-3 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={!overwrite}
                    onChange={() => setOverwrite(false)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Merge — เพิ่มเข้าไป (แนะนำ)</p>
                    <p className="text-xs text-gray-500">
                      เพิ่มสิทธิ์จาก Source ให้ Target โดยไม่ลบของเดิม
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={overwrite}
                    onChange={() => setOverwrite(true)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Overwrite — ทับทั้งหมด</p>
                    <p className="text-xs text-orange-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {itemLabel}ของ Target ที่ไม่ใช่ของ Source จะถูก revoke
                    </p>
                  </div>
                </label>
              </div>

              {/* Warning */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-semibold mb-0.5">คำเตือน</p>
                  <p>
                    สิทธิ์ปัจจุบันของ Target {roleLabel}{" "}
                    <span className="font-semibold">{selectedTargets.length}</span> คน
                    จะถูก {overwrite ? "override" : "เพิ่ม"} เป็นชุดสิทธิ์ของ Source · ตรวจให้แน่ใจก่อนคลิก Clone
                  </p>
                </div>
              </div>

              {/* Collapsible items preview */}
              <details className="text-sm">
                <summary className="cursor-pointer text-chateau hover:underline">
                  ▶ ดู {itemLabel} ที่จะถูก clone ({sourceItemIds.length} รายการ)
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-700 max-h-40 overflow-y-auto">
                  <ul className="space-y-1 list-disc list-inside">
                    {sourceItemIds.map((id, idx) => {
                      const name = getItemName ? getItemName(id) : id;
                      return (
                        <li key={id} className="truncate" title={id}>
                          <span className="text-gray-400 mr-1">{idx + 1}.</span>
                          {name}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center sticky bottom-0">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : onClose())}
            disabled={clone.isPending}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 1 ? "ยกเลิก" : "ย้อนกลับ"}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep((step + 1) as 1 | 2 | 3)}
              disabled={!canGoNext}
              className="bg-chateau hover:bg-chateau/90"
            >
              ถัดไป
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => clone.mutate()}
              disabled={
                !source ||
                selectedTargets.length === 0 ||
                sourceItemIds.length === 0 ||
                clone.isPending
              }
              className="bg-chateau hover:bg-chateau/90"
            >
              <Copy className="w-4 h-4 mr-1" />
              {clone.isPending
                ? "กำลัง Clone..."
                : `Clone ตอนนี้ · ${selectedTargets.length} ${roleLabel}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CloneAssignmentsModal;
