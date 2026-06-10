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
  Handshake,
  Check,
  X,
  MapPin,
  Inbox,
  Home,
  ChevronRight,
  ChevronDown,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CloneAssignmentsModal, { CloneUser } from "./CloneAssignmentsModal";

/*
 * AgentScopeMatrix — nested "project → units" UI for Agents, consistent with SalesScopeMatrix.
 *
 * Agents are UNIT-LEVEL ONLY (broker scope): there is NO agent_project_assignments table —
 * project visibility is derived from assigned units by RLS. So here the project checkbox is a
 * pure convenience that reflects/controls its units:
 *   - Project checked  ⟺  ≥1 unit in it assigned (derived, no separate row).
 *   - Tick project  -> assign ALL units in it · Untick project -> clear all its units.
 *   - Remove every unit -> project unticks naturally (no "assigned but 0 units" ghost).
 *
 * Only agent_unit_assignments is touched — same insert/revoke patterns as the original.
 */

interface AgentUser {
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
  tenant_id: string;
  project_name: string;
}

interface UnitLink {
  agent_user_id: string;
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

export const AgentScopeMatrix = () => {
  const { userRole, currentTenant } = useSimpleAuth();
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canEdit = isOwner || isAdmin;

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cloneOpen, setCloneOpen] = useState(false);

  /* ───── Agent users ───── */
  const { data: agents = [], isLoading: loadingAgents } = useQuery<AgentUser[]>({
    queryKey: ["permissions", "agents", isOwner ? "all" : currentTenant?.id],
    queryFn: async () => {
      let q = supabase
        .from("users")
        .select("id,email,full_name,tenant_id,tenants(name)")
        .eq("role", "agent")
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

  /* ───── Units (RLS-scoped) + project names ───── */
  const { data: rawUnits = [], isLoading: loadingUnits } = useQuery<any[]>({
    queryKey: ["permissions", "units-for-agent-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,unit_number,project_id,price,status,tenant_id")
        .order("unit_number");
      if (error) throw error;
      return data || [];
    },
  });

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
        tenant_id: u.tenant_id,
        project_name: projectNameMap[u.project_id] || "(unknown project)",
      })),
    [rawUnits, projectNameMap]
  );

  /* ───── Agent-unit assignments ───── */
  const { data: unitLinks = [], isLoading: loadingLinks } = useQuery<UnitLink[]>({
    queryKey: ["permissions", "agent-unit-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_unit_assignments")
        .select("agent_user_id,unit_id")
        .is("revoked_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) setSelectedAgentId(agents[0].id);
  }, [agents, selectedAgentId]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  const unitsForSelectedAgent = useMemo(
    () => (selectedAgent ? units.filter((u) => u.tenant_id === selectedAgent.tenant_id) : []),
    [units, selectedAgent]
  );

  /* Group units by project (id → {name, units}) */
  const projectGroups = useMemo(() => {
    const groups = new Map<string, { project_id: string; project_name: string; units: Unit[] }>();
    for (const u of unitsForSelectedAgent) {
      if (!groups.has(u.project_id)) {
        groups.set(u.project_id, { project_id: u.project_id, project_name: u.project_name, units: [] });
      }
      groups.get(u.project_id)!.units.push(u);
    }
    return Array.from(groups.values()).sort((a, b) => a.project_name.localeCompare(b.project_name));
  }, [unitsForSelectedAgent]);

  const filteredGroups = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projectGroups;
    return projectGroups.filter(
      (g) =>
        g.project_name.toLowerCase().includes(q) ||
        g.units.some((u) => u.unit_number.toLowerCase().includes(q))
    );
  }, [projectGroups, projectSearch]);

  const isUnitAssigned = (agentId: string, unitId: string) =>
    unitLinks.some((l) => l.agent_user_id === agentId && l.unit_id === unitId);
  const assignedUnitCountInProject = (agentId: string, projUnits: Unit[]) =>
    projUnits.filter((u) => isUnitAssigned(agentId, u.id)).length;

  /* Group agents by tenant */
  const agentsByTenant = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    const filtered = agents.filter(
      (a) =>
        !q ||
        a.email.toLowerCase().includes(q) ||
        (a.full_name || "").toLowerCase().includes(q) ||
        a.tenant_name.toLowerCase().includes(q)
    );
    const groups = new Map<string, { tenant_name: string; agents: AgentUser[] }>();
    for (const a of filtered) {
      if (!groups.has(a.tenant_id)) groups.set(a.tenant_id, { tenant_name: a.tenant_name, agents: [] });
      groups.get(a.tenant_id)!.agents.push(a);
    }
    return Array.from(groups.values());
  }, [agents, agentSearch]);

  const getCoverage = (agent: AgentUser) => {
    const tenantUnits = units.filter((u) => u.tenant_id === agent.tenant_id);
    const assigned = unitLinks.filter(
      (l) => l.agent_user_id === agent.id && tenantUnits.some((u) => u.id === l.unit_id)
    ).length;
    return { assigned, total: tenantUnits.length };
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["permissions", "agent-unit-assignments"] });

  /* ───── Single unit toggle ───── */
  const toggleUnit = useMutation({
    mutationFn: async (params: { agentId: string; unitId: string; assigned: boolean; tenantId: string }) => {
      const { agentId, unitId, assigned, tenantId } = params;
      if (assigned) {
        const { error } = await supabase
          .from("agent_unit_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("agent_user_id", agentId)
          .eq("unit_id", unitId)
          .is("revoked_at", null);
        if (error) throw error;
      } else {
        const { error: updErr } = await supabase
          .from("agent_unit_assignments")
          .update({ revoked_at: null })
          .eq("agent_user_id", agentId)
          .eq("unit_id", unitId);
        if (updErr) throw updErr;
        const { error: insErr } = await supabase
          .from("agent_unit_assignments")
          .insert({ agent_user_id: agentId, unit_id: unitId, tenant_id: tenantId });
        if (insErr && (insErr as any).code !== "23505") throw insErr;
      }
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  /* ───── Bulk units (project checkbox / per-project bulk / select-all) ───── */
  const bulkUnits = useMutation({
    mutationFn: async (params: { agentId: string; tenantId: string; unitIds: string[]; assign: boolean }) => {
      const { agentId, tenantId, unitIds, assign } = params;
      if (unitIds.length === 0) return;
      if (assign) {
        await supabase
          .from("agent_unit_assignments")
          .update({ revoked_at: null })
          .eq("agent_user_id", agentId)
          .in("unit_id", unitIds);
        const rows = unitIds.map((uid) => ({ agent_user_id: agentId, unit_id: uid, tenant_id: tenantId }));
        const { error } = await supabase
          .from("agent_unit_assignments")
          .upsert(rows, { onConflict: "agent_user_id,unit_id", ignoreDuplicates: false });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_unit_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("agent_user_id", agentId)
          .in("unit_id", unitIds)
          .is("revoked_at", null);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  /* ───── Clone helpers ───── */
  const cloneAllUsers: CloneUser[] = useMemo(
    () =>
      agents.map((a) => ({
        id: a.id,
        name: a.full_name || a.email,
        email: a.email,
        tenantId: a.tenant_id,
        tenantName: a.tenant_name,
        subtitle: a.email,
      })),
    [agents]
  );
  const getItemsForAgent = (userId: string) =>
    unitLinks.filter((l) => l.agent_user_id === userId).map((l) => l.unit_id);
  const selectedHasUnits = selectedAgent ? getItemsForAgent(selectedAgent.id).length > 0 : false;
  const hasOtherSameTenant =
    !!selectedAgent && agents.some((a) => a.id !== selectedAgent.id && a.tenant_id === selectedAgent.tenant_id);

  const toggleExpand = (projectId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });

  const loading = loadingAgents || loadingUnits || loadingProjectNames || loadingLinks;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center text-gray-500">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          ยังไม่มีนายหน้า (Agent) ในระบบ — สร้างนายหน้าก่อนค่อยกำหนดสิทธิ์
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

  const totalAssigned = selectedAgent
    ? unitsForSelectedAgent.filter((u) => isUnitAssigned(selectedAgent.id, u.id)).length
    : 0;

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">โหมดดูอย่างเดียว</p>
            <p className="text-xs">เฉพาะเจ้าของแพลตฟอร์ม / ผู้ดูแลบริษัทเท่านั้นที่แก้ไขสิทธิ์นายหน้าได้</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* LEFT: Agent list */}
        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">นายหน้า (Agent)</h3>
              <span className="text-xs text-gray-500">{agents.length} คน</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหานายหน้า / บริษัท..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {agentsByTenant.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">ไม่พบรายการที่ค้นหา</p>
              )}
              {agentsByTenant.map((group) => (
                <div key={group.tenant_name} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 px-1 pt-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {group.tenant_name}
                    <span className="text-gray-400">({group.agents.length})</span>
                  </div>
                  {group.agents.map((agent) => {
                    const { assigned, total } = getCoverage(agent);
                    const isSelected = selectedAgentId === agent.id;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5",
                          isSelected
                            ? "border-2 border-amber-500 ring-1 ring-amber-300/30"
                            : "border-2 border-transparent hover:bg-gray-50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600"
                          )}
                        >
                          <Handshake className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {agent.full_name || agent.email}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{agent.email}</div>
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
            {!selectedAgent ? (
              <div className="py-20 text-center text-gray-500">
                <Handshake className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                เลือกนายหน้าทางซ้ายเพื่อกำหนดยูนิตที่ดูแล
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedAgent.full_name || selectedAgent.email}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedAgent.tenant_name}
                      <span className="text-gray-300">·</span>
                      <span>
                        ขาย <span className="font-semibold text-amber-600">{totalAssigned}</span> /{" "}
                        {unitsForSelectedAgent.length} ยูนิต
                      </span>
                    </div>
                  </div>
                </div>

                {/* legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> ติ๊กโครงการ = มอบทุกยูนิตในโครงการ
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Home className="w-3 h-3" /> ติ๊กยูนิต = มอบเฉพาะบางยูนิต · เอาออกจนหมด = โครงการหลุดเอง
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
                    disabled={!canEdit || bulkUnits.isPending || filteredGroups.length === 0}
                    onClick={() =>
                      bulkUnits.mutate({
                        agentId: selectedAgent.id,
                        tenantId: selectedAgent.tenant_id,
                        unitIds: filteredGroups.flatMap((g) => g.units.map((u) => u.id)),
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
                    disabled={!canEdit || bulkUnits.isPending || filteredGroups.length === 0}
                    onClick={() =>
                      bulkUnits.mutate({
                        agentId: selectedAgent.id,
                        tenantId: selectedAgent.tenant_id,
                        unitIds: filteredGroups.flatMap((g) => g.units.map((u) => u.id)),
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
                    disabled={!canEdit || !selectedHasUnits || !hasOtherSameTenant}
                    onClick={() => setCloneOpen(true)}
                    title={
                      !selectedHasUnits
                        ? "นายหน้าคนนี้ยังไม่มียูนิตที่ขาย"
                        : !hasOtherSameTenant
                        ? "ไม่มีนายหน้าคนอื่นใน tenant เดียวกัน"
                        : "โคลนสิทธิ์ยูนิตไปยังนายหน้าคนอื่น"
                    }
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    โคลนสิทธิ์
                  </Button>
                </div>

                {filteredGroups.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 text-sm">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {projectSearch ? `ไม่พบโครงการ/ยูนิตที่ค้นหา "${projectSearch}"` : "บริษัทนี้ยังไม่มียูนิต"}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                    {filteredGroups.map((g) => {
                      const assignedCount = assignedUnitCountInProject(selectedAgent.id, g.units);
                      const projChecked = assignedCount > 0;
                      const isOpen = expanded.has(g.project_id);
                      return (
                        <div
                          key={g.project_id}
                          className={cn(
                            "rounded-lg border transition-all",
                            projChecked ? "border-amber-400/50" : "border-gray-200"
                          )}
                        >
                          {/* PROJECT row */}
                          <div className="flex items-center gap-2 p-3">
                            <input
                              type="checkbox"
                              checked={projChecked}
                              disabled={!canEdit || bulkUnits.isPending}
                              onChange={() =>
                                bulkUnits.mutate({
                                  agentId: selectedAgent.id,
                                  tenantId: selectedAgent.tenant_id,
                                  unitIds: g.units.map((u) => u.id),
                                  assign: !projChecked,
                                })
                              }
                              className="w-4 h-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                            />
                            <button
                              type="button"
                              onClick={() => toggleExpand(g.project_id)}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            >
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 truncate">{g.project_name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{g.units.length} ยูนิต</div>
                              </div>
                            </button>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ขาย <span className="font-semibold text-amber-600">{assignedCount}</span>/{g.units.length}
                            </span>
                            {projChecked && (
                              <span className="text-xs font-medium text-amber-600 flex-shrink-0">มอบหมายแล้ว</span>
                            )}
                          </div>

                          {/* UNITS (expanded) */}
                          {isOpen && (
                            <div className="border-t border-gray-100 px-3 py-2 space-y-1 bg-white/60 rounded-b-lg">
                              <div className="flex items-center justify-end gap-2 pb-1">
                                <button
                                  type="button"
                                  disabled={!canEdit || bulkUnits.isPending}
                                  onClick={() =>
                                    bulkUnits.mutate({
                                      agentId: selectedAgent.id,
                                      tenantId: selectedAgent.tenant_id,
                                      unitIds: g.units.map((u) => u.id),
                                      assign: true,
                                    })
                                  }
                                  className="text-[11px] text-amber-600 hover:underline disabled:opacity-40"
                                >
                                  เลือกยูนิตทั้งหมด
                                </button>
                                <span className="text-gray-300 text-[11px]">·</span>
                                <button
                                  type="button"
                                  disabled={!canEdit || bulkUnits.isPending}
                                  onClick={() =>
                                    bulkUnits.mutate({
                                      agentId: selectedAgent.id,
                                      tenantId: selectedAgent.tenant_id,
                                      unitIds: g.units.map((u) => u.id),
                                      assign: false,
                                    })
                                  }
                                  className="text-[11px] text-gray-500 hover:underline disabled:opacity-40"
                                >
                                  ล้างยูนิต
                                </button>
                              </div>
                              {g.units.map((u) => {
                                const uChecked = isUnitAssigned(selectedAgent.id, u.id);
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
                                          agentId: selectedAgent.id,
                                          unitId: u.id,
                                          assigned: uChecked,
                                          tenantId: selectedAgent.tenant_id,
                                        })
                                      }
                                      className="w-4 h-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
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
                                      <span className="text-xs font-medium text-amber-600">ขายได้</span>
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
        getItemsFor={getItemsForAgent}
        getItemName={(id) => {
          const u = units.find((x) => x.id === id);
          if (!u) return id;
          return `${u.unit_number} · ${u.project_name}`;
        }}
        initialSourceId={selectedAgent?.id}
        itemLabel="ยูนิต"
        roleLabel="นายหน้า"
        table="agent_unit_assignments"
        userColumn="agent_user_id"
        itemColumn="unit_id"
        queryKeyPrefix="permissions"
      />
    </div>
  );
};

export default AgentScopeMatrix;
