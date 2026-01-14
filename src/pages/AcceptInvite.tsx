import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Key, UserPlus, Check, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const AcceptInvite = () => {
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
  const [isSigningUp, setIsSigningUp] = useState(false);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว");
      setTokenChecked(true);
      return;
    }

    // Verify invite token by checking both invite_token and signup_token
    const verifyToken = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .or(`invite_token.eq.${token},signup_token.eq.${token}`)
          .maybeSingle();

        if (error || !data) {
          setError("ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว");
          setTokenChecked(true);
          return;
        }

        // Check if already active
        if (data.is_active) {
          setError("คำเชิญนี้ถูกใช้ไปแล้ว กรุณาเข้าสู่ระบบ");
          setTokenChecked(true);
          return;
        }

        // Check if token has expired
        if (data.signup_expires_at && new Date(data.signup_expires_at) < new Date()) {
          setError("ลิงก์เชิญหมดอายุแล้ว กรุณาขอคำเชิญใหม่");
          setTokenChecked(true);
          return;
        }

        setEmail(data.email);
        setFullName(data.full_name || "");
        setIsValidToken(true);
        setTokenChecked(true);
      } catch (err) {
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
      // Validate password
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

      // Call Edge Function to accept invite and create/set password
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/accept-invite`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteToken: token,
          password: password
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to accept invite');
      }

      // Account created, now sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: password
      });

      if (signInError) {
        console.error('Error signing in after signup:', signInError);
        toast.success("สร้างบัญชีสำเร็จ! กรุณาเข้าสู่ระบบ");
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
        return;
      }

      toast.success("ยินดีต้อนรับ! บัญชีของคุณพร้อมใช้งานแล้ว");

      // Redirect to dashboard
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);

    } catch (error: any) {
      console.error('Error accepting invite:', error);
      setError(error.message || "เกิดข้อผิดพลาดในการยอมรับคำเชิญ");
    } finally {
      setLoading(false);
    }
  };

  if (!tokenChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          <span className="text-gray-600">กำลังตรวจสอบลิงก์...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ยอมรับคำเชิญ</h1>
          <p className="text-gray-600 mt-2">Chateau Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Email Display */}
          {email && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">สำหรับบัญชี:</p>
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
                {/* New Password */}
                <div className="mb-4">
                  <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    <Key className="w-4 h-4 inline mr-1" />
                    ตั้งรหัสผ่าน
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
                      {showPassword ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l4.243-4.243M9 12h.01" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
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
                      {showConfirmPassword ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l4.243-4.243M9 12h.01" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
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
                        <span className="text-xs text-red-600 flex items-center gap-1">
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
                  {loading || isSigningUp ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isSigningUp ? 'กำลังสมัครสมาชิก...' : 'กำลังบันทึก...'}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Check className="w-4 h-4 mr-2" />
                      ยอมรับคำเชิญ & ตั้งรหัสผ่าน
                    </div>
                  )}
                </Button>
              </form>

              {/* Help Text */}
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
            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
