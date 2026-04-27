import { useState, useEffect } from "react";
import { X, Shield, User, Mail, UserCog, Power, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
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

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setFullName(user.full_name || "");
      // Normalize role to UserRole enum
      const normalizedRole = typeof user.role === 'string'
        ? user.role.toUpperCase() as UserRole
        : user.role;
      setRole(normalizedRole);
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

  // Check if role changed
  const roleChanged = !isAdmin && role.toLowerCase() !== (typeof user.role === 'string' ? user.role.toLowerCase() : user.role);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#676AF1]/10 via-[#8B5CF6]/10 to-[#676AF1]/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#676AF1] to-[#8B5CF6] rounded-xl shadow-md">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isAdmin ? 'แก้ไขข้อมูลพนักงานขาย' : 'แก้ไขข้อมูลผู้ใช้'}
              </h2>
              <p className="text-sm text-gray-500">อัปเดตข้อมูลและสิทธิ์การใช้งาน</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Basic Information Card */}
            <Card className="border-2 border-blue-100 shadow-sm">
              <CardContent className="p-0">
                {/* Card Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                  <div className="p-1.5 bg-blue-500 rounded-lg">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">ข้อมูลพื้นฐาน</h3>
                    <p className="text-xs text-blue-600">อีเมลและชื่อ-นามสกุล</p>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-4">
                  {/* Email */}
                  <div>
                    <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      อีเมล <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                      disabled={loading}
                      className="mt-1.5 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>

                  {/* Full Name */}
                  <div>
                    <Label htmlFor="edit-fullName" className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-500" />
                      ชื่อ-นามสกุล <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="สมชาย ใจดี"
                      required
                      disabled={loading}
                      className="mt-1.5 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Role Card */}
            <Card className="border-2 border-purple-100 shadow-sm">
              <CardContent className="p-0">
                {/* Card Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                  <div className="p-1.5 bg-purple-500 rounded-lg">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-900">ตำแหน่ง</h3>
                    <p className="text-xs text-purple-600">กำหนดบทบาทและสิทธิ์การใช้งาน</p>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4">
                  {isAdmin ? (
                    // Show read-only input for ADMIN
                    <div>
                      <Input
                        value="พนักงานขาย"
                        disabled
                        className="bg-gray-50 border-gray-200"
                      />
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        แอดมินสามารถจัดการได้เฉพาะตำแหน่งพนักงานขาย
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={role}
                      onValueChange={(value: UserRole) => setRole(value)}
                      disabled={loading}
                    >
                      <SelectTrigger className="border-gray-200 focus:border-purple-400 focus:ring-purple-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UserRole.ADMIN}>
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-500" />
                            <div>
                              <div className="font-medium">แอดมิน</div>
                              <div className="text-xs text-gray-500">จัดการผู้ใช้และระบบ</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value={UserRole.SALES}>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-500" />
                            <div>
                              <div className="font-medium">พนักงานขาย</div>
                              <div className="text-xs text-gray-500">จัดการลูกค้าและโครงการ</div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card className="border-2 border-orange-100 shadow-sm">
              <CardContent className="p-0">
                {/* Card Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                  <div className="p-1.5 bg-orange-500 rounded-lg">
                    <Power className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-orange-900">สถานะการใช้งาน</h3>
                    <p className="text-xs text-orange-600">เปิดหรือปิดการเข้าถึงระบบ</p>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4">
                  <div className="flex gap-3">
                    <label
                      className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isActive
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={isActive === true}
                        onChange={() => setIsActive(true)}
                        disabled={loading}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isActive ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className={`font-medium ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
                          ใช้งานอยู่
                        </span>
                        <p className="text-xs text-gray-500">สามารถเข้าใช้งานได้</p>
                      </div>
                    </label>
                    <label
                      className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        !isActive
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={isActive === false}
                        onChange={() => setIsActive(false)}
                        disabled={loading}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        !isActive ? 'border-red-500 bg-red-500' : 'border-gray-300'
                      }`}>
                        {!isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className={`font-medium ${!isActive ? 'text-red-700' : 'text-gray-700'}`}>
                          ระงับ
                        </span>
                        <p className="text-xs text-gray-500">ไม่สามารถเข้าใช้งานได้</p>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warning - only show for non-admin when role changes */}
            {roleChanged && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">คำเตือน</p>
                    <p className="text-sm text-amber-700 mt-1">
                      การเปลี่ยนตำแหน่งอาจส่งผลต่อสิทธิ์การเข้าถึงฟีเจอร์ต่างๆ
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">เกิดข้อผิดพลาด</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer - Fixed at bottom */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 border-gray-300 hover:bg-gray-100"
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] hover:opacity-90 text-white shadow-md"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                กำลังบันทึก...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                บันทึกการเปลี่ยนแปลง
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;
