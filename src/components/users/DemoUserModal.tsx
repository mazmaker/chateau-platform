import { useState } from "react";
import { X, UserPlus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/lib/database-types";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface DemoUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Demo user templates with Thai names
const DEMO_USER_TEMPLATES = [
  {
    fullName: "สมชาย ใจดี",
    email: "somchai.demo@example.com",
    role: UserRole.ADMIN,
    avatar: "SC"
  },
  {
    fullName: "วิภาดา รักษ์ดี",
    email: "wipada.demo@example.com",
    role: UserRole.SALES,
    avatar: "WR"
  },
  {
    fullName: "ปิติ มั่งมี",
    email: "piti.demo@example.com",
    role: UserRole.SALES,
    avatar: "PM"
  },
  {
    fullName: "นภา สุขใจ",
    email: "napa.demo@example.com",
    role: UserRole.ADMIN,
    avatar: "NS"
  },
  {
    fullName: "กิตติ เก่งกาจ",
    email: "kitti.demo@example.com",
    role: UserRole.SALES,
    avatar: "KG"
  }
];

const DemoUserModal = ({ isOpen, onClose, onSuccess }: DemoUserModalProps) => {
  const [creating, setCreating] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set());
  const { currentTenant, supabase } = useSimpleAuth();

  const toggleTemplate = (index: number) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTemplates(newSelected);
  };

  const createDemoUser = async (template: typeof DEMO_USER_TEMPLATES[0]) => {
    const tempPassword = "Demo123456!"; // Default password for demo users

    try {
      // Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: `${template.fullName.replace(/\s/g, '').toLowerCase()}${Date.now()}@demo.local`,
        password: tempPassword,
        options: {
          data: {
            full_name: template.fullName,
            is_demo_user: true
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: template.email,
          full_name: template.fullName,
          tenant_id: currentTenant?.id,
          role: template.role,
          is_active: true,
          created_at: new Date().toISOString()
        });

      if (userError) throw userError;

      return { success: true, user: authData.user };
    } catch (error) {
      console.error('Error creating demo user:', error);
      return { success: false, error };
    }
  };

  const handleCreateDemoUsers = async () => {
    if (selectedTemplates.size === 0) {
      toast.error('กรุณาเลือกผู้ใช้อย่างน้อย 1 คน');
      return;
    }

    setCreating(true);

    try {
      const promises = Array.from(selectedTemplates).map(index =>
        createDemoUser(DEMO_USER_TEMPLATES[index])
      );

      const results = await Promise.all(promises);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        toast.success(`สร้างบัญชีทดสอบสำเร็จ ${successCount} บัญชี`);

        // Log activity for demo user creation
        try {
          const createdUsers = results
            .filter((r, i) => r.success)
            .map((r, i) => {
              const templateIndex = Array.from(selectedTemplates)[results.filter((rr, ii) => ii <= i && rr.success).length - 1];
              return DEMO_USER_TEMPLATES[templateIndex];
            });

          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant?.id,
            p_user_id: null,
            p_activity_type: 'demo_users_created',
            p_description: `สร้างบัญชีทดสอบ ${successCount} บัญชี`,
            p_metadata: {
              tenant_id: currentTenant?.id,
              users_created: successCount,
              users_failed: failCount,
              user_names: createdUsers.map(u => u.fullName)
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      }

      if (failCount > 0) {
        toast.error(`สร้างบัญชีไม่สำเร็จ ${failCount} บัญชี`);
      }

      if (successCount > 0) {
        onSuccess();
        handleClose();
      }
    } catch (error) {
      console.error('Error creating demo users:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างบัญชีทดสอบ');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateAll = async () => {
    setSelectedTemplates(new Set(DEMO_USER_TEMPLATES.map((_, i) => i)));
    await handleCreateDemoUsers();
  };

  const handleClose = () => {
    if (!creating) {
      setSelectedTemplates(new Set());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-900 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">สร้างบัญชีทดสอบ</h2>
              <p className="text-sm text-gray-600">สร้างผู้ใช้จำลองสำหรับทดสอบระบบ</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={creating}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Info Box */}
          <div className="mb-6 p-4 bg-chateau-50 border border-chateau-100 rounded-xl">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-chateau flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-chateau-700">บัญชีทดสอบสำหรับการพัฒนา</p>
                <p className="text-xs text-chateau-600 mt-1">
                  บัญชีเหล่านี้สร้างขึ้นโดยอัตโนมัติ ใช้รหัสผ่าน: <code className="bg-chateau-100 px-1 rounded">Demo123456!</code>
                </p>
              </div>
            </div>
          </div>

          {/* Demo User Templates */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">เลือกผู้ใช้ทดสอบ:</h3>

            {DEMO_USER_TEMPLATES.map((template, index) => {
              const roleColors = {
                [UserRole.OWNER]: "bg-gray-100 text-gray-700 border-gray-300",
                [UserRole.ADMIN]: "bg-gray-100 text-gray-700 border-blue-300",
                [UserRole.SALES]: "bg-green-100 text-green-800 border-green-300"
              };

              const roleLabels = {
                [UserRole.OWNER]: "เจ้าของ",
                [UserRole.ADMIN]: "แอดมิน",
                [UserRole.SALES]: "พนักงานขาย"
              };

              return (
                <div
                  key={index}
                  onClick={() => toggleTemplate(index)}
                  className={`
                    flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${selectedTemplates.has(index)
                      ? 'border-purple-500 bg-white shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                    }
                  `}
                >
                  {/* Checkbox */}
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    ${selectedTemplates.has(index)
                      ? 'bg-white shadow-sm0 border-purple-500'
                      : 'border-gray-300'
                    }
                  `}>
                    {selectedTemplates.has(index) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-white font-semibold">
                    {template.avatar}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{template.fullName}</p>
                    <p className="text-sm text-gray-500">{template.email}</p>
                  </div>

                  {/* Role Badge */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[template.role]}`}>
                    {roleLabels[template.role]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={creating}
            className="flex-1"
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleCreateDemoUsers}
            disabled={creating || selectedTemplates.size === 0}
            className="flex-1 bg-gray-900 hover:bg-black text-white"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                สร้าง {selectedTemplates.size} บัญชี
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={handleCreateAll}
            disabled={creating}
            variant="secondary"
            className="px-4"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            สร้างทั้งหมด
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DemoUserModal;
