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
  User as UserIcon,
  Check,
  X,
  MapPin,
  Inbox,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CloneAssignmentsModal, { CloneUser } from "./CloneAssignmentsModal";

interface AdminUser {
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
  admin_user_id: string;
  project_id: string;
}

/* =================== Coverage badge =================== */
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

/* =================== Main component =================== */
export const AdminProjectMatrix = () => {
  const { userRole, currentTenant } = useSimpleAuth();
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";

  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);

  /* ───── Fetch admins (with tenant name) ───── */
  const { data: admins = [], isLoading: loadingAdmins } = useQuery<AdminUser[]>({
    queryKey: ["permissions", "admins", isOwner ? "all" : currentTenant?.id],
    queryFn: async () => {
      let q = supabase
        .from("users")
        .select("id,email,full_name,tenant_id,tenants(name)")
        .eq("role", "admin")
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

  /* ───── Fetch ALL projects (scoped by current user role) ───── */
  const { data: projects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["permissions", "projects", isOwner ? "all" : currentTenant?.id],
    queryFn: async () => {
      let q = supabase
        .from("properties")
        .select("id,name,tenant_id,developer,type")
        .order("name");
      if (!isOwner && currentTenant?.id) q = q.eq("tenant_id", currentTenant.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  /* ───── Fetch active assignments ───── */
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<Assignment[]>({
    queryKey: ["permissions", "admin-project-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_project_assignments")
        .select("admin_user_id,project_id")
        .is("revoked_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  /* ───── Auto-select first admin on load ───── */
  useEffect(() => {
    if (admins.length > 0 && !selectedAdminId) {
      setSelectedAdminId(admins[0].id);
    }
  }, [admins, selectedAdminId]);

  /* ───── Derived data ───── */
  const selectedAdmin = useMemo(
    () => admins.find((a) => a.id === selectedAdminId),
    [admins, selectedAdminId]
  );

  const projectsInSelectedTenant = useMemo(
    () => (selectedAdmin ? projects.filter((p) => p.tenant_id === selectedAdmin.tenant_id) : []),
    [projects, selectedAdmin]
  );

  /* ───── Clone helpers ───── */
  const cloneAllUsers: CloneUser[] = useMemo(
    () =>
      admins.map((a) => ({
        id: a.id,
        name: a.full_name || a.email,
        email: a.email,
        tenantId: a.tenant_id,
        tenantName: a.tenant_name,
        subtitle: a.email,
      })),
    [admins]
  );

  const getItemsForAdmin = (userId: string) =>
    assignments.filter((a) => a.admin_user_id === userId).map((a) => a.project_id);

  const selectedAdminItemCount = selectedAdmin ? getItemsForAdmin(selectedAdmin.id).length : 0;
  const hasOtherSameTenant = !!selectedAdmin &&
    admins.some((a) => a.id !== selectedAdmin.id && a.tenant_id === selectedAdmin.tenant_id);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projectsInSelectedTenant;
    return projectsInSelectedTenant.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.developer || "").toLowerCase().includes(q) ||
        (p.type || "").toLowerCase().includes(q)
    );
  }, [projectsInSelectedTenant, projectSearch]);

  const isAssigned = (adminId: string, projectId: string) =>
    assignments.some((a) => a.admin_user_id === adminId && a.project_id === projectId);

  /* ───── Group admins by tenant ───── */
  const adminsByTenant = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    const filtered = admins.filter(
      (a) =>
        !q ||
        a.email.toLowerCase().includes(q) ||
        (a.full_name || "").toLowerCase().includes(q) ||
        a.tenant_name.toLowerCase().includes(q)
    );
    const groups = new Map<string, { tenant_name: string; admins: AdminUser[] }>();
    for (const a of filtered) {
      if (!groups.has(a.tenant_id)) {
        groups.set(a.tenant_id, { tenant_name: a.tenant_name, admins: [] });
      }
      groups.get(a.tenant_id)!.admins.push(a);
    }
    return Array.from(groups.values());
  }, [admins, adminSearch]);

  const getCoverage = (admin: AdminUser) => {
    const total = projects.filter((p) => p.tenant_id === admin.tenant_id).length;
    const assigned = assignments.filter(
      (a) => a.admin_user_id === admin.id && projects.some((p) => p.id === a.project_id && p.tenant_id === admin.tenant_id)
    ).length;
    return { assigned, total };
  };

  /* ───── Mutations ───── */
  const toggleOne = useMutation({
    mutationFn: async (params: { adminId: string; projectId: string; assigned: boolean; tenantId: string }) => {
      const { adminId, projectId, assigned, tenantId } = params;
      if (assigned) {
        const { error } = await supabase
          .from("admin_project_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("admin_user_id", adminId)
          .eq("project_id", projectId)
          .is("revoked_at", null);
        if (error) throw error;
      } else {
        const { error: updErr } = await supabase
          .from("admin_project_assignments")
          .update({ revoked_at: null })
          .eq("admin_user_id", adminId)
          .eq("project_id", projectId);
        if (updErr) throw updErr;

        const { error: insErr } = await supabase
          .from("admin_project_assignments")
          .insert({ admin_user_id: adminId, project_id: projectId, tenant_id: tenantId });
        if (insErr && (insErr as any).code !== "23505") throw insErr;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["permissions", "admin-project-assignments"] }),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  const bulkAssign = useMutation({
    mutationFn: async (params: { adminId: string; tenantId: string; projectIds: string[]; assign: boolean }) => {
      const { adminId, tenantId, projectIds, assign } = params;
      if (assign) {
        // Un-revoke existing + insert missing
        await supabase
          .from("admin_project_assignments")
          .update({ revoked_at: null })
          .eq("admin_user_id", adminId)
          .in("project_id", projectIds);
        const rows = projectIds.map((pid) => ({
          admin_user_id: adminId,
          project_id: pid,
          tenant_id: tenantId,
        }));
        const { error } = await supabase.from("admin_project_assignments").upsert(rows, {
          onConflict: "admin_user_id,project_id",
          ignoreDuplicates: false,
        });
        if (error) throw error;
      } else {
        // Revoke all
        const { error } = await supabase
          .from("admin_project_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("admin_user_id", adminId)
          .in("project_id", projectIds)
          .is("revoked_at", null);
        if (error) throw error;
      }
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ["permissions", "admin-project-assignments"] });
      toast.success(variables.assign ? "เลือกทั้งหมดเรียบร้อย" : "ล้างทั้งหมดเรียบร้อย");
    },
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  /* ───── Render ───── */
  const loading = loadingAdmins || loadingProjects || loadingAssignments;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (admins.length === 0) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center text-gray-500">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          ยังไม่มี admin ในระบบ — สร้าง admin ก่อนค่อยกำหนดสิทธิ์
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Read-only notice for non-Owner */}
      {!isOwner && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">โหมดดูอย่างเดียว</p>
            <p className="text-xs">เฉพาะ Owner เท่านั้นที่แก้ไขสิทธิ์ Admin ดูแลโครงการได้</p>
          </div>
        </div>
      )}

      {/* Master-Detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* ─────────── LEFT: Admins ─────────── */}
        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Admins</h3>
              <span className="text-xs text-gray-500">{admins.length} คน</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหา admin / บริษัท..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {adminsByTenant.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">ไม่พบรายการที่ค้นหา</p>
              )}
              {adminsByTenant.map((group) => (
                <div key={group.tenant_name} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 px-1 pt-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {group.tenant_name}
                    <span className="text-gray-400">({group.admins.length})</span>
                  </div>
                  {group.admins.map((admin) => {
                    const { assigned, total } = getCoverage(admin);
                    const isSelected = selectedAdminId === admin.id;
                    return (
                      <button
                        key={admin.id}
                        onClick={() => setSelectedAdminId(admin.id)}
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
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {admin.full_name || admin.email}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{admin.email}</div>
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

        {/* ─────────── RIGHT: Projects of selected admin ─────────── */}
        <Card>
          <CardContent className="p-4">
            {!selectedAdmin ? (
              <div className="py-20 text-center text-gray-500">
                <UserIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                เลือก Admin ทางซ้ายเพื่อจัดการสิทธิ์
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedAdmin.full_name || selectedAdmin.email}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedAdmin.tenant_name}
                      <span className="text-gray-300">·</span>
                      <span>
                        ดูแล{" "}
                        <span className="font-semibold text-chateau">
                          {assignments.filter(
                            (a) =>
                              a.admin_user_id === selectedAdmin.id &&
                              projectsInSelectedTenant.some((p) => p.id === a.project_id)
                          ).length}
                        </span>{" "}
                        / {projectsInSelectedTenant.length} โครงการ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action bar */}
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
                    disabled={!isOwner || bulkAssign.isPending || filteredProjects.length === 0}
                    onClick={() =>
                      bulkAssign.mutate({
                        adminId: selectedAdmin.id,
                        tenantId: selectedAdmin.tenant_id,
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
                    disabled={!isOwner || bulkAssign.isPending || filteredProjects.length === 0}
                    onClick={() =>
                      bulkAssign.mutate({
                        adminId: selectedAdmin.id,
                        tenantId: selectedAdmin.tenant_id,
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
                    disabled={!isOwner || selectedAdminItemCount === 0 || !hasOtherSameTenant}
                    onClick={() => setCloneOpen(true)}
                    title={
                      selectedAdminItemCount === 0
                        ? "ผู้ใช้นี้ไม่มีโครงการที่ดูแล"
                        : !hasOtherSameTenant
                        ? "ไม่มี admin คนอื่นใน tenant เดียวกัน"
                        : "โคลนสิทธิ์ไปยัง admin คนอื่น"
                    }
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    โคลนสิทธิ์
                  </Button>
                </div>

                {/* Project list */}
                {filteredProjects.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {projectSearch
                      ? `ไม่พบโครงการที่ค้นหา "${projectSearch}"`
                      : "บริษัทนี้ยังไม่มีโครงการ"}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                    {filteredProjects.map((p) => {
                      const checked = isAssigned(selectedAdmin.id, p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border border-gray-200 hover:bg-gray-50",
                            !isOwner && "cursor-not-allowed opacity-90"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!isOwner || toggleOne.isPending}
                            onChange={() =>
                              toggleOne.mutate({
                                adminId: selectedAdmin.id,
                                projectId: p.id,
                                assigned: checked,
                                tenantId: selectedAdmin.tenant_id,
                              })
                            }
                            className="w-4 h-4 accent-chateau cursor-pointer disabled:cursor-not-allowed"
                          />
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

      <CloneAssignmentsModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        allUsers={cloneAllUsers}
        getItemsFor={getItemsForAdmin}
        getItemName={(id) => projects.find((p) => p.id === id)?.name || id}
        initialSourceId={selectedAdmin?.id}
        itemLabel="โครงการ"
        roleLabel="Admin"
        table="admin_project_assignments"
        userColumn="admin_user_id"
        itemColumn="project_id"
        queryKeyPrefix="permissions"
      />
    </div>
  );
};
