import { useState, useEffect } from "react";
import { X, Mail, User, Shield, Building2, Check, Send } from "lucide-react";
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
  const [successInviteLink, setSuccessInviteLink] = useState("");
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
    setSuccessInviteLink("");
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

      // Get session for Edge Function authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("กรุณาเข้าสู่ระบบใหม่");
        setLoading(false);
        return;
      }

      // Call Edge Function to handle invite
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/invite-user`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          fullName,
          tenantId,
          role: role.toLowerCase(),
          redirectTo: `${window.location.origin}/auth/setup-password`
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send invite');
      }

      // Show success with invite link
      setSuccessInviteLink(result.invite_url);
      onInviteSuccess();

    } catch (error: any) {
      console.error('Error inviting user:', error);
      setError(error.message || "เกิดข้อผิดพลาดในการเพิ่มผู้ใช้");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !successInviteLink) {
      resetForm();
      onClose();
    } else if (successInviteLink) {
      // If there's a success invite link, just clear it and keep modal open
      setSuccessInviteLink("");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(successInviteLink);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isAdmin ? 'เพิ่มพนักงานขายใหม่' : 'เพิ่มผู้ใช้ใหม่'}
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
                <SelectValue placeholder="เลือกตำแหน่ง..." />
              </SelectTrigger>
              <SelectContent>
                {/* ADMIN can only add SALES users, OWNER can add all roles */}
                {!isAdmin && (
                  <>
                    <SelectItem value={UserRole.OWNER}>เจ้าของบริษัท (Owner)</SelectItem>
                    <SelectItem value={UserRole.ADMIN}>ผู้ดูแลบริษัท (Admin)</SelectItem>
                  </>
                )}
                <SelectItem value={UserRole.SALES}>พนักงานขาย (Sales)</SelectItem>
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

          {/* Success Box - Show when invite link is generated */}
          {successInviteLink ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">สร้างคำเชิญสำเร็จ!</p>
                    <p className="text-sm text-green-700">คัดลอกลิงก์ด้านล่างไปส่งให้ผู้ใช้</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-300">
                  <p className="text-xs text-gray-500 mb-2">ลิงก์คำเชิญ:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={successInviteLink}
                      className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-700 select-all"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={copyToClipboard}
                      className="shrink-0"
                    >
                      คัดลอก
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  ลิงก์นี้จะหมดอายุเมื่อผู้ใช้ตั้งรหัสผ่านเรียบร้อยแล้ว
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  เชิญผู้ใช้อื่น
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    copyToClipboard();
                    onClose();
                  }}
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-2" />
                  คัดลอกและปิด
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Info Box */}
              <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <Send className="w-4 h-4 inline mr-1" />
                  <strong>ส่งคำเชิญ:</strong> สร้างลิงก์คำเชิญให้ผู้ใช้ตั้งรหัสผ่านด้วยตัวเอง
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
                      กำลังสร้าง...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Send className="w-4 h-4 mr-2" />
                      สร้างคำเชิญ
                    </div>
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default InviteUserModal;