import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const CustomerLineCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchange = async () => {
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');

      if (errorParam) {
        setError(`LINE ปฏิเสธการเข้าสู่ระบบ: ${params.get('error_description') || errorParam}`);
        return;
      }
      if (!code) {
        setError('ไม่พบ code จาก LINE');
        return;
      }
      // CSRF state check
      const expectedState = sessionStorage.getItem('line_oauth_state');
      sessionStorage.removeItem('line_oauth_state');
      if (!expectedState || state !== expectedState) {
        setError('State ไม่ตรง — อาจถูกแทรกแซง กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${supabaseUrl}/functions/v1/customer-line-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
        }
        const { error: setErr } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        if (setErr) throw setErr;

        toast.success(result.isNew ? 'ยินดีต้อนรับสู่ Chateau' : `สวัสดี ${result.full_name || 'คุณ'}`);
        navigate('/customer', { replace: true });
      } catch (err: any) {
        console.error('LINE callback error:', err);
        setError(err.message || 'เกิดข้อผิดพลาด');
      }
    };
    exchange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {error ? (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-7">
            <div className="w-14 h-14 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">เข้าสู่ระบบ LINE ไม่สำเร็จ</h2>
            <p className="text-sm text-gray-600 mb-5">{error}</p>
            <button
              onClick={() => navigate('/customer/login', { replace: true })}
              className="px-5 py-2 bg-chateau hover:bg-chateau-700 text-white font-medium rounded-md transition-colors"
            >
              ← กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
            <Loader2 className="w-10 h-10 text-[#06C755] animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">กำลังเข้าสู่ระบบด้วย LINE...</h2>
            <p className="text-sm text-gray-500 mt-2">โปรดรอสักครู่</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerLineCallback;
