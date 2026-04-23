import { useState, useEffect } from 'react';
import { Upload, X, Palette, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { CompanyLogo } from '@/components/company/CompanyLogo';
import {
  getCompanySettings,
  uploadCompanyLogo,
  updateCompanyLogo as updateCompanyLogoApi,
  updateCompanyColors,
  deleteCompanyLogo
} from '@/lib/api/companySettings';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { OwnerGuard, AdminGuard } from '@/components/auth/PermissionGuard';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';

export function LogoSettings() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#374151');
  const [secondaryColor, setSecondaryColor] = useState('#6b7280');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { isOwner, isAdmin } = usePermissions();
  const { currentTenant } = useSimpleAuth();
  const canManage = isOwner || isAdmin;

  useEffect(() => {
    loadSettings();
  }, [currentTenant]);

  const loadSettings = async () => {
    if (!currentTenant?.id) return;
    const settings = await getCompanySettings(currentTenant.id);
    if (settings) {
      setLogoUrl(settings.logo_url);
      setCompanyName(settings.company_name);
      setPrimaryColor(settings.primary_color);
      setSecondaryColor(settings.secondary_color);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canManage || !currentTenant?.id) return;

    setUploading(true);
    try {
      const result = await uploadCompanyLogo(currentTenant.id, file);
      if (result) {
        await updateCompanyLogoApi(currentTenant.id, result);
        setLogoUrl(result.url);

        // Log activity for logo upload
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant.id,
            p_user_id: null,
            p_activity_type: 'company_logo_uploaded',
            p_description: `อัปโหลดโลโก้บริษัท: ${companyName || currentTenant.id}`,
            p_metadata: {
              tenant_id: currentTenant.id,
              company_name: companyName,
              file_name: file.name
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!canManage || !currentTenant?.id) return;
    setUploading(true);
    try {
      await deleteCompanyLogo(currentTenant.id);
      setLogoUrl(null);

      // Log activity for logo deletion
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant.id,
          p_user_id: null,
          p_activity_type: 'company_logo_deleted',
          p_description: `ลบโลโก้บริษัท: ${companyName || currentTenant.id}`,
          p_metadata: {
            tenant_id: currentTenant.id,
            company_name: companyName
          }
        });
      } catch {
        // Ignore log_activity errors
      }
    } catch (error) {
      console.error('Error deleting logo:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveColors = async () => {
    if (!canManage || !currentTenant?.id) return;
    setSaving(true);
    try {
      await updateCompanyColors(currentTenant.id, { primary_color: primaryColor, secondary_color: secondaryColor });
      // Apply colors to CSS variables
      document.documentElement.style.setProperty('--foreground', primaryColor);
      document.documentElement.style.setProperty('--muted-foreground', secondaryColor);

      // Log activity for brand colors update
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant.id,
          p_user_id: null,
          p_activity_type: 'brand_colors_updated',
          p_description: `อัปเดตสีแบรนด์: ${companyName || currentTenant.id}`,
          p_metadata: {
            tenant_id: currentTenant.id,
            company_name: companyName,
            primary_color: primaryColor,
            secondary_color: secondaryColor
          }
        });
      } catch {
        // Ignore log_activity errors
      }
    } catch (error) {
      console.error('Error saving colors:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Palette className="w-5 h-5" />
        ตั้งค่าโลโก้และแบรนด์บริษัท
      </h3>

      {/* Logo Upload Section */}
      <div className="mb-6">
        <Label className="mb-2 block">โลโก้บริษัท</Label>
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <CompanyLogo size="xl" className="border border-border" />
          </div>
          <div className="flex-1 space-y-3">
            {logoUrl && canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteLogo}
                disabled={uploading}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4 mr-2" />
                ลบโลโก้
              </Button>
            )}
            {canManage && (
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  รองรับ: PNG, JPG, GIF (สูงสุด 2MB)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Color Settings */}
      {canManage && (
        <div className="space-y-4">
          <h4 className="font-medium">สีแบรนด์</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primaryColor">สีหลัก (Headings)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="secondaryColor">สีรอง (Paragraphs)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <Button
            onClick={handleSaveColors}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              'บันทึกสีแบรนด์'
            )}
          </Button>
        </div>
      )}

      {/* Preview */}
      <div className="mt-6 p-4 bg-secondary rounded-lg">
        <p className="text-xs text-muted-foreground mb-2">ตัวอย่าง:</p>
        <h4 className="text-lg font-semibold" style={{ color: primaryColor }}>
          หัวข้อหลัก (H1-H6)
        </h4>
        <p style={{ color: secondaryColor }}>
          นี่คือข้อความรอง (paragraphs) แสดงให้เห็นการใช้งานสีทั้งสอง
        </p>
      </div>
    </Card>
  );
}
