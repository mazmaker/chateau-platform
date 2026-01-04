import { useState, useEffect } from "react";
import { X, Mail, User, Shield, Crown, Send, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole } from "@/lib/database-types";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { supabase } from "@/lib/supabase";

interface Tenant {
  id: string;
  name: string;
}

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess: () => void;
  currentUserRole?: 'owner' | 'admin' | 'sales' | null;
}

const InviteUserModal = ({ isOpen, onClose, onInviteSuccess, currentUserRole }: InviteUserModalProps) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  // ADMIN can only add SALES users
  const isAdmin = currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';
  const [role, setRole] = useState<UserRole>(isAdmin ? UserRole.SALES : UserRole.ADMIN);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [error, setError] = useState("");
  const { currentTenant } = useSimpleAuth();

  // Fetch tenants for Owner
  useEffect(() => {
    if (isOwner && isOpen) {
      fetchTenants();
    }
  }, [isOwner, isOpen]);

  const fetchTenants = async () => {
    setLoadingTenants(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTenants((data as Tenant[]) || []);

      // Auto-select current tenant if available
      if (currentTenant) {
        setSelectedTenantId(currentTenant.id);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoadingTenants(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setRole(isAdmin ? UserRole.SALES : UserRole.ADMIN);
    setSelectedTenantId(isOwner && currentTenant ? currentTenant.id : "");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("รูปแบบอีเมลไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      // For Owner, validate tenant selection
      const tenantId = isOwner ? selectedTenantId : currentTenant?.id;
      if (!tenantId) {
        setError("กรุณาเลือกบริษัท");
        setLoading(false);
        return;
      }

      // Check if user already exists in selected tenant
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id, email')
        .eq('tenant_id', tenantId)
        .eq('email', email.toLowerCase());

      if (checkError) {
        throw checkError;
      }

      if (existingUsers && existingUsers.length > 0) {
        setError("ผู้ใช้นี้มีอยู่ในระบบแล้ว");
        setLoading(false);
        return;
      }

      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

      // Create user in Supabase Auth first
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          tenant_id: tenantId,
          role: role.toLowerCase()
        }
      });

      if (authError) {
        // If user already exists in Auth, just get their ID
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (existingUser) {
          throw new Error('ผู้ใช้นี้มีอยู่ในระบบแล้ว');
        }
        throw authError;
      }

      const userId = authData.user.id;

      // Create user record in users table
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email.toLowerCase(),
          full_name: fullName,
          tenant_id: tenantId,
          role: role.toLowerCase(),
          is_active: true,
          created_at: new Date().toISOString()
        });

      if (userError) {
        // Rollback: delete auth user if database insert fails
        await supabase.auth.admin.deleteUser(userId);
        throw userError;
      }

      // Send magic link email for password setup
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email.toLowerCase(), {
        data: {
          full_name: fullName,
          tenant_id: tenantId,
          role: role.toLowerCase(),
          redirect_to: `${window.location.origin}/auth/reset-password`
        }
      });

      // Log activity
      await supabase.rpc('log_activity', {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_activity_type: 'user_added',
        p_description: `เพิ่มผู้ใช้ใหม่: ${fullName} (${email.toLowerCase()})`,
        p_metadata: { user_id: userId, email: email.toLowerCase(), role: role.toLowerCase() }
      });

      console.log(`User ${email} created successfully. Invite sent.`);

      onInviteSuccess();
      resetForm();
      onClose();

    } catch (error: any) {
      console.error('Error inviting user:', error);
      setError(error.message || "เกิดข้อผิดพลาดในการเชิญผู้ใช้");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isAdmin ? 'เพิ่มพนักงานขายใหม่' : 'เชิญผู้ใช้ใหม่'}
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Email */}
          <div className="mb-4">
            <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              อีเมล
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              disabled={loading}
            />
          </div>

          {/* Full Name */}
          <div className="mb-4">
            <Label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              ชื่อ-นามสกุล
            </Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="สมชาย ใจดี"
              required
              disabled={loading}
            />
          </div>

          {/* Tenant - Only for Owner */}
          {isOwner && (
            <div className="mb-4">
              <Label htmlFor="tenant" className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                บริษัท
              </Label>
              <Select
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
                disabled={loading || loadingTenants}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingTenants ? "กำลังโหลด..." : "เลือกบริษัท"} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Role */}
          <div className="mb-4">
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-1" />
              ตำแหน่ง
            </Label>
            <Select value={role} onValueChange={(value: UserRole) => setRole(value)} disabled={loading || isAdmin}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* ADMIN can only add SALES users, OWNER can add all roles */}
                {!isAdmin && (
                  <>
                    <SelectItem value={UserRole.OWNER}>
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-600" />
                        เจ้าของบริษัท - สิทธิ์สูงสุด
                      </div>
                    </SelectItem>
                    <SelectItem value={UserRole.ADMIN}>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        แอดมิน - จัดการผู้ใช้และระบบ
                      </div>
                    </SelectItem>
                  </>
                )}
                <SelectItem value={UserRole.SALES}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    พนักงานขาย - จัดการลูกค้าและโครงการ
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <p className="text-xs text-gray-500 mt-1">
                * แอดมินสามารถเพิ่มได้เฉพาะตำแหน่งพนักงานขาย
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>ข้อมูล:</strong> ผู้ใช้จะได้รับอีเมลเชิญพร้อมคำแนะนำในการเข้าใช้งาน
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  กำลังส่ง...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Send className="w-4 h-4 mr-2" />
                  ส่งคำเชิญ
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserModal;