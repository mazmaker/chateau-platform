import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLineLogin = () => {
    // LINE Channel ID is public — safe to expose in frontend.
    // Set VITE_LINE_CHANNEL_ID in your .env to enable this button.
    const channelId = import.meta.env.VITE_LINE_CHANNEL_ID;
    if (!channelId) {
      toast.error('ระบบ LINE Login ยังไม่ได้ตั้งค่า — กรุณาติดต่อผู้ดูแลระบบ');
      return;
    }
    // CSRF state — verified on callback
    const state = crypto.randomUUID();
    sessionStorage.setItem('line_oauth_state', state);
    const callbackUrl = `${window.location.origin}/customer/line-callback`;
    const authUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', channelId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'profile openid');
    window.location.href = authUrl.toString();
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/customer-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      }

      // Persist Supabase session manually
      const { error: setErr } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (setErr) throw setErr;

      toast.success(result.isNew ? 'ยินดีต้อนรับสู่ Chateau' : `สวัสดี ${result.full_name || 'คุณ'}`);
      navigate('/customer', { replace: true });
    } catch (err: any) {
      console.error('Customer login error:', err);
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-chateau rounded-2xl mb-4 shadow-md shadow-chateau/20">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">CHATEAU</h1>
          <p className="text-sm text-gray-500 mt-1">Customer Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">ยินดีต้อนรับ 👋</h2>
          <p className="text-sm text-gray-500 mb-6">ใส่เบอร์โทรเพื่อเข้าสู่ระบบ</p>

          {/* Dev mode notice */}
          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
            <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-semibold mb-0.5">โหมดทดสอบ</p>
              <p>ลอง <code className="bg-white px-1 rounded text-amber-700 font-mono">0123456789</code> เพื่อเข้าเป็นคุณสมชาย — ระบบยังไม่ได้ใช้ OTP จริง</p>
            </div>
          </div>

          <form onSubmit={handlePhoneLogin}>
            <Label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              เบอร์โทรศัพท์
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0xx-xxx-xxxx"
              required
              disabled={loading}
              className="text-lg tracking-wider"
              autoFocus
              inputMode="tel"
            />

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-5 h-11 text-base bg-chateau hover:bg-chateau-700 text-white"
              disabled={loading || phone.replace(/\D/g, '').length < 9}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังเข้าสู่ระบบ...</>
              ) : (
                <>เข้าสู่ระบบ <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-400">หรือ</span>
            </div>
          </div>

          {/* LINE Login */}
          <button
            type="button"
            onClick={handleLineLogin}
            className="w-full h-11 rounded-md bg-[#06C755] hover:bg-[#05B14B] active:scale-[0.99] text-white font-medium flex items-center justify-center gap-2 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            เข้าสู่ระบบด้วย LINE
          </button>

          <p className="text-xs text-center text-gray-400 mt-5">
            การเข้าสู่ระบบหมายถึงคุณยอมรับ <a href="#" className="text-chateau hover:underline">เงื่อนไขการใช้งาน</a> และ <a href="#" className="text-chateau hover:underline">นโยบายความเป็นส่วนตัว</a>
          </p>
        </div>

        {/* Back to main app */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/auth/login')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← เป็นพนักงาน? เข้าสู่ระบบที่นี่
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerLogin;
