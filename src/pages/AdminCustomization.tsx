import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { AdminGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageTabs } from '@/components/ui/PageTabs';
import type { TabItem } from '@/components/ui/PageTabs';
import {
  Palette,
  Save,
  RotateCcw,
  Eye,
  CheckCircle,
  Upload,
  X,
  Loader2,
  Building2,
  AlertCircle
} from 'lucide-react';
import {
  getCompanySettings,
  uploadCompanyLogo,
  updateCompanyLogo as updateCompanyLogoApi,
  updateCompanyColors,
  deleteCompanyLogo
} from '@/lib/api/companySettings';
import { notifyLogoUpdated } from '@/components/company/CompanyLogo';

// File validation constants
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg'];
const RECOMMENDED_SIZE = 400; // 400x400 px

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const AdminCustomization = () => {
  const navigate = useNavigate();
  const { currentTenant, userRole } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('logo-brand');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // For Owner: all tenants, For Admin: only their tenant
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Theme settings
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    accentColor: '#10b981'
  });

  // Company Logo & Brand settings
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#676AF1');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#38B6FFCC');
  const [uploading, setUploading] = useState(false);

  // Preset color schemes for Theme
  const colorPresets = [
    { name: 'Default (Blue)', primary: '#3b82f6', secondary: '#8b5cf6', accent: '#10b981' },
    { name: 'Ocean', primary: '#06b6d4', secondary: '#0ea5e9', accent: '#14b8a6' },
    { name: 'Sunset', primary: '#f97316', secondary: '#ef4444', accent: '#eab308' },
    { name: 'Forest', primary: '#22c55e', secondary: '#16a34a', accent: '#84cc16' },
    { name: 'Berry', primary: '#ec4899', secondary: '#d946ef', accent: '#f43f5e' },
    { name: 'Royal', primary: '#6366f1', secondary: '#4f46e5', accent: '#8b5cf6' },
    { name: 'Earth', primary: '#a3a3a3', secondary: '#737373', accent: '#a1a1aa' },
    { name: 'Emerald', primary: '#10b981', secondary: '#059669', accent: '#34d399' }
  ];

  useEffect(() => {
    if (currentTenant) {
      fetchThemeSettings();
      // Initialize selected tenant
      setSelectedTenantId(currentTenant.id);
    }

    // Fetch all tenants if Owner
    if (userRole === 'owner') {
      fetchAllTenants();
    }
  }, [currentTenant, userRole]);

  // Fetch all tenants (for Owner only)
  const fetchAllTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .order('name');

      if (!error && data) {
        setAllTenants(data);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  // Fetch company logo settings for selected tenant
  const fetchCompanyLogoSettings = async (tenantId: string) => {
    try {
      const settings = await getCompanySettings(tenantId);
      if (settings) {
        setLogoUrl(settings.logo_url);
        setCompanyName(settings.company_name);
        setBrandPrimaryColor(settings.primary_color);
        setBrandSecondaryColor(settings.secondary_color);
      }
    } catch (error) {
      console.error('Error fetching company logo settings:', error);
    }
  };

  // When selected tenant changes
  useEffect(() => {
    if (selectedTenantId) {
      fetchCompanyLogoSettings(selectedTenantId);
    }
  }, [selectedTenantId]);

  const fetchThemeSettings = async () => {
    try {
      const { data } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', currentTenant?.id)
        .single();

      if (data?.settings?.theme) {
        setThemeSettings(data.settings.theme);
      }
    } catch (error) {
      console.error('Error fetching theme settings:', error);
    }
  };

  const handleSaveTheme = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', currentTenant?.id)
        .single();

      const currentSettings = tenantData?.settings || {};
      currentSettings.theme = themeSettings;

      await supabase
        .from('tenants')
        .update({ settings: currentSettings })
        .eq('id', currentTenant?.id);

      applyTheme(themeSettings);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving theme:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetTheme = () => {
    const defaultTheme = colorPresets[0];
    setThemeSettings({
      primaryColor: defaultTheme.primary,
      secondaryColor: defaultTheme.secondary,
      accentColor: defaultTheme.accent
    });
  };

  const applyPreset = (preset: typeof colorPresets[0]) => {
    setThemeSettings({
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent
    });
  };

  const applyTheme = (theme: ThemeSettings) => {
    document.documentElement.style.setProperty('--primary', theme.primaryColor);
    document.documentElement.style.setProperty('--secondary', theme.secondaryColor);
    document.documentElement.style.setProperty('--accent', theme.accentColor);
  };

  // Company Logo handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTenantId) return;

    // Validate file extension first
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(`รองรับเฉพาะไฟล์ ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} เท่านั้น`);
      return;
    }
    setFileError(null);

    setUploading(true);
    try {
      const result = await uploadCompanyLogo(selectedTenantId, file);
      if (result) {
        await updateCompanyLogoApi(selectedTenantId, {
          logo_url: result.url,
          logo_storage_path: result.path
        });
        setLogoUrl(result.url);
        // Notify all CompanyLogo components to refresh
        notifyLogoUpdated();
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      setFileError('อัปโหลดโลโก้ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!selectedTenantId) return;
    setUploading(true);
    try {
      await deleteCompanyLogo(selectedTenantId);
      setLogoUrl(null);
      // Notify all CompanyLogo components to refresh
      notifyLogoUpdated();
    } catch (error) {
      console.error('Error deleting logo:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveBrandColors = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    try {
      await updateCompanyColors(selectedTenantId, {
        primary_color: brandPrimaryColor,
        secondary_color: brandSecondaryColor
      });
      document.documentElement.style.setProperty('--foreground', brandPrimaryColor);
      document.documentElement.style.setProperty('--muted-foreground', brandSecondaryColor);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving company colors:', error);
    } finally {
      setSaving(false);
    }
  };

  // Only Owner and Admin can customize
  if (userRole !== 'owner' && userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </div>
    );
  }

  // Define tabs
  const tabs: TabItem[] = [
    { id: 'logo-brand', label: 'โลโก้และแบรนด์', icon: Building2 },
    { id: 'theme', label: 'ธีมระบบ', icon: Palette },
    { id: 'preview', label: 'ตัวอย่าง', icon: Eye },
  ];

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content */}
        <div className="lg:ml-[260px] min-h-screen">
          {/* Header */}
          <Header onMenuClick={() => setSidebarOpen(true)} />

          {/* Page Content */}
          <main className="p-6">
            <div className="space-y-6">
              {/* Page Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">ตั้งค่าระบบ (Settings)</h1>
                  <p className="text-muted-foreground">
                    ปรับแต่งโลโก้ สี และดีไซน์ของระบบให้เข้ากับแบรนด์บริษัทคุณ
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Left Sidebar - Tabs */}
                <div className="w-full md:w-56">
                  <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
                </div>

                {/* Right Content */}
                <div className="flex-1">
                  {/* Logo & Brand Settings */}
                  {activeTab === 'logo-brand' && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            ตั้งค่าโลโก้และแบรนด์บริษัท
                          </CardTitle>
                          <CardDescription>
                            {userRole === 'owner'
                              ? 'เลือกบริษัทและอัปโหลดโลโก้ ปรับแต่งสีแบรนด์'
                              : 'อัปโหลดโลโก้และปรับแต่งสีแบรนด์ของบริษัทคุณ'
                            }
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                {/* Company Selector (Owner only) */}
                {userRole === 'owner' && allTenants.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="tenantSelect">เลือกบริษัท</Label>
                    <select
                      id="tenantSelect"
                      value={selectedTenantId || ''}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="w-full max-w-xs px-3 py-2 border rounded-md bg-background"
                    >
                      {allTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Logo Upload Section */}
                <div className="space-y-3">
                  <Label>โลโก้บริษัท</Label>
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      {selectedTenantId && (
                        <div className="w-24 h-24 border border-border rounded-lg flex items-center justify-center bg-muted">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={companyName || 'Company Logo'}
                              className="w-full h-full object-contain rounded-lg"
                              onError={() => setLogoUrl(null)}
                            />
                          ) : (
                            <Building2 className="w-12 h-12 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      {logoUrl && (
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
                      <div>
                        <Input
                          type="file"
                          accept=".png,.jpg,.jpeg"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          className="max-w-xs"
                        />
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            รองรับ: PNG, JPG (สูงสุด 500KB)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ขนาดแนะนำ: {RECOMMENDED_SIZE}x{RECOMMENDED_SIZE} px
                          </p>
                        </div>
                      </div>
                      {fileError && (
                        <div className="flex items-center gap-2 text-destructive text-sm">
                          <AlertCircle className="w-4 h-4" />
                          {fileError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Brand Colors */}
                <div className="space-y-4">
                  <h4 className="font-medium">สีแบรนด์</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="brandPrimaryColor">สีหลัก (Primary)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="brandPrimaryColor"
                          type="color"
                          value={brandPrimaryColor}
                          onChange={(e) => setBrandPrimaryColor(e.target.value)}
                          className="w-16 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={brandPrimaryColor}
                          onChange={(e) => setBrandPrimaryColor(e.target.value)}
                          className="flex-1 font-mono text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="brandSecondaryColor">สีรอง (Secondary)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="brandSecondaryColor"
                          type="color"
                          value={brandSecondaryColor}
                          onChange={(e) => setBrandSecondaryColor(e.target.value)}
                          className="w-16 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={brandSecondaryColor}
                          onChange={(e) => setBrandSecondaryColor(e.target.value)}
                          className="flex-1 font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-4 bg-secondary rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">ตัวอย่าง:</p>
                    <h4 className="text-lg font-semibold" style={{ color: brandPrimaryColor }}>
                      หัวข้อหลัก (H1-H6)
                    </h4>
                    <p style={{ color: brandSecondaryColor }}>
                      นี่คือข้อความรอง (paragraphs) แสดงให้เห็นการใช้งานสีทั้งสอง
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveBrandColors}
                    disabled={saving || uploading}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : saved ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        บันทึกแล้ว
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        บันทึกสีแบรนด์
                      </>
                    )}
                  </Button>
                </div>

                {/* Current company info */}
                {companyName && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      บริษัท: <span className="font-medium text-foreground">{companyName}</span>
                    </p>
                  </div>
                )}

                {/* Info banner */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>หมายเหตุ:</strong> โลโก้ที่อัปโหลดจะแสดงที่ Header และ Sidebar ของระบบ
                  </p>
                </div>
              </CardContent>
            </Card>
                    </>
                  )}

                  {/* Theme Settings */}
                  {activeTab === 'theme' && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle>ตั้งค่าธีมระบบ</CardTitle>
                          <CardDescription>
                            เลือกโทนสีหลักของระบบ หรือเลือกจาก Preset ที่เตรียมไว้
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Preset Colors */}
                          <div>
                            <Label>สีที่เตรียมไว้ (Presets)</Label>
                            <div className="grid grid-cols-4 gap-3 mt-2">
                              {colorPresets.map((preset) => (
                                <button
                                  key={preset.name}
                                  onClick={() => applyPreset(preset)}
                                  className="group relative p-3 rounded-lg border-2 border-transparent hover:border-gray-300 transition-all"
                                >
                                  <div className="flex gap-1 mb-2">
                                    <div
                                      className="w-6 h-6 rounded-full"
                                      style={{ backgroundColor: preset.primary }}
                                    />
                                    <div
                                      className="w-6 h-6 rounded-full"
                                      style={{ backgroundColor: preset.secondary }}
                                    />
                                    <div
                                      className="w-6 h-6 rounded-full"
                                      style={{ backgroundColor: preset.accent }}
                                    />
                                  </div>
                                  <p className="text-xs text-center">{preset.name}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Custom Colors */}
                          <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="themePrimary">สีหลัก (Primary)</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  id="themePrimary"
                                  value={themeSettings.primaryColor}
                                  onChange={(e) => setThemeSettings({ ...themeSettings, primaryColor: e.target.value })}
                                  className="w-12 h-12 rounded cursor-pointer border-0"
                                />
                                <Input
                                  value={themeSettings.primaryColor}
                                  onChange={(e) => setThemeSettings({ ...themeSettings, primaryColor: e.target.value })}
                                  placeholder="#3b82f6"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="themeSecondary">สีรอง (Secondary)</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  id="themeSecondary"
                                  value={themeSettings.secondaryColor}
                                  onChange={(e) => setThemeSettings({ ...themeSettings, secondaryColor: e.target.value })}
                                  className="w-12 h-12 rounded cursor-pointer border-0"
                                />
                                <Input
                                  value={themeSettings.secondaryColor}
                                  onChange={(e) => setThemeSettings({ ...themeSettings, secondaryColor: e.target.value })}
                                  placeholder="#8b5cf6"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="themeAccent">สีเน้น (Accent)</Label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  id="themeAccent"
                                  value={themeSettings.accentColor}
                                  onChange={(e) => setThemeSettings({ ...themeSettings, accentColor: e.target.value })}
                                  className="w-12 h-12 rounded cursor-pointer border-0"
                                />
                                <Input
                                  value={themeSettings.accentColor}
                                  onChange={(e) => setThemeSettings({ ...themeSettings, accentColor: e.target.value })}
                                  placeholder="#10b981"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Preview of current theme */}
                          <div className="border rounded-lg p-4">
                            <Label className="mb-3">ตัวอย่าง</Label>
                            <div
                              className="p-4 rounded-lg"
                              style={{
                                backgroundColor: themeSettings.primaryColor,
                                color: 'white'
                              }}
                            >
                              <p className="font-medium mb-2">Primary Color - หัวข้อ</p>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <div
                                className="flex-1 p-3 rounded text-center text-white"
                                style={{ backgroundColor: themeSettings.secondaryColor }}
                              >
                                Secondary
                              </div>
                              <div
                                className="flex-1 p-3 rounded text-center text-white"
                                style={{ backgroundColor: themeSettings.accentColor }}
                              >
                                Accent
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              onClick={handleResetTheme}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              รีเซ็ตเป็นค่าเริ่มต้น
                            </Button>
                            <Button
                              onClick={handleSaveTheme}
                              disabled={saving}
                            >
                              {saving ? (
                                <>กำลังบันทึก...</>
                              ) : saved ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  บันทึกแล้ว
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  บันทึก
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* Preview */}
                  {activeTab === 'preview' && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle>ตัวอย่างหน้าจอ</CardTitle>
                          <CardDescription>
                            ดูตัวอย่างหน้าจอด้วยธีมที่เลือก
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="border rounded-lg overflow-hidden">
                            {/* Header Preview */}
                            <div className="p-4 flex items-center gap-4" style={{ backgroundColor: themeSettings.primaryColor }}>
                              {logoUrl ? (
                                <img
                                  src={logoUrl}
                                  alt="Logo"
                                  className="w-10 h-10 object-contain rounded-lg bg-white"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                  <Building2 className="w-6 h-6 text-white" />
                                </div>
                              )}
                              <div className="text-white">
                                <h2 className="text-xl font-bold">{companyName || 'Company Name'}</h2>
                                <p className="text-sm opacity-80">Dashboard</p>
                              </div>
                              <div className="ml-auto flex gap-2">
                                <div className="w-8 h-8 rounded-full bg-white/20" />
                                <div className="w-8 h-8 rounded-full bg-white/20" />
                              </div>
                            </div>

                            {/* Sidebar Preview */}
                            <div className="flex">
                              <div className="w-48 bg-muted p-4 space-y-2">
                                {logoUrl ? (
                                  <div className="flex items-center gap-3 mb-4">
                                    <img
                                      src={logoUrl}
                                      alt="Logo"
                                      className="w-10 h-10 object-contain rounded-lg"
                                    />
                                    <span className="font-medium">{companyName || 'Company'}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-muted-foreground/10 rounded-lg flex items-center justify-center">
                                      <Building2 className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <span className="font-medium">{companyName || 'Company'}</span>
                                  </div>
                                )}
                                <div
                                  className="p-2 rounded text-white text-sm"
                                  style={{ backgroundColor: themeSettings.secondaryColor }}
                                >
                                  Dashboard
                                </div>
                                <div className="p-2 rounded text-sm text-muted-foreground">
                                  Properties
                                </div>
                                <div className="p-2 rounded text-sm text-muted-foreground">
                                  Leads
                                </div>
                                <div className="p-2 rounded text-sm text-muted-foreground">
                                  Settings
                                </div>
                              </div>
                              <div className="flex-1 p-4 space-y-4">
                                {/* Card Preview */}
                                <div className="border rounded-lg p-4">
                                  <h3 className="font-medium mb-2">Statistics</h3>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                      <div
                                        className="text-2xl font-bold"
                                        style={{ color: themeSettings.primaryColor }}
                                      >
                                        24
                                      </div>
                                      <p className="text-xs text-muted-foreground">Leads</p>
                                    </div>
                                    <div className="text-center">
                                      <div
                                        className="text-2xl font-bold"
                                        style={{ color: themeSettings.secondaryColor }}
                                      >
                                        12
                                      </div>
                                      <p className="text-xs text-muted-foreground">Active</p>
                                    </div>
                                    <div className="text-center">
                                      <div
                                        className="text-2xl font-bold"
                                        style={{ color: themeSettings.accentColor }}
                                      >
                                        8
                                      </div>
                                      <p className="text-xs text-muted-foreground">Closed</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Button Preview */}
                                <div className="flex gap-2">
                                  <div
                                    className="px-4 py-2 rounded text-white text-sm"
                                    style={{ backgroundColor: themeSettings.primaryColor }}
                                  >
                                    Primary Button
                                  </div>
                                  <div
                                    className="px-4 py-2 rounded text-white text-sm"
                                    style={{ backgroundColor: themeSettings.secondaryColor }}
                                  >
                                    Secondary
                                  </div>
                                  <div
                                    className="px-4 py-2 rounded text-white text-sm"
                                    style={{ backgroundColor: themeSettings.accentColor }}
                                  >
                                    Accent
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default AdminCustomization;
