import { useState, useEffect, useCallback } from "react";
import { Search, Plus, User, Shield, ToggleLeft, ToggleRight, Trash2, Edit, UserPlus, Paperclip, Key, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { supabase } from "@/lib/supabase";
import InviteUserModal from "./InviteUserModal";
import EditUserModal from "./EditUserModal";
import UserAccountManagement from "./UserAccountManagement";
import { toast } from "sonner";

type UserRole = 'owner' | 'admin' | 'sales' | 'agent' | 'customer';

interface UserData {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole;
  tenant_id: string;
  tenant_name?: string;
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string;
  password_set_at?: string;
}

interface Tenant {
  id: string;
  name: string;
}

const UserManagementContent = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAccountManagementModal, setShowAccountManagementModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<'name' | 'role' | 'status' | 'joined' | 'lastseen'>('joined');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { currentTenant, userRole, user, authChecked } = useSimpleAuth();

  // ADMIN can only see SALES users in their tenant
  const isAdmin = userRole === 'admin';
  const isOwner = userRole === 'owner';

  useEffect(() => {
    // Wait for auth to be fully loaded before fetching data
    if (!authChecked) {
      return;
    }

    if (isOwner) {
      fetchTenants().then((tenantsData) => {
        fetchUsers(tenantsData);
      });
    } else {
      fetchUsers();
    }
  }, [currentTenant?.id, isAdmin, isOwner, authChecked]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter, tenantFilter]);

  // Reset to first page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter, tenantFilter]);

  const fetchTenants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, is_platform')
        .order('name');

      if (error) throw error;
      setTenants((data as Tenant[]) || []);
      return data; // Return data for chaining
    } catch (error) {
      console.error('❌ Error fetching tenants:', error);
      return [];
    }
  }, []);

  const fetchUsers = useCallback(async (tenantsData?: Tenant[]) => {
    // Owner can fetch users without currentTenant, others need it
    if (!isOwner && !currentTenant) {
      return;
    }

    try {
      // Fetch from users table
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      // ADMIN sees SALES + AGENT users in their tenant
      if (isAdmin && currentTenant) {
        query = query.eq('tenant_id', currentTenant.id).in('role', ['sales', 'agent']);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Use provided tenants data or fallback to state
      const availableTenants = tenantsData || tenants;

      // For Owner, enrich with tenant names
      let enrichedData = (data as any[]) || [];
      if (isOwner) {
        enrichedData = enrichedData.map((user: any) => ({
          ...user,
          tenant_name: availableTenants.find(t => t.id === user.tenant_id)?.name || '-'
        }));
      }

      // Owner-only: enrich with the REAL last-login from auth.users via SECURITY DEFINER RPC.
      // public.users.last_sign_in_at is stale/seed-only (Supabase Auth never syncs it) —
      // never trust that column for adoption/churn. RPC is guarded by is_owner().
      if (isOwner) {
        const { data: loginRows, error: loginErr } = await (supabase as any).rpc('owner_users_last_sign_in');
        if (loginErr) {
          console.error('❌ Error fetching last sign-in:', loginErr);
        } else if (loginRows) {
          const loginMap = new Map<string, string | null>();
          (loginRows as { id: string; last_sign_in_at: string | null }[]).forEach((r) => loginMap.set(r.id, r.last_sign_in_at));
          enrichedData = enrichedData.map((u: any) => ({
            ...u,
            last_sign_in_at: loginMap.get(u.id) ?? null,
          }));
        }
      }

      setUsers(enrichedData as UserData[]);
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  }, [isOwner, isAdmin, currentTenant?.id, tenants]);

  const filterUsers = () => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (isOwner && user.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(user =>
        statusFilter === "active" ? user.is_active : !user.is_active
      );
    }

    // Tenant filter (only for Owner)
    if (isOwner && tenantFilter !== "all") {
      filtered = filtered.filter(user => user.tenant_id === tenantFilter);
    }

    setFilteredUsers(filtered);
  };

  // Sort
  const toggleSort = (key: 'name' | 'role' | 'status' | 'joined' | 'lastseen') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const roleOrder: Record<UserRole, number> = { owner: 0, admin: 1, sales: 2, agent: 3, customer: 4 };
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') {
      return (a.full_name || a.email).localeCompare(b.full_name || b.email, 'th') * dir;
    }
    if (sortKey === 'role') {
      return (roleOrder[a.role] - roleOrder[b.role]) * dir;
    }
    if (sortKey === 'status') {
      return ((a.is_active ? 1 : 0) - (b.is_active ? 1 : 0)) * dir;
    }
    if (sortKey === 'lastseen') {
      const ta = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
      const tb = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
      return (ta - tb) * dir;
    }
    // joined → created_at
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedUsers = sortedUsers.slice(pageStart, pageStart + pageSize);

  const SortIcon = ({ col }: { col: 'name' | 'role' | 'status' | 'joined' | 'lastseen' }) => (
    sortKey === col
      ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
      : <ArrowUpDown className="w-3 h-3 text-gray-300" />
  );

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, is_active: !currentStatus } : user
      ));

      toast.success(!currentStatus ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับบัญชีสำเร็จ');
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('ไม่สามารถอัปเดตสถานะผู้ใช้ได้');
    }
  };

  // Show confirmation dialog
  const confirmDeleteUser = (user: UserData) => {
    setDeletingUser(user);
    setShowDeleteDialog(true);
  };

  // Actually delete the user
  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      // Get session for Edge Function authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      // Log activity before deleting
      await supabase.rpc('log_activity', {
        p_tenant_id: deletingUser.tenant_id,
        p_user_id: user?.id,
        p_activity_type: 'user_deleted',
        p_description: `ลบผู้ใช้: ${deletingUser.full_name || deletingUser.email} (${deletingUser.email})`,
        p_metadata: {
          user_id: deletingUser.id,
          email: deletingUser.email,
          role: deletingUser.role,
          full_name: deletingUser.full_name
        }
      });

      // Call Edge Function to delete user from both auth.users and public.users
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/delete-user`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: deletingUser.id
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete user');
      }

      // Update local state
      setUsers(prev => prev.filter(user => user.id !== deletingUser.id));
      toast.success('ลบบัญชีผู้ใช้สำเร็จ');

      // Close dialog and reset state
      setShowDeleteDialog(false);
      setDeletingUser(null);
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error('ไม่สามารถลบผู้ใช้ได้');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    // Tiered hierarchy — owner = brand red strong, admin = brand red light, sales = neutral
    const config = {
      owner:    { label: 'เจ้าของแพลตฟอร์ม', icon: '', className: 'bg-chateau text-white border border-chateau' },
      admin:    { label: 'ผู้ดูแลบริษัท',     icon: '', className: 'bg-chateau-50 text-chateau-700 border border-chateau-100' },
      sales:    { label: 'พนักงานขาย',       icon: '', className: 'bg-gray-50 text-gray-700 border border-gray-200' },
      agent:    { label: 'นายหน้า',           icon: '', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
      customer: { label: 'ลูกค้า',            icon: '', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
    };
    const c = config[role] || { label: role, icon: '', className: 'bg-gray-50 text-gray-700 border border-gray-200' };
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${c.className}`}>
        {c.icon} {c.label}
      </span>
    );
  };

  // Compact relative "last seen" for the table — churn/adoption signal.
  const formatLastSeen = (dateString?: string | null) => {
    if (!dateString) return 'ยังไม่เคย';
    const date = new Date(dateString);
    const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'วันนี้';
    if (diffDays === 1) return 'เมื่อวาน';
    if (diffDays <= 30) return `${diffDays} วันที่แล้ว`;
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getUserInitials = (fullName?: string, email?: string) => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return email?.split('@')[0].toUpperCase().slice(0, 2) || 'U';
  };

  // Check if user has temporary password (password_set_at is null)
  const hasTemporaryPassword = (user: UserData) => {
    return user.password_set_at === null || user.password_set_at === undefined;
  };

  const getPasswordStatus = (user: UserData) => {
    if (hasTemporaryPassword(user)) {
      // Brand red — needs action
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-chateau-50 text-chateau-700 border border-chateau-100">
          รหัสผ่านชั่วคราว
        </span>
      );
    }
    // Neutral — done state
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-gray-50 text-gray-600 border border-gray-200">
        รหัสผ่านถาวร
      </span>
    );
  };

  // Show loading while auth is checking or data is loading
  if (!authChecked || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">
            {!authChecked ? 'กำลังตรวจสอบสิทธิ์...' : 'กำลังโหลดข้อมูลผู้ใช้...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="bg-white border-gray-200 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isAdmin ? 'จัดการผู้ใช้งาน' : 'จัดการผู้ใช้'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {isAdmin
                    ? 'จัดการพนักงานขายและนายหน้าในบริษัทของคุณ'
                    : 'จัดการผู้ใช้และสิทธิ์ในระบบของคุณ'
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white shadow-lg"
              >
                <UserPlus className="w-4 h-4" />
                {isAdmin ? 'เพิ่มสมาชิกทีม' : 'เพิ่มผู้ใช้ใหม่'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3 lg:grid-cols-6'} gap-4`}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">{isAdmin ? 'สมาชิกทั้งหมด' : 'ทั้งหมด'}</p>
                <p className="text-xl font-semibold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">ใช้งานอยู่</p>
                <p className="text-xl font-semibold">{users.filter(u => u.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin-only: split sales vs agent counts */}
        {isAdmin && (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">พนักงานขาย</p>
                    <p className="text-xl font-semibold">{users.filter(u => u.role === 'sales').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <User className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">นายหน้า</p>
                    <p className="text-xl font-semibold">{users.filter(u => u.role === 'agent').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Only show owner/admin stats for OWNER users */}
        {!isAdmin && (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <User className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">เจ้าของแพลตฟอร์ม</p>
                    <p className="text-xl font-semibold">{users.filter(u => u.role === 'owner').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">ผู้ดูแลบริษัท</p>
                    <p className="text-xl font-semibold">{users.filter(u => u.role === 'admin').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">พนักงานขาย</p>
                    <p className="text-xl font-semibold">{users.filter(u => u.role === 'sales').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <User className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">นายหน้า</p>
                    <p className="text-xl font-semibold">{users.filter(u => u.role === 'agent').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหาตามชื่อหรืออีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tenant filter - Only for OWNER users */}
            {isOwner && (
              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ทุกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกบริษัท</SelectItem>
                  {tenants.filter((t) => !(t as any).is_platform).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Role filter — Owner sees all roles, Admin sees only sales/agent */}
            <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="ทุกตำแหน่ง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกตำแหน่ง</SelectItem>
                {!isAdmin && (
                  <>
                    <SelectItem value="owner">เจ้าของแพลตฟอร์ม</SelectItem>
                    <SelectItem value="admin">ผู้ดูแลบริษัท</SelectItem>
                  </>
                )}
                <SelectItem value="sales">พนักงานขาย</SelectItem>
                <SelectItem value="agent">นายหน้า</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="active">ใช้งานอยู่</SelectItem>
                <SelectItem value="inactive">ระงับ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="inline-flex items-center gap-1">ผู้ใช้<SortIcon col="name" /></span>
                  </th>
                  {isOwner && <th className="text-left py-3 px-4 font-semibold text-gray-700">บริษัท</th>}
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer select-none"
                    onClick={() => toggleSort('role')}
                  >
                    <span className="inline-flex items-center gap-1">ตำแหน่ง (Role)<SortIcon col="role" /></span>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer select-none"
                    onClick={() => toggleSort('status')}
                  >
                    <span className="inline-flex items-center gap-1">สถานะ<SortIcon col="status" /></span>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">รหัสผ่าน</th>
                  {isOwner && (
                    <th
                      className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer select-none"
                      onClick={() => toggleSort('lastseen')}
                    >
                      <span className="inline-flex items-center gap-1">เข้าใช้ล่าสุด<SortIcon col="lastseen" /></span>
                    </th>
                  )}
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer select-none"
                    onClick={() => toggleSort('joined')}
                  >
                    <span className="inline-flex items-center gap-1">เข้าร่วมเมื่อ<SortIcon col="joined" /></span>
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name || user.email} className="w-full h-full object-cover" />
                          ) : (
                            <AvatarFallback>
                              {getUserInitials(user.full_name, user.email)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.full_name || user.email}
                          </p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    {isOwner && (
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {user.tenant_name || '-'}
                      </td>
                    )}
                    <td className="py-3 px-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md ${
                        user.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-chateau-50 text-chateau-700 border border-chateau-100'
                      }`}>
                        {user.is_active ? "ใช้งานอยู่" : "ระงับ"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getPasswordStatus(user)}
                    </td>
                    {isOwner && (
                      <td className="py-3 px-4 text-sm">
                        {user.last_sign_in_at ? (
                          <span className="text-gray-600">{formatLastSeen(user.last_sign_in_at)}</span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            ยังไม่เคย
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('th-TH')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          disabled={user.role === 'owner'}
                          className="p-1"
                          title={user.is_active ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'}
                        >
                          {user.is_active ? (
                            <ToggleRight className="w-5 h-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditModal(true);
                          }}
                          disabled={user.role === 'owner'}
                          className="p-1"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        {hasTemporaryPassword(user) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowAccountManagementModal(true);
                            }}
                            disabled={user.role === 'owner'}
                            className="p-1"
                            title="จัดการบัญชีผู้ใช้"
                          >
                            <Paperclip className="w-4 h-4 text-purple-600" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowAccountManagementModal(true);
                            }}
                            disabled={user.role === 'owner'}
                            className="p-1"
                            title="สร้างรหัสผ่านชั่วคราว"
                          >
                            <Key className="w-4 h-4 text-orange-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmDeleteUser(user)}
                          disabled={user.role === 'owner'}
                          className="p-1"
                          title="ลบผู้ใช้"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sortedUsers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</p>
              </div>
            )}

            {/* Pagination footer */}
            {sortedUsers.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                <span className="text-sm text-gray-500">แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, sortedUsers.length)} จาก {sortedUsers.length} คน</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </Button>
                  {(() => {
                    const pages: number[] = [];
                    const from = Math.max(1, safePage - 2);
                    const to = Math.min(totalPages, from + 4);
                    for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i);
                    return pages.map(p => (
                      <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="sm" className={`h-8 w-8 p-0 text-xs ${p === safePage ? 'bg-chateau hover:bg-chateau-700 text-white' : ''}`} onClick={() => setCurrentPage(p)}>{p}</Button>
                    ));
                  })()}
                  <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSuccess={fetchUsers}
        currentUserRole={userRole}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={selectedUser}
        onUpdateSuccess={fetchUsers}
        currentUserRole={userRole}
      />

      {/* User Account Management Modal */}
      <Dialog open={showAccountManagementModal} onOpenChange={setShowAccountManagementModal}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>จัดการบัญชีผู้ใช้</DialogTitle>
            <DialogDescription>
              จัดการรหัสผ่านและการตั้งค่าบัญชีผู้ใช้
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <UserAccountManagement
              userId={selectedUser.id}
              initialData={{
                email: selectedUser.email,
                full_name: selectedUser.full_name || '',
                role: selectedUser.role,
                is_active: selectedUser.is_active,
                last_sign_in_at: selectedUser.last_sign_in_at,
                password_set_at: selectedUser.password_set_at
              }}
              onClose={() => {
                setShowAccountManagementModal(false);
                fetchUsers(); // Refresh the user list after changes
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center shadow-xl">
                <Trash2 className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <DialogTitle className="text-xl text-red-600">
                  ยืนยันการลบบัญชีผู้ใช้
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  ลบบัญชีการเข้าสู่ระบบเท่านั้น
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">ผู้ใช้ที่จะถูกลบ:</h4>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">ชื่อ:</span> {deletingUser?.full_name || 'ไม่ระบุ'}</p>
                <p><span className="font-medium">อีเมล:</span> {deletingUser?.email}</p>
                <p><span className="font-medium">สิทธิ์:</span> {deletingUser && getRoleBadge(deletingUser.role)}</p>
              </div>
            </div>

            <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-2">ข้อมูลที่จะคงอยู่:</h4>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>ข้อมูลโครงการทั้งหมด</li>
                <li>ข้อมูล Leads และลูกค้า</li>
                <li>ประวัติการทำงาน</li>
                <li>รายงานและเอกสาร</li>
              </ul>
            </div>

            <div className="bg-chateau-50 border border-chateau-100 rounded-lg p-4">
              <h4 className="font-medium text-chateau-700 mb-2">สิ่งที่จะถูกลบ:</h4>
              <ul className="text-sm text-chateau-600 space-y-1 list-disc list-inside">
                <li><strong>บัญชีเข้าสู่ระบบเท่านั้น</strong></li>
                <li>ผู้ใช้จะไม่สามารถล็อกอินได้</li>
                <li>สิทธิ์การเข้าถึงระบบจะหมดอายุ</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="flex-1">
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} className="flex-1">
              ลบบัญชี
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementContent;
