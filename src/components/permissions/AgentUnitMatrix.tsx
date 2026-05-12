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
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CloneAssignmentsModal, { CloneUser } from "./CloneAssignmentsModal";

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
  project_name?: string;
  tenant_id: string;
}

interface Assignment {
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

export const AgentUnitMatrix = () => {
  const { userRole, currentTenant } = useSimpleAuth();
  const queryClient = useQueryClient();
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canEdit = isOwner || isAdmin;

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");

  /* Agent users */
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

  /* Units (RLS scopes to current user's access) */
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

  /* Project name map */
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

  /* Agent-unit assignments */
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<Assignment[]>({
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
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  /* Agent sees only units in their tenant (admin's tenant for admin view; same tenant filter) */
  const unitsForSelectedAgent = useMemo(
    () => (selectedAgent ? units.filter((u) => u.tenant_id === selectedAgent.tenant_id) : []),
    [units, selectedAgent]
  );

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return unitsForSelectedAgent;
    return unitsForSelectedAgent.filter(
      (u) =>
        u.unit_number.toLowerCase().includes(q) ||
        (u.project_name || "").toLowerCase().includes(q)
    );
  }, [unitsForSelectedAgent, unitSearch]);

  const isAssigned = (agentId: string, unitId: string) =>
    assignments.some((a) => a.agent_user_id === agentId && a.unit_id === unitId);

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
    assignments.filter((a) => a.agent_user_id === userId).map((a) => a.unit_id);

  const selectedAgentItemCount = selectedAgent ? getItemsForAgent(selectedAgent.id).length : 0;
  const hasOtherSameTenant = !!selectedAgent &&
    agents.some((a) => a.id !== selectedAgent.id && a.tenant_id === selectedAgent.tenant_id);

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
      if (!groups.has(a.tenant_id)) {
        groups.set(a.tenant_id, { tenant_name: a.tenant_name, agents: [] });
      }
      groups.get(a.tenant_id)!.agents.push(a);
    }
    return Array.from(groups.values());
  }, [agents, agentSearch]);

  const getCoverage = (agent: AgentUser) => {
    const tenantUnits = units.filter((u) => u.tenant_id === agent.tenant_id);
    const assignedCount = assignments.filter(
      (a) => a.agent_user_id === agent.id && tenantUnits.some((u) => u.id === a.unit_id)
    ).length;
    return { assigned: assignedCount, total: tenantUnits.length };
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["permissions", "agent-unit-assignments"] }),
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  const bulkAssign = useMutation({
    mutationFn: async (params: { agentId: string; tenantId: string; unitIds: string[]; assign: boolean }) => {
      const { agentId, tenantId, unitIds, assign } = params;
      if (assign) {
        await supabase
          .from("agent_unit_assignments")
          .update({ revoked_at: null })
          .eq("agent_user_id", agentId)
          .in("unit_id", unitIds);
        const rows = unitIds.map((uid) => ({
          agent_user_id: agentId,
          unit_id: uid,
          tenant_id: tenantId,
        }));
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
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ["permissions", "agent-unit-assignments"] });
      toast.success(variables.assign ? "เลือกทั้งหมดเรียบร้อย" : "ล้างทั้งหมดเรียบร้อย");
    },
    onError: (err: any) => toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`),
  });

  const loading = loadingAgents || loadingUnits || loadingProjectNames || loadingAssignments;
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
          ยังไม่มี Agent (นายหน้า) ในระบบ — สร้าง Agent ก่อนค่อยกำหนดสิทธิ์
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
            <p className="text-xs">เฉพาะ Owner / Admin เท่านั้นที่แก้ไขสิทธิ์ Agent ดูแลยูนิตได้</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* LEFT: Agent list */}
        <Card className="h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Agents (นายหน้า)</h3>
              <span className="text-xs text-gray-500">{agents.length} คน</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหา agent..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
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
                            ? "bg-amber-50 border-2 border-amber-500 ring-1 ring-amber-300/30"
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

        {/* RIGHT: Units for selected agent */}
        <Card>
          <CardContent className="p-4">
            {!selectedAgent ? (
              <div className="py-20 text-center text-gray-500">
                <Handshake className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                เลือก Agent ทางซ้ายเพื่อกำหนดยูนิตที่นายหน้าขาย
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedAgent.full_name || selectedAgent.email}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedAgent.tenant_name}
                      <span className="text-gray-300">·</span>
                      <span>
                        ขาย{" "}
                        <span className="font-semibold text-amber-600">
                          {assignments.filter(
                            (a) =>
                              a.agent_user_id === selectedAgent.id &&
                              unitsForSelectedAgent.some((u) => u.id === a.unit_id)
                          ).length}
                        </span>{" "}
                        / {unitsForSelectedAgent.length} ยูนิต
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Agent เป็นนายหน้า — สามารถขาย unit ที่ admin มอบ list ให้ (cross-project ได้)
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
                        agentId: selectedAgent.id,
                        tenantId: selectedAgent.tenant_id,
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
                        agentId: selectedAgent.id,
                        tenantId: selectedAgent.tenant_id,
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
                    disabled={!canEdit || selectedAgentItemCount === 0 || !hasOtherSameTenant}
                    onClick={() => setCloneOpen(true)}
                    title={
                      selectedAgentItemCount === 0
                        ? "Agent คนนี้ยังไม่มียูนิตที่รับผิดชอบ"
                        : !hasOtherSameTenant
                        ? "ไม่มี Agent คนอื่นใน tenant เดียวกัน"
                        : "โคลนสิทธิ์ยูนิตไปยัง Agent คนอื่น"
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
                      : "บริษัทนี้ยังไม่มียูนิต"}
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
                            const checked = isAssigned(selectedAgent.id, u.id);
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
                                      agentId: selectedAgent.id,
                                      unitId: u.id,
                                      assigned: checked,
                                      tenantId: selectedAgent.tenant_id,
                                    })
                                  }
                                  className="w-4 h-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed"
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
                                  <span className="text-xs font-medium text-amber-600">
                                    ขายได้
                                  </span>
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
        getItemsFor={getItemsForAgent}
        getItemName={(id) => {
          const u = units.find((x) => x.id === id);
          if (!u) return id;
          return u.project_name ? `${u.unit_number} · ${u.project_name}` : u.unit_number;
        }}
        initialSourceId={selectedAgent?.id}
        itemLabel="ยูนิต"
        roleLabel="Agent"
        table="agent_unit_assignments"
        userColumn="agent_user_id"
        itemColumn="unit_id"
        queryKeyPrefix="permissions"
      />
    </div>
  );
};
