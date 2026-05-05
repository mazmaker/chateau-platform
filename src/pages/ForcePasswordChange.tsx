import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const ForcePasswordChange = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, signOut, refreshUser } = useSimpleAuth();

  // Password validation
  const isPasswordValid = newPassword.length >= 6;
  const isPasswordMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (!isPasswordMatch) {
      toast.error("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);

    try {
      // Use Edge Function to change password with proper permissions
      const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/change-password`;

      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      console.log('🔄 Calling change-password Edge Function...');

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          newPassword: newPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }

      const result = await response.json();
      console.log('✅ Password change result:', result);

      toast.success("รหัสผ่านเปลี่ยนเรียบร้อยแล้ว! กำลังเข้าสู่ระบบ...");

      // Refresh user data in auth context
      console.log('🔄 Refreshing user data...');
      await refreshUser();

      console.log('✅ User data refreshed - navigating to dashboard');

      // Navigate immediately after refresh
      navigate('/', { replace: true });

    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              เปลี่ยนรหัสผ่าน
            </CardTitle>
            <CardDescription className="text-gray-600">
              จำเป็นต้องเปลี่ยนรหัสผ่านชั่วคราวก่อนเข้าใช้งานระบบ
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Security Notice */}
            <div className="flex items-start gap-3 p-4 bg-chateau-50 border border-chateau-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-chateau mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-chateau-700">
                  ข้อกำหนดความปลอดภัย
                </p>
                <p className="text-sm text-chateau-600 mt-1">
                  เพื่อความปลอดภัย คุณต้องเปลี่ยนรหัสผ่านชั่วคราวก่อนเข้าใช้งานระบบครั้งแรก
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="pr-10"
                    placeholder="รหัสผ่านชั่วคราวที่ได้รับ"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="pr-10"
                    placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Password strength indicator */}
                <div className="flex items-center gap-2 text-sm">
                  {isPasswordValid ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-green-600">รหัสผ่านถูกต้อง</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-red-500" />
                      <span className="text-red-600">ต้องมีอย่างน้อย 6 ตัวอักษร</span>
                    </>
                  )}
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                    placeholder="ยืนยันรหัสผ่านใหม่"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Password match indicator */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    {isPasswordMatch ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-green-600">รหัสผ่านตรงกัน</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-red-500" />
                        <span className="text-red-600">รหัสผ่านไม่ตรงกัน</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="space-y-3 pt-4">
                <Button
                  type="submit"
                  disabled={!isPasswordValid || !isPasswordMatch || loading}
                  className="w-full bg-gray-900 hover:bg-black text-white shadow-lg"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      กำลังเปลี่ยนรหัสผ่าน...
                    </>
                  ) : (
                    "เปลี่ยนรหัสผ่านและเข้าสู่ระบบ"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full"
                  disabled={loading}
                >
                  ออกจากระบบ
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            หากมีปัญหา กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChange;