import { useState, useEffect } from "react";
import { X, Shield, User, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole } from "@/lib/database-types";
import { supabase } from "@/lib/supabase";

// Flat user data structure from users table
interface UserData {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: UserRole | string;
  tenant_id: string;
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserData | null;
  onUpdateSuccess: () => void;
  currentUserRole?: 'owner' | 'admin' | 'sales' | null;
}

const EditUserModal = ({ isOpen, onClose, user, onUpdateSuccess, currentUserRole }: EditUserModalProps) => {
  // ADMIN can only manage SALES users
  const isAdmin = currentUserRole === 'admin';
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.SALES);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tenantName, setTenantName] = useState<string>("");

  // Get display name for role
  const getRoleDisplayName = (r: UserRole | string): string => {
    const lowerRole = typeof r === 'string' ? r.toLowerCase() : r;
    if (lowerRole === 'owner') return 'เจ้าของบริษัท (Owner)';
    if (lowerRole === 'admin') return 'ผู้ดูแลบริษัท (Admin)';
    if (lowerRole === 'sales') return 'พนักงานขาย (Sales)';
    return 'ตำแหน่งปัจจุบัน';
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        setEmail(user.email || "");
        setFullName(user.full_name || "");
        // Normalize role to UserRole enum (lowercase)
        const normalizedRole = typeof user.role === 'string'
          ? user.role.toLowerCase() as UserRole
          : user.role;
        setRole(normalizedRole);
        setIsActive(user.is_active);
        setError("");

        // Fetch tenant name
        if (user.tenant_id) {
          const { data } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', user.tenant_id)
            .single();
          if (data) {
            setTenantName(data.name);
          }
        }
      }
    };

    fetchUserData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // For ADMIN, always use 'sales' role
      // For others, convert role to lowercase string
      const roleValue = isAdmin ? 'sales' : (role ? String(role).toLowerCase() : 'sales');

      // Update users table directly
      const { error } = await supabase
        .from('users')
        .update({
          email: email.toLowerCase(),
          full_name: fullName,
          role: roleValue,
          is_active: isActive
        })
        .eq('id', user.id);

      if (error) throw error;

      onUpdateSuccess();
      onClose();

    } catch (error: any) {
      console.error('Error updating user:', error);
      setError(error.message || "เกิดข้อผิดพลาดในการอัปเดตผู้ใช้");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError("");
      onClose();
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isAdmin ? 'แก้ไขข้อมูลพนักงานขาย' : 'แก้ไขข้อมูลผู้ใช้'}
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
            <Label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              อีเมล
            </Label>
            <Input
              id="edit-email"
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
            <Label htmlFor="edit-fullName" className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              ชื่อ-นามสกุล
            </Label>
            <Input
              id="edit-fullName"
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
            {isAdmin ? (
              // Show read-only input for ADMIN
              <Input
                value="พนักงานขาย"
                disabled
                className="bg-gray-100"
              />
            ) : (
              <Select
                value={role}
                onValueChange={(value: UserRole) => setRole(value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกตำแหน่ง..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.ADMIN}>ผู้ดูแลบริษัท (Admin)</SelectItem>
                  <SelectItem value={UserRole.SALES}>พนักงานขาย (Sales)</SelectItem>
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              ตำแหน่งปัจจุบัน: <span className="font-medium text-gray-700">{getRoleDisplayName(role)}</span>
            </p>
            {isAdmin && (
              <p className="text-xs text-gray-500 mt-1">
                * แอดมินสามารถจัดการได้เฉพาะตำแหน่งพนักงานขาย
              </p>
            )}
          </div>

          {/* Company Info */}
          {tenantName && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">บริษัทปัจจุบัน:</span>
                <span>{tenantName}</span>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              สถานะการใช้งาน
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={isActive === true}
                  onChange={() => setIsActive(true)}
                  disabled={loading}
                  className="mr-2"
                />
                <div>
                  <span className="font-medium">ใช้งานอยู่</span>
                  <p className="text-xs text-gray-600">ผู้ใช้สามารถเข้าใช้งานได้</p>
                </div>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={isActive === false}
                  onChange={() => setIsActive(false)}
                  disabled={loading}
                  className="mr-2"
                />
                <div>
                  <span className="font-medium">ระงับ</span>
                  <p className="text-xs text-gray-600">ผู้ใช้ไม่สามารถเข้าใช้งานได้</p>
                </div>
              </label>
            </div>
          </div>

          {/* Warning - only show for non-admin when role changes */}
          {!isAdmin && role.toLowerCase() !== (typeof user.role === 'string' ? user.role.toLowerCase() : user.role) && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>คำเตือน:</strong> การเปลี่ยนตำแหน่งอาจส่งผลต่อสิทธิ์การเข้าถึงฟีเจอร์ต่างๆ
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

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
                  กำลังบันทึก...
                </div>
              ) : (
                "บันทึกการเปลี่ยนแปลง"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;