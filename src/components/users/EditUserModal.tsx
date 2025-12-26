import { useState, useEffect } from "react";
import { X, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserRole } from "@/lib/database-types";
import { useAuth } from "@/contexts/AuthContext";

interface UserTenantData {
  id: string;
  user_id: string;
  tenant_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
  users: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserTenantData | null;
  onUpdateSuccess: () => void;
}

const EditUserModal = ({ isOpen, onClose, user, onUpdateSuccess }: EditUserModalProps) => {
  const [role, setRole] = useState<UserRole>(UserRole.SALES);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { supabase } = useAuth();

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setIsActive(user.is_active);
      setError("");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase
        .from('user_tenants')
        .update({
          role: role,
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

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      [UserRole.ADMIN]: "bg-blue-100 text-blue-800",
      [UserRole.SALES]: "bg-green-100 text-green-800"
    };

    const labels = {
      [UserRole.ADMIN]: "แอดมิน",
      [UserRole.SALES]: "พนักงานขาย"
    };

    return (
      <Badge className={styles[role]}>
        {labels[role]}
      </Badge>
    );
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">แก้ไขข้อมูลผู้ใช้</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* User Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center">
                {user.users.full_name
                  ? user.users.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                  : user.users.email.slice(0, 2).toUpperCase()
                }
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {user.users.full_name || "ไม่ระบุชื่อ"}
                </p>
                <p className="text-sm text-gray-600">{user.users.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">ตำแหน่งปัจจุบัน:</span>
              {getRoleBadge(user.role)}
            </div>
          </div>

          {/* Role */}
          <div className="mb-4">
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-1" />
              ตำแหน่ง
            </Label>
            <Select
              value={role}
              onValueChange={(value: UserRole) => setRole(value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.ADMIN}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <div>
                      <div className="font-medium">แอดมิน</div>
                      <div className="text-xs text-gray-600">จัดการผู้ใช้และระบบ</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value={UserRole.SALES}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <div>
                      <div className="font-medium">พนักงานขาย</div>
                      <div className="text-xs text-gray-600">จัดการลูกค้าและโครงการ</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          {/* Warning */}
          {role !== user.role && (
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