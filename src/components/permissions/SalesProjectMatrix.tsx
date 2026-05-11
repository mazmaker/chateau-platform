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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface Assignment {
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

export const SalesProjectMatrix = () => {
  const { userRole, currentTenant } = useSimpleAuth();
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canEdit = isOwner || isAdmin;

  const [selectedSalesId, setSelectedSalesId] = useState<string | null>(null);
  const [salesSearch, setSalesSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  /* ───── Fetch sales users ───── */
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

  /* ───── Fetch projects (RLS scopes for admin to their assigned projects) ───── */
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

  /* ───── Fetch sales-project assignments ───── */
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<Assignment[]>({
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

  /* ───── Auto-select first sales on load ───── */
  useEffect(() => {
    if (salesUsers.length > 0 && !selectedSalesId) {
      setSelectedSalesId(salesUsers[0].id);
    }
  }, [salesUsers, selectedSalesId]);

  const selectedSales = useMemo(
    () => salesUsers.find((s) => s.id === selectedSalesId),
    [salesUsers, selectedSalesId]
  );

  /* Projects available for this sales:
     - same tenant as sales
     - RLS already filtered to admin's assigned projects for admin role */
  const projectsForSelectedSales = useMemo(
    () => (selectedSales ? projects.filter((p) => p.tenant_id === selectedSales.tenant_id) : []),
    [projects, selectedSales]
  );

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projectsForSelectedSales;
    return projectsForSelectedSales.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.developer || "").toLowerCase().includes(q) ||
        (p.type || "").toLowerCase().includes(q)
    );
  }, [projectsForSelectedSales, projectSearch]);

  const isAssigned = (salesId: string, projectId: string) =>
    assignments.some((a) => a.sales_user_id === salesId && a.project_id === projectId);

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
    const total = projects.filter((p) => p.tenant_id === sales.tenant_id).length;
    const assigned = assignments.filter(
      (a) =>
        a.sales_user_id === sales.id &&
        projects.some((p) => p.id === a.project_id && p.tenant_id === sales.tenant_id)
    ).length;
    return { assigned, total };
  };

  /* Mutations */
  const toggleOne = useMutation({
    mutationFn: async (params: { salesId: string; projectId: string; assigned: boolean; tenantId: string }) => {
      const { salesId, projectId, assigned, tenantId } = params;
      if (assigned) {
        const { error } = await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .eq("project_id", projectId)
          .is("revoked_at", null);
        if (error) throw error;
      } else {
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
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["permissions", "sales-project-assignments"] }),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  const bulkAssign = useMutation({
    mutationFn: async (params: { salesId: string; tenantId: string; projectIds: string[]; assign: boolean }) => {
      const { salesId, tenantId, projectIds, assign } = params;
      if (assign) {
        await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: null })
          .eq("sales_user_id", salesId)
          .in("project_id", projectIds);
        const rows = projectIds.map((pid) => ({
          sales_user_id: salesId,
          project_id: pid,
          tenant_id: tenantId,
        }));
        const { error } = await supabase
          .from("sales_project_assignments")
          .upsert(rows, { onConflict: "sales_user_id,project_id", ignoreDuplicates: false });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sales_project_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("sales_user_id", salesId)
          .in("project_id", projectIds)
          .is("revoked_at", null);
        if (error) throw error;
      }
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ["permissions", "sales-project-assignments"] });
      toast.success(variables.assign ? "เลือกทั้งหมดเรียบร้อย" : "ล้างทั้งหมดเรียบร้อย");
    },
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  const loading = loadingSales || loadingProjects || loadingAssignments;
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
          ยังไม่มี Sales (พนักงานขาย) ในระบบ — สร้าง Sales ก่อนค่อยกำหนดสิทธิ์
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">โหมดดูอย่างเดียว</p>
            <p className="text-xs">เฉพาะ Owner / Admin เท่านั้นที่แก้ไข Sales × Projects ได้</p>
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
                placeholder="ค้นหา sales / บริษัท..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
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
                          "w-full text-left px-3 py-2.5 rounded-lg transition-all",
                          "flex items-center gap-2.5",
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

        {/* RIGHT: Projects of selected sales */}
        <Card>
          <CardContent className="p-4">
            {!selectedSales ? (
              <div className="py-20 text-center text-gray-500">
                <Briefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                เลือก Sales ทางซ้ายเพื่อจัดการสิทธิ์โครงการ
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
                        ดูแล{" "}
                        <span className="font-semibold text-chateau">
                          {assignments.filter(
                            (a) =>
                              a.sales_user_id === selectedSales.id &&
                              projectsForSelectedSales.some((p) => p.id === a.project_id)
                          ).length}
                        </span>{" "}
                        / {projectsForSelectedSales.length} โครงการ
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหาโครงการ..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || bulkAssign.isPending || filteredProjects.length === 0}
                    onClick={() =>
                      bulkAssign.mutate({
                        salesId: selectedSales.id,
                        tenantId: selectedSales.tenant_id,
                        projectIds: filteredProjects.map((p) => p.id),
                        assign: true,
                      })
                    }
                  >
                    <Check className="w-4 h-4 mr-1" />
                    เลือกทั้งหมด{projectSearch && " (ที่กรอง)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit || bulkAssign.isPending || filteredProjects.length === 0}
                    onClick={() =>
                      bulkAssign.mutate({
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
                </div>

                {filteredProjects.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {projectSearch
                      ? `ไม่พบโครงการที่ค้นหา "${projectSearch}"`
                      : isAdmin
                      ? "บริษัทนี้ยังไม่มีโครงการที่คุณดูแล (เฉพาะที่ admin ได้รับ assigned เท่านั้น)"
                      : "บริษัทนี้ยังไม่มีโครงการ"}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                    {filteredProjects.map((p) => {
                      const checked = isAssigned(selectedSales.id, p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                            checked
                              ? "bg-chateau-50 border border-chateau-100"
                              : "border border-gray-200 hover:bg-gray-50",
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
                                projectId: p.id,
                                assigned: checked,
                                tenantId: selectedSales.tenant_id,
                              })
                            }
                            className="w-4 h-4 accent-chateau cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {p.name}
                            </div>
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
                          {checked && (
                            <span className="text-xs font-medium text-chateau">มอบหมายแล้ว</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
