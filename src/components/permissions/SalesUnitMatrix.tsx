import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Loader2,
  ShieldCheck,
  Building2,
  Briefcase,
  Check,
  X,
  MapPin,
  Inbox,
  AlertTriangle,
  Home,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CloneAssignmentsModal, { CloneUser } from "./CloneAssignmentsModal";

interface SalesUser {
  id: string;
  email: string;
  full_name: string | null;
  tenant_id: string;
  tenant_name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  project_id: string;
  price: number;
  status: string;
  project_name?: string;
}

interface Assignment {
  sales_user_id: string;
  unit_id: string;
}

interface SalesProjectLink {
  sales_user_id: string;
  project_id: string;
}

const CoverageBadge = ({ assigned, total }: { assigned: number; total: number }) => {
  const pct = total > 0 ? Math.round((assigned / total) * 100) : 0;
  const color =
    pct === 100 ? "bg-green-100 text-green-700"
      : pct >= 50 ? "bg-amber-100 text-amber-700"
      : pct > 0 ? "bg-orange-100 text-orange-700"
      : "bg-gray-100 text-gray-500";
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", color)}>
      {assigned}/{total}
    </span>
  );
};

export const SalesUnitMatrix = () => {
  const { userRole, currentTenant } = useSimpleAuth();
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canEdit = isOwner || isAdmin;

  const [selectedSalesId, setSelectedSalesId] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [salesSearch, setSalesSearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");

  /* Sales users */
  const { data: salesUsers = [], isLoading: loadingSales } = useQuery<SalesUser[]>({
    queryKey: ["permissions", "sales-users", isOwner ? "all" : currentTenant?.id],
    queryFn: async () => {
      let q = supabase
        .from("users")
        .select("id,email,full_name,tenant_id,tenants(name)")
        .eq("role", "sales")
        .eq("is_active", true)
        .order("email");
      if (!isOwner && currentTenant?.id) q = q.eq("tenant_id", currentTenant.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        tenant_id: u.tenant_id,
        tenant_name: u.tenants?.name || "(no tenant)",
      }));
    },
  });

  /* Sales-project assignments (to know which projects each sales can be designated units in) */
  const { data: salesProjectLinks = [], isLoading: loadingLinks } = useQuery<SalesProjectLink[]>({
    queryKey: ["permissions", "sales-project-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_project_assignments")
        .select("sales_user_id,project_id")
        .is("revoked_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  /* Units (RLS scopes to current user's access) */
  const { data: rawUnits = [], isLoading: loadingUnits } = useQuery<any[]>({
    queryKey: ["permissions", "units-for-sales-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,unit_number,project_id,price,status")
        .order("unit_number");
      if (error) throw error;
      return data || [];
    },
  });

  /* Project name map (for unit display) */
  const { data: projectNameMap = {}, isLoading: loadingProjectNames } = useQuery<Record<string, string>>({
    queryKey: ["permissions", "project-name-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id,name");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data || []) map[p.id] = p.name;
      return map;
    },
  });

  const units: Unit[] = useMemo(
    () =>
      rawUnits.map((u: any) => ({
        id: u.id,
        unit_number: u.unit_number,
        project_id: u.project_id,
        price: u.price,
        status: u.status,
        project_name: projectNameMap[u.project_id] || "(unknown project)",
      })),
    [rawUnits, projectNameMap]
  );

  /* Sales-unit assignments */
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<Assignment[]>({
    queryKey: ["permissions", "sales-unit-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_unit_assignments")
        .select("sales_user_id,unit_id")
        .is("revoked_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (salesUsers.length > 0 && !selectedSalesId) {
      setSelectedSalesId(salesUsers[0].id);
    }
  }, [salesUsers, selectedSalesId]);

  const selectedSales: SalesUser | undefined = useMemo(
    () => salesUsers.find((s) => s.id === selectedSalesId),
    [salesUsers, selectedSalesId]
  );

  /* Units available for selected sales:
     - must be in projects sales is already assigned to (sales_project_assignments) */
  const salesAssignedProjectIds = useMemo(() => {
    if (!selectedSales) return new Set<string>();
    return new Set(
      salesProjectLinks
        .filter((l) => l.sales_user_id === selectedSales.id)
        .map((l) => l.project_id)
    );
  }, [salesProjectLinks, selectedSales]);

  const unitsForSelectedSales = useMemo(
    () => units.filter((u) => salesAssignedProjectIds.has(u.project_id)),
    [units, salesAssignedProjectIds]
  );

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return unitsForSelectedSales;
    return unitsForSelectedSales.filter(
      (u) =>
        u.unit_number.toLowerCase().includes(q) ||
        (u.project_name || "").toLowerCase().includes(q)
    );
  }, [unitsForSelectedSales, unitSearch]);

  const isAssigned = (salesId: string, unitId: string) =>
    assignments.some((a) => a.sales_user_id === salesId && a.unit_id === unitId);

  /* ───── Clone helpers ───── */
  const cloneAllUsers: CloneUser[] = useMemo(
    () =>
      salesUsers.map((s) => ({
        id: s.id,
        name: s.full_name || s.email,
        email: s.email,
        tenantId: s.tenant_id,
        tenantName: s.tenant_name,
        subtitle: s.email,
      })),
    [salesUsers]
  );

  const getItemsForSales = (userId: string) =>
    assignments.filter((a) => a.sales_user_id === userId).map((a) => a.unit_id);

  const selectedSalesItemCount = selectedSales ? getItemsForSales(selectedSales.id).length : 0;
  const hasOtherSameTenant = !!selectedSales &&
    salesUsers.some((s) => s.id !== selectedSales.id && s.tenant_id === selectedSales.tenant_id);

  /* Group sales by tenant */
  const salesByTenant = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    const filtered = salesUsers.filter(
      (s) =>
        !q ||
        s.email.toLowerCase().includes(q) ||
        (s.full_name || "").toLowerCase().includes(q) ||
        s.tenant_name.toLowerCase().includes(q)
    );
    const groups = new Map<string, { tenant_name: string; sales: SalesUser[] }>();
    for (const s of filtered) {
      if (!groups.has(s.tenant_id)) {
        groups.set(s.tenant_id, { tenant_name: s.tenant_name, sales: [] });
      }
      groups.get(s.tenant_id)!.sales.push(s);
    }
    return Array.from(groups.values());
  }, [salesUsers, salesSearch]);

  const getCoverage = (sales: SalesUser) => {
    const salesProjectIds = new Set(
      salesProjectLinks.filter((l) => l.sales_user_id === sales.id).map((l) => l.project_id)
    );
    const totalUnits = units.filter((u) => salesProjectIds.has(u.project_id)).length;
    const assignedUnits = assignments.filter((a) => a.sales_user_id === sales.id).length;
    return { assigned: assignedUnits, total: totalUnits };
  };

  /* Group units by project for display */
  const unitsByProject = useMemo(() => {
    const groups = new Map<string, { project_name: string; project_id: string; units: Unit[] }>();
    for (const u of filteredUnits) {
      const key = u.project_id;
      if (!groups.has(key)) {
        groups.set(key, {
          project_id: u.project_id,
          project_name: u.project_name || "(unknown project)",
          units: [],
        });
      }
      groups.get(key)!.units.push(u);
    }
    return Array.from(groups.values()).sort((a, b) => a.project_name.localeCompare(b.project_name));
  }, [filteredUnits]);

  /* Mutations */
  const toggleOne = useMutation({
    mutationFn: async (params: { salesId: string; unitId: string; assigned: boolean; tenantId: string }) => {
      const { salesId, unitId, assigned, tenantId } = params;
      if (assigned) {
        const { error } = await supabase
          .from("sales_unit_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .eq("unit_id", unitId)
          .is("revoked_at", null);
        if (error) throw error;
      } else {
        const { error: updErr } = await supabase
          .from("sales_unit_assignments")
          .update({ revoked_at: null })
          .eq("sales_user_id", salesId)
          .eq("unit_id", unitId);
        if (updErr) throw updErr;
        const { error: insErr } = await supabase
          .from("sales_unit_assignments")
          .insert({ sales_user_id: salesId, unit_id: unitId, tenant_id: tenantId });
        if (insErr && (insErr as any).code !== "23505") throw insErr;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["permissions", "sales-unit-assignments"] }),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  const bulkAssign = useMutation({
    mutationFn: async (params: { salesId: string; tenantId: string; unitIds: string[]; assign: boolean }) => {
      const { salesId, tenantId, unitIds, assign } = params;
      if (assign) {
        await supabase
          .from("sales_unit_assignments")
          .update({ revoked_at: null })
          .eq("sales_user_id", salesId)
          .in("unit_id", unitIds);
        const rows = unitIds.map((uid) => ({
          sales_user_id: salesId,
          unit_id: uid,
          tenant_id: tenantId,
        }));
        const { error } = await supabase
          .from("sales_unit_assignments")
          .upsert(rows, { onConflict: "sales_user_id,unit_id", ignoreDuplicates: false });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sales_unit_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .in("unit_id", unitIds)
          .is("revoked_at", null);
        if (error) throw error;
      }
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ["permissions", "sales-unit-assignments"] });
      toast.success(variables.assign ? "เลือกทั้งหมดเรียบร้อย" : "ล้างทั้งหมดเรียบร้อย");
    },
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  const loading = loadingSales || loadingUnits || loadingProjectNames || loadingAssignments || loadingLinks;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (salesUsers.length === 0) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center text-gray-500">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          ยังไม่มี Sales (พนักงานขาย) ในระบบ
        </CardContent>
      </Card>
    );
  }

  const formatPrice = (price: number) => {
    if (!price) return "-";
    if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(2)} ล้าน`;
    return price.toLocaleString();
  };

  const statusColor = (status: string) => {
    if (status === "available") return "bg-green-100 text-green-700";
    if (status === "reserved") return "bg-amber-100 text-amber-700";
    if (status === "sold") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">โหมดดูอย่างเดียว</p>
            <p className="text-xs">เฉพาะ Owner / Admin เท่านั้นที่แก้ไขสิทธิ์ Sales ดูแลยูนิตได้</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* LEFT: Sales list */}
        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Sales (พนักงานขาย)</h3>
              <span className="text-xs text-gray-500">{salesUsers.length} คน</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหา sales..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {salesByTenant.map((group) => (
                <div key={group.tenant_name} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 px-1 pt-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {group.tenant_name}
                    <span className="text-gray-400">({group.sales.length})</span>
                  </div>
                  {group.sales.map((sales) => {
                    const { assigned, total } = getCoverage(sales);
                    const isSelected = selectedSalesId === sales.id;
                    return (
                      <button
                        key={sales.id}
                        onClick={() => setSelectedSalesId(sales.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5",
                          isSelected
                            ? "bg-chateau-50 border-2 border-chateau ring-1 ring-chateau/20"
                            : "border-2 border-transparent hover:bg-gray-50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-chateau text-white" : "bg-gray-100 text-gray-500"
                          )}
                        >
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {sales.full_name || sales.email}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{sales.email}</div>
                        </div>
                        <CoverageBadge assigned={assigned} total={total} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Units for selected sales */}
        <Card>
          <CardContent className="p-4">
            {!selectedSales ? (
              <div className="py-20 text-center text-gray-500">
                <Briefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                เลือก Sales ทางซ้ายเพื่อกำหนดยูนิตที่ปิดดีล
              </div>
            ) : salesAssignedProjectIds.size === 0 ? (
              <div className="py-12 text-center">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
                <h4 className="font-semibold text-gray-900 mb-1">Sales ยังไม่ได้รับสิทธิ์โครงการ</h4>
                <p className="text-sm text-gray-600 mb-4">
                  กำหนดสิทธิ์โครงการให้ <strong>{selectedSales.full_name || selectedSales.email}</strong> ก่อน
                  <br />ที่ Tab <strong>"สิทธิ์ Sales ดูแลโครงการ"</strong>
                </p>
                <p className="text-xs text-gray-500">
                  หลังจากนั้น units ของโครงการที่ assigned จะขึ้นมาให้เลือกที่นี่
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedSales.full_name || selectedSales.email}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedSales.tenant_name}
                      <span className="text-gray-300">·</span>
                      <span>
                        รับผิดชอบ{" "}
                        <span className="font-semibold text-chateau">
                          {assignments.filter(
                            (a) =>
                              a.sales_user_id === selectedSales.id &&
                              unitsForSelectedSales.some((u) => u.id === a.unit_id)
                          ).length}
                        </span>{" "}
                        / {unitsForSelectedSales.length} ยูนิต
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 รายการ unit นี้คือยูนิตในโครงการที่ sales ได้รับ assigned แล้ว
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหายูนิต (เลขที่ / โครงการ)..."
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || bulkAssign.isPending || filteredUnits.length === 0}
                    onClick={() =>
                      bulkAssign.mutate({
                        salesId: selectedSales.id,
                        tenantId: selectedSales.tenant_id,
                        unitIds: filteredUnits.map((u) => u.id),
                        assign: true,
                      })
                    }
                  >
                    <Check className="w-4 h-4 mr-1" />
                    เลือกทั้งหมด{unitSearch && " (ที่กรอง)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || bulkAssign.isPending || filteredUnits.length === 0}
                    onClick={() =>
                      bulkAssign.mutate({
                        salesId: selectedSales.id,
                        tenantId: selectedSales.tenant_id,
                        unitIds: filteredUnits.map((u) => u.id),
                        assign: false,
                      })
                    }
                  >
                    <X className="w-4 h-4 mr-1" />
                    ล้างทั้งหมด{unitSearch && " (ที่กรอง)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || selectedSalesItemCount === 0 || !hasOtherSameTenant}
                    onClick={() => setCloneOpen(true)}
                    title={
                      selectedSalesItemCount === 0
                        ? "Sales คนนี้ยังไม่มียูนิตที่รับผิดชอบ"
                        : !hasOtherSameTenant
                        ? "ไม่มี Sales คนอื่นใน tenant เดียวกัน"
                        : "โคลนสิทธิ์ยูนิตไปยัง Sales คนอื่น"
                    }
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    โคลนสิทธิ์
                  </Button>
                </div>

                {filteredUnits.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {unitSearch
                      ? `ไม่พบยูนิตที่ค้นหา "${unitSearch}"`
                      : "โครงการที่ sales ได้รับ assigned ยังไม่มียูนิต"}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {unitsByProject.map((group) => (
                      <div key={group.project_id}>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 px-1 pb-1.5 pt-2">
                          <Home className="w-3.5 h-3.5" />
                          {group.project_name}
                          <span className="text-xs text-gray-400 font-normal">
                            ({group.units.length} ยูนิต)
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {group.units.map((u) => {
                            const checked = isAssigned(selectedSales.id, u.id);
                            return (
                              <label
                                key={u.id}
                                className={cn(
                                  "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border border-gray-200 hover:bg-gray-50",
                                  !canEdit && "cursor-not-allowed opacity-90"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canEdit || toggleOne.isPending}
                                  onChange={() =>
                                    toggleOne.mutate({
                                      salesId: selectedSales.id,
                                      unitId: u.id,
                                      assigned: checked,
                                      tenantId: selectedSales.tenant_id,
                                    })
                                  }
                                  className="w-4 h-4 accent-chateau cursor-pointer disabled:cursor-not-allowed"
                                />
                                <div className="flex-1 min-w-0 flex items-center gap-3">
                                  <div className="font-mono text-sm font-medium text-gray-900">
                                    {u.unit_number}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {formatPrice(u.price)}
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "text-xs px-2 py-0.5 rounded-full font-medium",
                                    statusColor(u.status)
                                  )}
                                >
                                  {u.status === "available"
                                    ? "ว่าง"
                                    : u.status === "reserved"
                                    ? "จอง"
                                    : u.status === "sold"
                                    ? "ขาย"
                                    : u.status}
                                </span>
                                {checked && (
                                  <span className="text-xs font-medium text-chateau">รับผิดชอบ</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <CloneAssignmentsModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        allUsers={cloneAllUsers}
        getItemsFor={getItemsForSales}
        getItemName={(id) => {
          const u = units.find((x) => x.id === id);
          if (!u) return id;
          return u.project_name ? `${u.unit_number} · ${u.project_name}` : u.unit_number;
        }}
        initialSourceId={selectedSales?.id}
        itemLabel="ยูนิต"
        roleLabel="Sales"
        table="sales_unit_assignments"
        userColumn="sales_user_id"
        itemColumn="unit_id"
        queryKeyPrefix="permissions"
      />
    </div>
  );
};
