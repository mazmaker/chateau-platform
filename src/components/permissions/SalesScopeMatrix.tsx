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
  MapPin,
  Inbox,
  Home,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CloneAssignmentsModal, { CloneUser } from "./CloneAssignmentsModal";

/*
 * SalesScopeMatrix — merged "project + unit" permission UI (nested).
 *
 * Replaces the two separate tabs (Sales×Project + Sales×Unit) with one nested view:
 *   - Ticking a PROJECT  -> sales_project_assignments  = Sales SEES all units in it (visibility).
 *   - Ticking a UNIT inside -> sales_unit_assignments  = Sales can close/edit that unit (action).
 *
 * Cascade (matches the underlying RLS prerequisite — a unit assignment without the parent
 * project is a broken state: writable but invisible):
 *   - Untick project  -> also revoke every unit assignment in that project.
 *   - Tick a unit      -> auto-assign the parent project if not already (so the unit is visible).
 *
 * The data model / RLS is untouched — same tables + same insert/revoke patterns as the
 * original SalesProjectMatrix / SalesUnitMatrix.
 */

interface SalesUser {
  id: string;
  email: string;
  full_name: string | null;
  tenant_id: string;
  tenant_name: string;
}

interface Project {
  id: string;
  name: string;
  tenant_id: string;
  developer: string | null;
  type: string | null;
}

interface Unit {
  id: string;
  unit_number: string;
  project_id: string;
  price: number;
  status: string;
}

interface ProjectLink {
  sales_user_id: string;
  project_id: string;
}
interface UnitLink {
  sales_user_id: string;
  unit_id: string;
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

export const SalesScopeMatrix = () => {
  const { userRole, currentTenant } = useSimpleAuth();
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canEdit = isOwner || isAdmin;

  const [selectedSalesId, setSelectedSalesId] = useState<string | null>(null);
  const [salesSearch, setSalesSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cloneOpen, setCloneOpen] = useState(false);

  /* ───── Sales users ───── */
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

  /* ───── Projects (RLS scopes admin to their assigned projects) ───── */
  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["permissions", "projects-for-sales-assignment", isOwner ? "all" : currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id,name,tenant_id,developer,type")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  /* ───── Units (RLS-scoped) ───── */
  const { data: units = [], isLoading: loadingUnits } = useQuery<Unit[]>({
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

  /* ───── Project + Unit assignments ───── */
  const { data: projectLinks = [], isLoading: loadingPLinks } = useQuery<ProjectLink[]>({
    queryKey: ["permissions", "sales-project-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_project_assignments")
        .select("sales_user_id,project_id")
        .is("revoked_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: unitLinks = [], isLoading: loadingULinks } = useQuery<UnitLink[]>({
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
    if (salesUsers.length > 0 && !selectedSalesId) setSelectedSalesId(salesUsers[0].id);
  }, [salesUsers, selectedSalesId]);

  const selectedSales = useMemo(
    () => salesUsers.find((s) => s.id === selectedSalesId),
    [salesUsers, selectedSalesId]
  );

  /* Units grouped by project id */
  const unitsByProjectId = useMemo(() => {
    const map = new Map<string, Unit[]>();
    for (const u of units) {
      if (!map.has(u.project_id)) map.set(u.project_id, []);
      map.get(u.project_id)!.push(u);
    }
    return map;
  }, [units]);

  /* Projects available for selected sales (same tenant; RLS already scoped admin) */
  const projectsForSelectedSales = useMemo(
    () => (selectedSales ? projects.filter((p) => p.tenant_id === selectedSales.tenant_id) : []),
    [projects, selectedSales]
  );

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projectsForSelectedSales;
    return projectsForSelectedSales.filter((p) => {
      if (
        p.name.toLowerCase().includes(q) ||
        (p.developer || "").toLowerCase().includes(q) ||
        (p.type || "").toLowerCase().includes(q)
      )
        return true;
      // also match if a unit number inside matches
      return (unitsByProjectId.get(p.id) || []).some((u) =>
        u.unit_number.toLowerCase().includes(q)
      );
    });
  }, [projectsForSelectedSales, projectSearch, unitsByProjectId]);

  const isProjectAssigned = (salesId: string, projectId: string) =>
    projectLinks.some((l) => l.sales_user_id === salesId && l.project_id === projectId);
  const isUnitAssigned = (salesId: string, unitId: string) =>
    unitLinks.some((l) => l.sales_user_id === salesId && l.unit_id === unitId);

  const assignedUnitCountInProject = (salesId: string, projectId: string) =>
    (unitsByProjectId.get(projectId) || []).filter((u) => isUnitAssigned(salesId, u.id)).length;

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
      if (!groups.has(s.tenant_id)) groups.set(s.tenant_id, { tenant_name: s.tenant_name, sales: [] });
      groups.get(s.tenant_id)!.sales.push(s);
    }
    return Array.from(groups.values());
  }, [salesUsers, salesSearch]);

  const getCoverage = (sales: SalesUser) => {
    const total = projects.filter((p) => p.tenant_id === sales.tenant_id).length;
    const assigned = projectLinks.filter(
      (l) =>
        l.sales_user_id === sales.id &&
        projects.some((p) => p.id === l.project_id && p.tenant_id === sales.tenant_id)
    ).length;
    return { assigned, total };
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["permissions", "sales-project-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["permissions", "sales-unit-assignments"] });
  };

  /* ───── Project toggle (with cascade-down on revoke) ───── */
  const toggleProject = useMutation({
    mutationFn: async (params: {
      salesId: string;
      projectId: string;
      assigned: boolean;
      tenantId: string;
      unitIdsInProject: string[];
    }) => {
      const { salesId, projectId, assigned, tenantId, unitIdsInProject } = params;
      if (assigned) {
        // REVOKE project visibility …
        const { error } = await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .eq("project_id", projectId)
          .is("revoked_at", null);
        if (error) throw error;
        // … and cascade-down: revoke every unit assignment in this project (no orphan units).
        if (unitIdsInProject.length > 0) {
          const { error: uErr } = await supabase
            .from("sales_unit_assignments")
            .update({ revoked_at: new Date().toISOString() })
            .eq("sales_user_id", salesId)
            .in("unit_id", unitIdsInProject)
            .is("revoked_at", null);
          if (uErr) throw uErr;
        }
      } else {
        // ASSIGN project + ALL its units (project ⟺ units coupled: no "assigned but 0 units" state)
        const { error: updErr } = await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: null })
          .eq("sales_user_id", salesId)
          .eq("project_id", projectId);
        if (updErr) throw updErr;
        const { error: insErr } = await supabase
          .from("sales_project_assignments")
          .insert({ sales_user_id: salesId, project_id: projectId, tenant_id: tenantId });
        if (insErr && (insErr as any).code !== "23505") throw insErr;
        if (unitIdsInProject.length > 0) {
          await supabase
            .from("sales_unit_assignments")
            .update({ revoked_at: null })
            .eq("sales_user_id", salesId)
            .in("unit_id", unitIdsInProject);
          const uRows = unitIdsInProject.map((uid) => ({ sales_user_id: salesId, unit_id: uid, tenant_id: tenantId }));
          const { error: uErr } = await supabase
            .from("sales_unit_assignments")
            .upsert(uRows, { onConflict: "sales_user_id,unit_id", ignoreDuplicates: false });
          if (uErr) throw uErr;
        }
      }
    },
    onSuccess: () => invalidateAll(),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  /* ───── Unit toggle (cascade-up on assign · untick project when last unit removed) ───── */
  const toggleUnit = useMutation({
    mutationFn: async (params: {
      salesId: string;
      unitId: string;
      projectId: string;
      assigned: boolean;
      tenantId: string;
      projectAssigned: boolean;
      lastUnit: boolean;
    }) => {
      const { salesId, unitId, projectId, assigned, tenantId, projectAssigned, lastUnit } = params;
      if (assigned) {
        // REVOKE unit; if it was the last assigned unit, untick the project too (no "0-unit" ghost)
        const { error } = await supabase
          .from("sales_unit_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .eq("unit_id", unitId)
          .is("revoked_at", null);
        if (error) throw error;
        if (lastUnit) {
          const { error: pErr } = await supabase
            .from("sales_project_assignments")
            .update({ revoked_at: new Date().toISOString() })
            .eq("sales_user_id", salesId)
            .eq("project_id", projectId)
            .is("revoked_at", null);
          if (pErr) throw pErr;
        }
      } else {
        // ASSIGN unit → cascade-up: ensure the parent project is assigned first (so unit is visible).
        if (!projectAssigned) {
          const { error: pUpd } = await supabase
            .from("sales_project_assignments")
            .update({ revoked_at: null })
            .eq("sales_user_id", salesId)
            .eq("project_id", projectId);
          if (pUpd) throw pUpd;
          const { error: pIns } = await supabase
            .from("sales_project_assignments")
            .insert({ sales_user_id: salesId, project_id: projectId, tenant_id: tenantId });
          if (pIns && (pIns as any).code !== "23505") throw pIns;
        }
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
    onSuccess: (_d, vars) => {
      invalidateAll();
      if (!vars.assigned && !vars.projectAssigned) {
        toast.success("เปิดสิทธิ์โครงการให้อัตโนมัติ (เพราะมียูนิตที่รับผิดชอบ)");
      }
    },
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  /* ───── Bulk projects (clear cascades down to their units) ───── */
  const bulkProjects = useMutation({
    mutationFn: async (params: { salesId: string; tenantId: string; projectIds: string[]; assign: boolean }) => {
      const { salesId, tenantId, projectIds, assign } = params;
      if (projectIds.length === 0) return;
      if (assign) {
        await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: null })
          .eq("sales_user_id", salesId)
          .in("project_id", projectIds);
        const rows = projectIds.map((pid) => ({ sales_user_id: salesId, project_id: pid, tenant_id: tenantId }));
        const { error } = await supabase
          .from("sales_project_assignments")
          .upsert(rows, { onConflict: "sales_user_id,project_id", ignoreDuplicates: false });
        if (error) throw error;
        // couple: assign all units of these projects too
        const unitIds = projectIds.flatMap((pid) => (unitsByProjectId.get(pid) || []).map((u) => u.id));
        if (unitIds.length > 0) {
          await supabase
            .from("sales_unit_assignments")
            .update({ revoked_at: null })
            .eq("sales_user_id", salesId)
            .in("unit_id", unitIds);
          const uRows = unitIds.map((uid) => ({ sales_user_id: salesId, unit_id: uid, tenant_id: tenantId }));
          const { error: uErr } = await supabase
            .from("sales_unit_assignments")
            .upsert(uRows, { onConflict: "sales_user_id,unit_id", ignoreDuplicates: false });
          if (uErr) throw uErr;
        }
      } else {
        const { error } = await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .in("project_id", projectIds)
          .is("revoked_at", null);
        if (error) throw error;
        const unitIds = projectIds.flatMap((pid) => (unitsByProjectId.get(pid) || []).map((u) => u.id));
        if (unitIds.length > 0) {
          const { error: uErr } = await supabase
            .from("sales_unit_assignments")
            .update({ revoked_at: new Date().toISOString() })
            .eq("sales_user_id", salesId)
            .in("unit_id", unitIds)
            .is("revoked_at", null);
          if (uErr) throw uErr;
        }
      }
    },
    onSuccess: (_d, v) => {
      invalidateAll();
      toast.success(v.assign ? "เลือกทุกโครงการเรียบร้อย" : "ล้างทั้งหมดเรียบร้อย (รวมยูนิต)");
    },
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  /* ───── Bulk units within ONE project (assign cascades up to the project) ───── */
  const bulkUnits = useMutation({
    mutationFn: async (params: {
      salesId: string;
      tenantId: string;
      projectId: string;
      unitIds: string[];
      assign: boolean;
      projectAssigned: boolean;
    }) => {
      const { salesId, tenantId, projectId, unitIds, assign, projectAssigned } = params;
      if (unitIds.length === 0) return;
      if (assign) {
        if (!projectAssigned) {
          await supabase
            .from("sales_project_assignments")
            .update({ revoked_at: null })
            .eq("sales_user_id", salesId)
            .eq("project_id", projectId);
          const { error: pIns } = await supabase
            .from("sales_project_assignments")
            .insert({ sales_user_id: salesId, project_id: projectId, tenant_id: tenantId });
          if (pIns && (pIns as any).code !== "23505") throw pIns;
        }
        await supabase
          .from("sales_unit_assignments")
          .update({ revoked_at: null })
          .eq("sales_user_id", salesId)
          .in("unit_id", unitIds);
        const rows = unitIds.map((uid) => ({ sales_user_id: salesId, unit_id: uid, tenant_id: tenantId }));
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
        // cleared all units → untick the project too (no "0-unit" ghost)
        const { error: pErr } = await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .eq("project_id", projectId)
          .is("revoked_at", null);
        if (pErr) throw pErr;
      }
    },
    onSuccess: () => invalidateAll(),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  /* ───── Clone (project-scope = visibility) helpers ───── */
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
  const getProjectItemsForSales = (userId: string) =>
    projectLinks.filter((l) => l.sales_user_id === userId).map((l) => l.project_id);
  const selectedHasProjects = selectedSales
    ? getProjectItemsForSales(selectedSales.id).length > 0
    : false;
  const hasOtherSameTenant =
    !!selectedSales &&
    salesUsers.some((s) => s.id !== selectedSales.id && s.tenant_id === selectedSales.tenant_id);

  const toggleExpand = (projectId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });

  const loading =
    loadingSales || loadingProjects || loadingUnits || loadingPLinks || loadingULinks;
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
          ยังไม่มีพนักงานขาย (Sales) ในระบบ — สร้างพนักงานขายก่อนค่อยกำหนดสิทธิ์
        </CardContent>
      </Card>
    );
  }

  const formatPrice = (price: number) => {
    if (!price) return "-";
    if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(2)} ล้าน`;
    return price.toLocaleString();
  };
  const statusLabel = (s: string) =>
    s === "available" ? "ว่าง" : s === "reserved" ? "จอง" : s === "sold" ? "ขาย" : s;
  const statusColor = (s: string) =>
    s === "available" ? "bg-green-100 text-green-700"
      : s === "reserved" ? "bg-amber-100 text-amber-700"
      : s === "sold" ? "bg-red-100 text-red-700"
      : "bg-gray-100 text-gray-600";

  const assignedProjectCount = selectedSales
    ? projectsForSelectedSales.filter((p) => isProjectAssigned(selectedSales.id, p.id)).length
    : 0;

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">โหมดดูอย่างเดียว</p>
            <p className="text-xs">เฉพาะเจ้าของแพลตฟอร์ม / ผู้ดูแลบริษัทเท่านั้นที่แก้ไขสิทธิ์พนักงานขายได้</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* LEFT: Sales list */}
        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">พนักงานขาย (Sales)</h3>
              <span className="text-xs text-gray-500">{salesUsers.length} คน</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหาพนักงานขาย / บริษัท..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {salesByTenant.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">ไม่พบรายการที่ค้นหา</p>
              )}
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

        {/* RIGHT: Nested projects → units */}
        <Card>
          <CardContent className="p-4">
            {!selectedSales ? (
              <div className="py-20 text-center text-gray-500">
                <Briefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                เลือกพนักงานขายทางซ้ายเพื่อจัดการสิทธิ์
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedSales.full_name || selectedSales.email}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedSales.tenant_name}
                      <span className="text-gray-300">·</span>
                      <span>
                        ดูแล{" "}
                        <span className="font-semibold text-chateau">{assignedProjectCount}</span> /{" "}
                        {projectsForSelectedSales.length} โครงการ
                      </span>
                    </div>
                  </div>
                </div>

                {/* legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-chateau inline-block" /> ติ๊กโครงการ = รับผิดชอบทุกยูนิตในโครงการ
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Home className="w-3 h-3" /> ติ๊กยูนิต = รับเฉพาะบางยูนิต · เอาออกจนหมด = โครงการหลุดเอง
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหาโครงการ / ยูนิต..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || bulkProjects.isPending || filteredProjects.length === 0}
                    onClick={() =>
                      bulkProjects.mutate({
                        salesId: selectedSales.id,
                        tenantId: selectedSales.tenant_id,
                        projectIds: filteredProjects.map((p) => p.id),
                        assign: true,
                      })
                    }
                  >
                    <Check className="w-4 h-4 mr-1" />
                    เลือกทุกโครงการ{projectSearch && " (ที่กรอง)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || bulkProjects.isPending || filteredProjects.length === 0}
                    onClick={() =>
                      bulkProjects.mutate({
                        salesId: selectedSales.id,
                        tenantId: selectedSales.tenant_id,
                        projectIds: filteredProjects.map((p) => p.id),
                        assign: false,
                      })
                    }
                  >
                    <X className="w-4 h-4 mr-1" />
                    ล้างทั้งหมด{projectSearch && " (ที่กรอง)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || !selectedHasProjects || !hasOtherSameTenant}
                    onClick={() => setCloneOpen(true)}
                    title={
                      !selectedHasProjects
                        ? "พนักงานขายคนนี้ยังไม่มีโครงการที่ดูแล"
                        : !hasOtherSameTenant
                        ? "ไม่มีพนักงานขายคนอื่นใน tenant เดียวกัน"
                        : "โคลนสิทธิ์โครงการไปยังพนักงานขายคนอื่น"
                    }
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    โคลนสิทธิ์
                  </Button>
                </div>

                {filteredProjects.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {projectSearch
                      ? `ไม่พบโครงการ/ยูนิตที่ค้นหา "${projectSearch}"`
                      : isAdmin
                      ? "บริษัทนี้ยังไม่มีโครงการที่คุณดูแล"
                      : "บริษัทนี้ยังไม่มีโครงการ"}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                    {filteredProjects.map((p) => {
                      const projUnits = unitsByProjectId.get(p.id) || [];
                      const projChecked = isProjectAssigned(selectedSales.id, p.id);
                      const assignedUnits = assignedUnitCountInProject(selectedSales.id, p.id);
                      const isOpen = expanded.has(p.id);
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "rounded-lg border transition-all",
                            projChecked ? "border-chateau/40" : "border-gray-200"
                          )}
                        >
                          {/* PROJECT row */}
                          <div className="flex items-center gap-2 p-3">
                            <input
                              type="checkbox"
                              checked={projChecked}
                              disabled={!canEdit || toggleProject.isPending}
                              onChange={() =>
                                toggleProject.mutate({
                                  salesId: selectedSales.id,
                                  projectId: p.id,
                                  assigned: projChecked,
                                  tenantId: selectedSales.tenant_id,
                                  unitIdsInProject: projUnits.map((u) => u.id),
                                })
                              }
                              className="w-4 h-4 accent-chateau cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                            />
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                              disabled={projUnits.length === 0}
                            >
                              {projUnits.length > 0 ? (
                                isOpen ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                )
                              ) : (
                                <span className="w-4 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">{p.name}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                  {p.type && <span>{p.type}</span>}
                                  {p.developer && (
                                    <>
                                      <span className="text-gray-300">·</span>
                                      <span>{p.developer}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                            {projUnits.length > 0 && (
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                ปิดดีล{" "}
                                <span className="font-semibold text-chateau">{assignedUnits}</span>/
                                {projUnits.length}
                              </span>
                            )}
                            {projChecked && (
                              <span className="text-xs font-medium text-chateau flex-shrink-0">มอบหมายแล้ว</span>
                            )}
                          </div>

                          {/* UNITS (expanded) */}
                          {isOpen && projUnits.length > 0 && (
                            <div className="border-t border-gray-100 px-3 py-2 space-y-1 bg-white/60 rounded-b-lg">
                              <div className="flex items-center justify-between gap-2 pb-1">
                                {!projChecked ? (
                                  <p className="text-[11px] text-amber-600 flex items-center gap-1">
                                    <Home className="w-3 h-3" /> ติ๊กยูนิตจะเปิดสิทธิ์โครงการให้อัตโนมัติ
                                  </p>
                                ) : (
                                  <span />
                                )}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    disabled={!canEdit || bulkUnits.isPending}
                                    onClick={() =>
                                      bulkUnits.mutate({
                                        salesId: selectedSales.id,
                                        tenantId: selectedSales.tenant_id,
                                        projectId: p.id,
                                        unitIds: projUnits.map((x) => x.id),
                                        assign: true,
                                        projectAssigned: projChecked,
                                      })
                                    }
                                    className="text-[11px] text-chateau hover:underline disabled:opacity-40"
                                  >
                                    เลือกยูนิตทั้งหมด
                                  </button>
                                  <span className="text-gray-300 text-[11px]">·</span>
                                  <button
                                    type="button"
                                    disabled={!canEdit || bulkUnits.isPending}
                                    onClick={() =>
                                      bulkUnits.mutate({
                                        salesId: selectedSales.id,
                                        tenantId: selectedSales.tenant_id,
                                        projectId: p.id,
                                        unitIds: projUnits.map((x) => x.id),
                                        assign: false,
                                        projectAssigned: projChecked,
                                      })
                                    }
                                    className="text-[11px] text-gray-500 hover:underline disabled:opacity-40"
                                  >
                                    ล้างยูนิต
                                  </button>
                                </div>
                              </div>
                              {projUnits.map((u) => {
                                const uChecked = isUnitAssigned(selectedSales.id, u.id);
                                return (
                                  <label
                                    key={u.id}
                                    className={cn(
                                      "flex items-center gap-3 p-2 pl-6 rounded-md cursor-pointer transition-all hover:bg-gray-50",
                                      !canEdit && "cursor-not-allowed opacity-90"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={uChecked}
                                      disabled={!canEdit || toggleUnit.isPending}
                                      onChange={() =>
                                        toggleUnit.mutate({
                                          salesId: selectedSales.id,
                                          unitId: u.id,
                                          projectId: p.id,
                                          assigned: uChecked,
                                          tenantId: selectedSales.tenant_id,
                                          projectAssigned: projChecked,
                                          lastUnit:
                                            uChecked &&
                                            assignedUnitCountInProject(selectedSales.id, p.id) === 1,
                                        })
                                      }
                                      className="w-4 h-4 accent-chateau cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                                    />
                                    <span className="font-mono text-sm font-medium text-gray-900">
                                      {u.unit_number}
                                    </span>
                                    <span className="text-sm text-gray-600">{formatPrice(u.price)}</span>
                                    <span
                                      className={cn(
                                        "text-xs px-2 py-0.5 rounded-full font-medium ml-auto",
                                        statusColor(u.status)
                                      )}
                                    >
                                      {statusLabel(u.status)}
                                    </span>
                                    {uChecked && (
                                      <span className="text-xs font-medium text-chateau">รับผิดชอบ</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
        getItemsFor={getProjectItemsForSales}
        getItemName={(id) => projects.find((p) => p.id === id)?.name || id}
        initialSourceId={selectedSales?.id}
        itemLabel="โครงการ"
        roleLabel="พนักงานขาย"
        table="sales_project_assignments"
        userColumn="sales_user_id"
        itemColumn="project_id"
        queryKeyPrefix="permissions"
      />
    </div>
  );
};

export default SalesScopeMatrix;
