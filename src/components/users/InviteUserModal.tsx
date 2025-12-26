import { useState } from "react";
import { X, Mail, User, Shield, Crown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole } from "@/lib/database-types";
import { useAuth } from "@/contexts/AuthContext";

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess: () => void;
}

const InviteUserModal = ({ isOpen, onClose, onInviteSuccess }: InviteUserModalProps) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { currentTenant, supabase } = useAuth();

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setRole(UserRole.SALES);
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

      // Check if user already exists in this tenant
      const { data: existingUser, error: checkError } = await supabase
        .from('user_tenants')
        .select('id, users!inner(email)')
        .eq('tenant_id', currentTenant?.id)
        .eq('users.email', email.toLowerCase())
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingUser) {
        setError("ผู้ใช้นี้มีอยู่ในระบบแล้ว");
        setLoading(false);
        return;
      }

      // Create user or get existing user
      let userId: string;

      // Check if user exists in auth.users
      const { data: authUser, error: authError } = await supabase
        .rpc('get_user_by_email', { email: email.toLowerCase() });

      if (authError && authError.code !== 'PGRST116') {
        throw authError;
      }

      if (authUser) {
        // User exists, get their ID
        userId = authUser.id;
      } else {
        // User doesn't exist, create them with temporary password
        const tempPassword = Math.random().toString(36).slice(-8);

        const { data: newUser, error: signUpError } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password: tempPassword,
          options: {
            data: {
              full_name: fullName,
              invited_by_tenant: currentTenant?.name
            }
          }
        });

        if (signUpError) throw signUpError;
        if (!newUser.user) throw new Error("Failed to create user");

        userId = newUser.user.id;

        // Send invitation email with temporary password
        // In a real app, this would be sent via your email service
        console.log(`Sending invitation to ${email} with temporary password: ${tempPassword}`);
      }

      // Add user to tenant
      const { error: tenantError } = await supabase
        .from('user_tenants')
        .insert({
          user_id: userId,
          tenant_id: currentTenant?.id,
          role: role,
          is_active: true
        });

      if (tenantError) throw tenantError;

      // Create user record if not exists
      await supabase
        .from('users')
        .upsert({
          id: userId,
          email: email.toLowerCase(),
          full_name: fullName,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

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
          <h2 className="text-xl font-semibold text-gray-900">เชิญผู้ใช้ใหม่</h2>
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

          {/* Role */}
          <div className="mb-4">
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-1" />
              ตำแหน่ง
            </Label>
            <Select value={role} onValueChange={(value: UserRole) => setRole(value)} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
                <SelectItem value={UserRole.SALES}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    พนักงานขาย - จัดการลูกค้าและโครงการ
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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