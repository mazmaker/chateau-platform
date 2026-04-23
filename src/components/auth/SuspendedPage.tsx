import { AlertCircle, Lock, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';

const SuspendedPage = () => {
  const { currentTenant, signOut } = useSimpleAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-lg border-orange-200">
        <CardHeader className="text-center pb-4">
          <div className="w-20 h-20 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl text-orange-900">บริษัทถูกระงับชั่วคราว</CardTitle>
          <CardDescription className="text-orange-700">
            ขณะนี้บริษัทของคุณถูกระงับการใช้งานชั่วคราว
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Alert Message */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-1">เนื่องจากหนึ่งในเหตุผลต่อไปนี้:</p>
                <ul className="list-disc list-inside space-y-1 text-orange-700">
                  <li>ค้างชำระค่าบริการเกินกำหนด</li>
                  <li>การใช้งานไม่ตรงตามเงื่อนไขบริการ</li>
                  <li>ต้องการตรวจสอบข้อมูลเพิ่มเติม</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Company Info */}
          {currentTenant && (
            <div className="border border-orange-200 rounded-lg p-4 bg-white">
              <p className="text-sm text-gray-600 mb-1">บริษัท:</p>
              <p className="font-semibold text-gray-900">{currentTenant.name}</p>
            </div>
          )}

          {/* Contact Info */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-3">ติดต่อเราเพื่อแก้ไขปัญหา:</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="w-4 h-4" />
                <a href="mailto:support@chateau.platform" className="hover:underline">
                  support@chateau.platform
                </a>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4" />
                <a href="tel:02-123-4567" className="hover:underline">
                  02-123-4567
                </a>
              </div>
            </div>
          </div>

          {/* Data Assurance */}
          <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <p className="flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              <span>ข้อมูลทั้งหมดของคุณยังคงอยู่อย่างปลอดภัย</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.location.href = 'https://chateau.platform/contact'}
            >
              ติดต่อทีมงาน
            </Button>
            <Button
              variant="default"
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={handleSignOut}
            >
              ออกจากระบบ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuspendedPage;
