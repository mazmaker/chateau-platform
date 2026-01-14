import { useState, useEffect } from "react";
import { Search, Plus, User, Shield, ToggleLeft, ToggleRight, Trash2, Edit, UserPlus, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { supabase } from "@/lib/supabase";
import InviteUserModal from "./InviteUserModal";
import EditUserModal from "./EditUserModal";
import DemoUserModal from "./DemoUserModal";
import { toast } from "sonner";

type UserRole = 'owner' | 'admin' | 'sales';

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
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const { currentTenant, userRole, user } = useSimpleAuth();

  // ADMIN can only see SALES users in their tenant
  const isAdmin = userRole === 'admin';
  const isOwner = userRole === 'owner';

  useEffect(() => {
    fetchUsers();
    if (isOwner) {
      fetchTenants();
    }
  }, [currentTenant, isAdmin, isOwner]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter, tenantFilter]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTenants((data as Tenant[]) || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchUsers = async () => {
    if (!currentTenant && !isOwner) return;

    try {
      // Fetch from users table
      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      // ADMIN can only see SALES users in their tenant
      if (isAdmin && currentTenant) {
        query = query.eq('tenant_id', currentTenant.id).eq('role', 'sales');
      }

      const { data, error } = await query;

      if (error) throw error;

      // For Owner, enrich with tenant names
      let enrichedData = (data as any[]) || [];
      if (isOwner) {
        enrichedData = enrichedData.map((user: any) => ({
          ...user,
          tenant_name: tenants.find(t => t.id === user.tenant_id)?.name || '-'
        }));
      }

      setUsers(enrichedData as UserData[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
    } finally {
      setLoading(false);
    }
  };

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
      toast.success('ลบผู้ใช้สำเร็จ');
      setShowDeleteDialog(false);
      setDeletingUser(null);
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error('ไม่สามารถลบผู้ใช้ได้');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      owner: "bg-purple-100 text-purple-800 border-purple-300",
      admin: "bg-blue-100 text-blue-800 border-blue-300",
      sales: "bg-green-100 text-green-800 border-green-300"
    };

    const labels = {
      owner: "เจ้าของแพลตฟอร์ม",
      admin: "ผู้ดูแลบริษัท",
      sales: "พนักงานขาย"
    };

    const icons = {
      owner: "👑",
      admin: "🔧",
      sales: "💼"
    };

    return (
      <Badge className={`${styles[role]} border`}>
        {icons[role]} {labels[role]}
      </Badge>
    );
  };

  const getUserInitials = (fullName?: string, email?: string) => {
    if (fullName) {
      return fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return email?.split('@')[0].toUpperCase().slice(0, 2) || 'U';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isAdmin ? 'จัดการพนักงานขาย' : 'จัดการผู้ใช้'}
                </h1>
                <p className="text-gray-600 mt-1">
                  {isAdmin
                    ? 'จัดการพนักงานขายในบริษัทของคุณ'
                    : 'จัดการผู้ใช้และสิทธิ์ในระบบของคุณ'
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowDemoModal(true)}
                variant="outline"
                className="flex items-center gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Sparkles className="w-4 h-4" />
                ทดสอบ
              </Button>
              <Button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                <UserPlus className="w-4 h-4" />
                {isAdmin ? 'เพิ่มพนักงานขาย' : 'เพิ่มผู้ใช้ใหม่'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-5'} gap-4`}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">{isAdmin ? 'พนักงานขายทั้งหมด' : 'ทั้งหมด'}</p>
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

        {/* Only show owner/admin stats for OWNER users */}
        {!isAdmin && (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <User className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">เจ้าของ</p>
                    <p className="text-xl font-semibold">{users.filter(u => u.role === 'owner').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">แอดมิน</p>
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
                  <SelectValue placeholder="🏢 ทุกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏢 ทุกบริษัท</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Only show role filter for OWNER users */}
            {!isAdmin && (
              <Select value={roleFilter} onValueChange={(value: UserRole | "all") => setRoleFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ทุกตำแหน่ง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกตำแหน่ง</SelectItem>
                  <SelectItem value="owner">👑 เจ้าของแพลตฟอร์ม</SelectItem>
                  <SelectItem value="admin">🔧 ผู้ดูแลบริษัท</SelectItem>
                  <SelectItem value="sales">💼 พนักงานขาย</SelectItem>
                </SelectContent>
              </Select>
            )}

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
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">ผู้ใช้</th>
                  {isOwner && <th className="text-left py-3 px-4 font-semibold text-gray-700">🏢 บริษัท</th>}
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">👤 ตำแหน่ง (Role)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">สถานะ</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">เข้าร่วมเมื่อ</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">เข้าใช้ล่าสุด</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
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
                      <Badge className={user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {user.is_active ? "ใช้งานอยู่" : "ระงับ"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('th-TH')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('th-TH') : '-'}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingUser(user);
                            setShowDeleteDialog(true);
                          }}
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

            {filteredUsers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Demo User Modal */}
      <DemoUserModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onSuccess={fetchUsers}
      />

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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAdmin ? 'ยืนยันการลบพนักงานขาย' : 'ยืนยันการลบผู้ใช้'}
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบ "{deletingUser?.full_name || deletingUser?.email}" ใช่หรือไม่?
              <br /><br />
              <span className="text-red-600 font-medium">
                การกระทำนี้ไม่สามารถกู้คืนได้
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              {isAdmin ? 'ลบพนักงานขาย' : 'ลบผู้ใช้'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementContent;
