import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { captureReferralFromUrl } from '@/lib/referralCode';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `return` param sent by anon visitors who tried a gated action (e.g. "ฉันสนใจ")
  // on a public page. After successful login we bounce them back so they don't lose
  // their browsing context. Restricted to /customer/* paths to prevent open-redirect.
  const rawReturn = searchParams.get('return');
  const returnTo = rawReturn && rawReturn.startsWith('/customer/') && !rawReturn.includes('//')
    ? rawReturn
    : '/customer';
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Capture ?ref=AG-2026-NNN if customer arrived here via an Agent link
  // (either landed directly on /customer/login?ref=... or was bounced from a
  // protected route that preserved the query string). Stored silently in
  // sessionStorage; read back when the customer creates their first lead.
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

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
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      console.error('Customer login error:', err);
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50/40 via-white to-rose-50/30 flex items-center justify-center p-4">
      {/* Subtle decorative bg accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[640px] h-[640px] bg-rose-100/30 rounded-full blur-3xl -z-10" aria-hidden />

      <div className="w-full max-w-md relative">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4 rounded-2xl bg-white shadow-lg shadow-rose-200/60 overflow-hidden p-2">
            <img
              src="https://pqnjvcbmnatrtvpqnrdx.supabase.co/storage/v1/object/public/company-logos/00000000-0000-0000-0000-000000000001/1766926562152.png"
              alt="CHATEAU"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[13px] text-gray-500 mt-1 tracking-wide">ค้นหาบ้านที่ใช่ สำหรับคุณ</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-rose-100/60 shadow-xl shadow-rose-100/40 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1.5">ยินดีต้อนรับ</h2>
          <p className="text-sm text-gray-500 mb-7">เข้าสู่ระบบเพื่อเริ่มหาบ้านในฝัน</p>

          <form onSubmit={handlePhoneLogin}>
            <Label htmlFor="phone" className="block text-xs font-semibold text-gray-700 mb-2 tracking-wide">
              เบอร์โทรศัพท์
            </Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0xx-xxx-xxxx"
                required
                disabled={loading}
                className="h-12 pl-11 text-base tracking-wider rounded-xl border-gray-200 focus-visible:ring-rose-300 focus-visible:border-rose-300"
                autoFocus
                inputMode="tel"
              />
            </div>

            {error && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-5 h-12 text-base font-semibold rounded-xl text-white shadow-md shadow-rose-200/60 hover:shadow-lg hover:shadow-rose-200 active:scale-[0.99] transition-all border-0"
              style={{ background: 'linear-gradient(135deg, #e60023 0%, #c4001f 100%)' }}
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
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-[11px] uppercase tracking-widest text-gray-400">หรือ</span>
            </div>
          </div>

          {/* LINE Login */}
          <button
            type="button"
            onClick={handleLineLogin}
            className="w-full h-12 rounded-xl bg-[#06C755] hover:bg-[#05B14B] active:scale-[0.99] text-white font-semibold flex items-center justify-center gap-2.5 shadow-md shadow-green-200/60 hover:shadow-lg hover:shadow-green-200 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            เข้าสู่ระบบด้วย LINE
          </button>

          <p className="text-[11px] text-center text-gray-400 mt-6 leading-relaxed">
            การเข้าสู่ระบบหมายถึงคุณยอมรับ<br />
            <a href="#" className="text-rose-600 hover:underline">เงื่อนไขการใช้งาน</a> และ <a href="#" className="text-rose-600 hover:underline">นโยบายความเป็นส่วนตัว</a>
          </p>
        </div>

      </div>
    </div>
  );
};

export default CustomerLogin;
