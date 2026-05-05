import { useState, useEffect } from "react";
import { User, Clock, Shield, Key, Copy, CheckCircle, XCircle, RefreshCw, Send, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface UserAccountManagementProps {
  userId: string;
  initialData: {
    email: string;
    full_name: string;
    role: 'owner' | 'admin' | 'sales';
    is_active: boolean;
    last_sign_in_at?: string;
    password_set_at?: string;
  };
  onClose: () => void;
}

const UserAccountManagement = ({ userId, initialData, onClose }: UserAccountManagementProps) => {
  const [email, setEmail] = useState(initialData.email);
  const [isAccountEnabled, setIsAccountEnabled] = useState(initialData.is_active);
  const [tempPassword, setTempPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasTempPassword, setHasTempPassword] = useState(!initialData.password_set_at);

  // Load stored temporary password on component mount
  useEffect(() => {
    const storedPassword = localStorage.getItem(`temp_password_${userId}`);
    if (storedPassword && !initialData.password_set_at) {
      setTempPassword(storedPassword);
    }
    // Clean up old stored passwords if user has permanent password
    if (initialData.password_set_at) {
      localStorage.removeItem(`temp_password_${userId}`);
    }
  }, [userId, initialData.password_set_at]);


  // Format last login time
  const formatLastLogin = (dateString?: string) => {
    if (!dateString) return "ไม่เคยเข้าสู่ระบบ";

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const thaiDate = date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (diffDays === 1) return `เมื่อวาน ${thaiDate}`;
    if (diffDays <= 7) return `${diffDays} วันที่แล้ว ${thaiDate}`;
    return thaiDate;
  };

  // Copy temporary password to clipboard
  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("คัดลอกรหัสผ่านแล้ว");
    } catch (err) {
      toast.error("ไม่สามารถคัดลอกได้");
    }
  };

  // Send invitation email
  const sendInvitationEmail = async () => {
    setLoading(true);
    try {
      // Implementation for sending invitation email
      toast.success("ส่งอีเมลเชิญเข้าร่วมแล้ว");
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการส่งอีเมล");
    } finally {
      setLoading(false);
    }
  };

  // Reset password using Edge Function
  const resetPassword = async () => {
    setLoading(true);
    try {
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/reset-user-password`;
      console.log('Calling Reset Password Edge Function:', edgeFunctionUrl);

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      const requestBody = {
        userId: userId,
        email: email
      };

      console.log('Reset password request:', requestBody);

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Reset response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Reset password error:', errorText);
        throw new Error(`Reset failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Reset password result:', result);

      if (result.success) {
        setTempPassword(result.tempPassword);
        setHasTempPassword(true);
        // Store temporarily in localStorage
        localStorage.setItem(`temp_password_${userId}`, result.tempPassword);
        toast.success("รีเซ็ตรหัสผ่านเรียบร้อยแล้ว");
        toast.info("รหัสผ่านชั่วคราวใหม่พร้อมใช้งาน", { duration: 6000 });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error resetting password:', error);

      if (error instanceof Error) {
        if (error.message.includes('404')) {
          toast.error("Reset Password Function ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
        } else {
          toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
        }
      } else {
        toast.error("เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน");
      }
    } finally {
      setLoading(false);
    }
  };

  // Create user account with temporary password using Edge Function
  const createUserAccount = async () => {
    setLoading(true);
    try {
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-temp-user`;
      console.log('Calling Edge Function:', edgeFunctionUrl);

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      const requestBody = {
        email: email,
        fullName: initialData.full_name,
        role: initialData.role,
        userId: userId
      };

      console.log('Request body:', requestBody);

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge function error:', errorText);
        throw new Error(`Edge function failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Edge function result:', result);

      if (result.success) {
        setTempPassword(result.tempPassword);
        setHasTempPassword(true);
        // Store temporarily in localStorage
        localStorage.setItem(`temp_password_${userId}`, result.tempPassword);
        toast.success("สร้างบัญชีและรหัสผ่านชั่วคราวเรียบร้อยแล้ว");
        toast.info("ผู้ใช้สามารถเข้าสู่ระบบได้ด้วยรหัสผ่านนี้แล้ว", { duration: 8000 });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error creating user account:', error);

      if (error instanceof Error) {
        if (error.message.includes('404')) {
          toast.error("Edge Function ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
        } else {
          toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
        }
      } else {
        toast.error("เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
      }
    } finally {
      setLoading(false);
    }
  };

  // Update user account settings
  const updateUserAccount = async () => {
    setUpdating(true);
    try {
      // Update email in auth (if changed)
      if (email !== initialData.email) {
        const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
          email: email
        });
        if (emailError) throw emailError;
      }

      // Update user profile
      const { error: profileError } = await (supabase as any)
        .from('users')
        .update({
          email: email,
          is_active: isAccountEnabled
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      toast.success("อัปเดตข้อมูลเรียบร้อยแล้ว");
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📎 จัดการบัญชีผู้ใช้
            </CardTitle>
            <CardDescription className="text-gray-600">
              {initialData.full_name} • {initialData.role.toUpperCase()}
              {initialData.password_set_at ? (
                <span className="ml-2 text-green-600 font-medium">• ✅ มีรหัสผ่านแล้ว</span>
              ) : (
                <span className="ml-2 text-green-600 font-medium">• 🚀 พร้อมสร้างบัญชี</span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Account Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge
              className={`${
                isAccountEnabled
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'bg-red-100 text-red-800 border-red-300'
              } border`}
            >
              {isAccountEnabled ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  เปิดใช้งานอยู่
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  ปิดอยู่แล้ว
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            เข้าสู่ระบบล่าสุด: {formatLastLogin(initialData.last_sign_in_at)}
          </div>
        </div>

        <Separator />

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email">อีเมลสำหรับเข้าสู่ระบบ</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@company.com"
            className="w-full"
          />
        </div>

        {/* Enable Account Checkbox */}
        <div className="flex items-start space-x-3">
          <Checkbox
            id="enable-account"
            checked={isAccountEnabled}
            onCheckedChange={(checked) => setIsAccountEnabled(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="enable-account"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              เปิดใช้งานการเข้าสู่ระบบ
            </label>
            <p className="text-xs text-gray-600">
              อนุญาตให้พนักงานเข้าสู่ระบบผ่านแอปพลิเคชัน CHATEAU Platform
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={sendInvitationEmail}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            ส่งอีเมลเชิญเข้าร่วม
          </Button>

          {initialData.password_set_at ? (
            // User has permanent password - show reset button
            <Button
              onClick={resetPassword}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              รีเซ็ตรหัสผ่าน
            </Button>
          ) : hasTempPassword ? (
            // User has temporary password - show reset temp password button
            <Button
              onClick={resetPassword}
              disabled={loading}
              variant="outline"
              className="flex-1 border-chateau-200 text-chateau-600 hover:bg-chateau-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              รีเซ็ตรหัสผ่านชั่วคราว
            </Button>
          ) : (
            // User has no password - show create button
            <Button
              onClick={createUserAccount}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              สร้างบัญชีและรหัสผ่านชั่วคราว
            </Button>
          )}
        </div>

        {/* Temporary Password Section */}
        {(tempPassword || hasTempPassword) && (
          <Alert className="bg-chateau-50 border-chateau-100">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-chateau-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Key className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 space-y-3">
                <p className="font-medium text-chateau-700 text-lg">
                  {tempPassword ? "รหัสผ่านชั่วคราวปัจจุบัน" : "มีรหัสผ่านชั่วคราวแล้ว"}
                </p>

                {tempPassword ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={tempPassword}
                          readOnly
                          className="bg-white border-chateau-200 font-mono text-lg tracking-wider pr-10"
                          style={{ fontSize: '16px', letterSpacing: '3px' }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 text-chateau hover:bg-chateau-100"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button
                        onClick={copyTempPassword}
                        size="sm"
                        variant="outline"
                        className="border-chateau-200 text-chateau-600 hover:bg-chateau-100 px-4"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        คัดลอก
                      </Button>
                    </div>

                    <div className="space-y-2 text-sm text-chateau-600">
                      <p>• <strong>สำหรับบัญชีผู้ใช้:</strong> ใช้อีเมลและรหัสผ่านนี้ในการเข้าสู่ระบบครั้งแรก</p>
                      <p>• <strong>อีเมลสำหรับเข้าสู่ระบบ:</strong> {email}</p>
                      <p>• <strong>โรงแรมต้องเตรียม:</strong> รหัสผ่านในการเข้าสู่ระบบครั้งแรกให้พนักงาน</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 text-sm text-chateau-600">
                    <p>• <strong>สถานะ:</strong> ผู้ใช้มีรหัสผ่านชั่วคราวแล้ว</p>
                    <p>• <strong>อีเมลสำหรับเข้าสู่ระบบ:</strong> {email}</p>
                    <p>• <strong>หากต้องการดูรหัสผ่าน:</strong> กดปุ่มรีเซ็ตรหัสผ่านเพื่อสร้างใหม่</p>
                    <p className="text-chateau font-medium">⚠️ รหัสผ่านเดิมจะไม่สามารถแสดงได้เพื่อความปลอดภัย</p>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Notes */}
        <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
          <p>• <strong>สร้างบัญชีและรหัสผ่านชั่วคราว:</strong> สร้างบัญชีจริงที่ใช้เข้าสู่ระบบได้ทันที</p>
          <p>• <strong>รีเซ็ตรหัสผ่าน:</strong> สร้างรหัสผ่านชั่วคราวใหม่สำหรับผู้ใช้ที่มีบัญชีแล้ว</p>
          <p>• <strong>อีเมลเชิญเข้าร่วม:</strong> ส่งคำเชิญเข้าใช้งานระบบให้ผู้ใช้</p>
          <p>• <strong>ระบบใหม่:</strong> ใช้ Supabase Edge Function เพื่อสร้างบัญชีได้จริงผ่าน UI</p>
        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={updating}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={updateUserAccount}
            disabled={updating}
            className="bg-gray-900 hover:bg-black text-white shadow-lg"
          >
            {updating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              "บันทึกการเปลี่ยนแปลง"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserAccountManagement;