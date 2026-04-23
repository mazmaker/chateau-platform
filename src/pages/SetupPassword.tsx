import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Key, Eye, EyeOff, Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const SetupPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว");
      setTokenChecked(true);
      return;
    }

    const verifyToken = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('signup_token', token)
          .maybeSingle();

        if (error || !data) {
          setError("ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว");
          setTokenChecked(true);
          return;
        }

        // Check if token has expired
        if (data.signup_expires_at && new Date(data.signup_expires_at) < new Date()) {
          setError("ลิงก์เชิญหมดอายุแล้ว กรุณาขอคำเชิญใหม่");
          setTokenChecked(true);
          return;
        }

        // Check if user is already active (already accepted invite)
        if (data.is_active) {
          setError("คำเชิญนี้ถูกใช้ไปแล้ว กรุณาเข้าสู่ระบบ");
          setTokenChecked(true);
          return;
        }

        setEmail(data.email);
        setFullName(data.full_name || "");
        setIsValidToken(true);
        setTokenChecked(true);
      } catch (err) {
        console.error('Error verifying token:', err);
        setError("เกิดข้อผิดพลาดในการตรวจสอบลิงก์");
        setTokenChecked(true);
      }
    };

    verifyToken();
  }, [token]);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: '' };

    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    const strengths = [
      { score: 0, label: 'ยังไม่ได้กรอก', color: 'bg-gray-200' },
      { score: 1, label: 'อ่อนมาก', color: 'bg-red-500' },
      { score: 2, label: 'อ่อน', color: 'bg-orange-500' },
      { score: 3, label: 'ปานกลาง', color: 'bg-yellow-500' },
      { score: 4, label: 'แข็งแรง', color: 'bg-lime-500' },
      { score: 5, label: 'แข็งแรงมาก', color: 'bg-green-500' }
    ];

    return strengths[score];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (password.length < 6) {
        setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("รหัสผ่านไม่ตรงกัน");
        setLoading(false);
        return;
      }

      // Get current session (user should be logged in with temp password via magic link)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // If not logged in, need to sign in first with temp credentials
        // This shouldn't happen with proper flow, but handle it
        setError("กรุณาตรวจสอบลิงก์เชิญจากอีเมลของคุณอีกครั้ง");
        setLoading(false);
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      // Complete the signup - activate the user in public.users
      const { data: completeData, error: completeError } = await supabase.rpc('complete_user_signup', {
        p_signup_token: token,
        p_auth_user_id: session.user.id
      });

      if (completeError || !completeData?.success) {
        console.error('Error completing signup:', completeError);
        // Password was updated but RPC failed - still allow login
        toast.success("ตั้งรหัสผ่านสำเร็จ! คุณสามารถเข้าสู่ระบบได้แล้ว");
      } else {
        toast.success("ตั้งค่าบัญชีสำเร็จ! ยินดีต้อนรับสู่ CHATEAU Platform");
      }

      // Sign out and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);

    } catch (error: any) {
      console.error('Error setting password:', error);
      setError(error.message || "เกิดข้อผิดพลาดในการตั้งรหัสผ่าน");
    } finally {
      setLoading(false);
    }
  };

  if (!tokenChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          <span className="text-gray-600">กำลังตรวจสอบลิงก์เชิญ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl rounded-2xl shadow-lg mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งรหัสผ่าน</h1>
          <p className="text-gray-600 mt-2">ยืนยันตัวตนและเริ่มใช้งาน</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Email Display */}
          {email && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">บัญชี:</p>
              <p className="font-medium text-gray-900">{email}</p>
              {fullName && <p className="text-sm text-gray-600 mt-1">ชื่อ: {fullName}</p>}
            </div>
          )}

          {error ? (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : isValidToken ? (
            <>
              <form onSubmit={handleSubmit}>
                {/* Password */}
                <div className="mb-4">
                  <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    <Key className="w-4 h-4 inline mr-1" />
                    รหัสผ่าน
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      required
                      disabled={loading}
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">ความแข็งแรงของรหัสผ่าน</span>
                        <span className={`text-xs font-medium ${
                          getPasswordStrength(password).score <= 2 ? 'text-red-600' :
                          getPasswordStrength(password).score === 3 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {getPasswordStrength(password).label}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              level <= getPasswordStrength(password).score
                                ? getPasswordStrength(password).color
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="mb-6">
                  <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    <Check className="w-4 h-4 inline mr-1" />
                    ยืนยันรหัสผ่าน
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && (
                    <div className="mt-1">
                      {password === confirmPassword ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          รหัสผ่านตรงกัน
                        </span>
                      ) : (
                        <span className="text-xs text-red-600">
                          รหัสผ่านไม่ตรงกัน
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading || !password || password !== confirmPassword}
                  className="w-full"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังบันทึก...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Check className="w-4 h-4 mr-2" />
                      ตั้งรหัสผ่าน
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  หลังจากตั้งรหัสผ่านแล้ว คุณจะสามารถเข้าสู่ระบบได้ทันที
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-gray-600 hover:text-gray-700 font-medium"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupPassword;
