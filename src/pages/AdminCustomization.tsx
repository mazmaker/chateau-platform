import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { AdminGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Palette,
  Image,
  Save,
  RotateCcw,
  Eye,
  CheckCircle,
  Upload
} from 'lucide-react';

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo?: string;
  favicon?: string;
}

interface BrandSettings {
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: string;
}

const AdminCustomization = () => {
  const navigate = useNavigate();
  const { currentTenant, userRole } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Theme settings
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    accentColor: '#10b981'
  });

  // Brand settings
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    name: 'Chateau Platform',
    tagline: 'Property Management System',
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    fontFamily: 'Inter',
    borderRadius: 'medium'
  });

  // Preset color schemes
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
    }
  }, [currentTenant]);

  const fetchThemeSettings = async () => {
    try {
      // Fetch from tenant settings
      const { data } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', currentTenant?.id)
        .single();

      if (data?.settings?.theme) {
        setThemeSettings(data.settings.theme);
      }
      if (data?.settings?.brand) {
        setBrandSettings(data.settings.brand);
      }
    } catch (error) {
      console.error('Error fetching theme settings:', error);
    }
  };

  const handleSaveTheme = async () => {
    setSaving(true);
    setSaved(false);

    try {
      // Save to tenant settings
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

      // Apply theme to document
      applyTheme(themeSettings);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving theme:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrand = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', currentTenant?.id)
        .single();

      const currentSettings = tenantData?.settings || {};
      currentSettings.brand = brandSettings;

      await supabase
        .from('tenants')
        .update({ settings: currentSettings })
        .eq('id', currentTenant?.id);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving brand:', error);
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
    // Apply CSS custom properties
    document.documentElement.style.setProperty('--primary', theme.primaryColor);
    document.documentElement.style.setProperty('--secondary', theme.secondaryColor);
    document.documentElement.style.setProperty('--accent', theme.accentColor);
  };

  // Only Owner and Admin can customize
  if (userRole !== 'owner' && userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Customization Content */}
        <main className="p-6">
          <AdminGuard>
            <div className="space-y-6">
              {/* Page Header */}
              <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ปรับแต่งระบบ (Customization)</h1>
            <p className="text-muted-foreground">
              ปรับแต่งสีและดีไซนของระบบให้เข้ากับแบรนด์บริษัทคุณ
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/properties')}>
              ยกเลิก
            </Button>
          </div>
        </div>

        <Tabs defaultValue="colors" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="colors">
              <Palette className="w-4 h-4 mr-2" />
              สี
            </TabsTrigger>
            <TabsTrigger value="brand">
              <Image className="w-4 h-4 mr-2" />
              แบรนด์
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-2" />
              ตัวอย่าง
            </TabsTrigger>
          </TabsList>

          {/* Color Settings */}
          <TabsContent value="colors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ตั้งค่าสี</CardTitle>
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
                    <Label htmlFor="primaryColor">สีหลัก (Primary)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="primaryColor"
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
                    <Label htmlFor="secondaryColor">สีรอง (Secondary)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="secondaryColor"
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
                    <Label htmlFor="accentColor">สีเน้น (Accent)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="accentColor"
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
          </TabsContent>

          {/* Brand Settings */}
          <TabsContent value="brand" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ตั้งค่าแบรนด์</CardTitle>
                <CardDescription>
                  ปรับแต่งชื่อ และตัวตนของบริษัทคุณ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="brandName">ชื่อบริษัท</Label>
                    <Input
                      id="brandName"
                      value={brandSettings.name}
                      onChange={(e) => setBrandSettings({ ...brandSettings, name: e.target.value })}
                      placeholder="ABC Property Co., Ltd."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">คำขวนการ</Label>
                    <Input
                      id="tagline"
                      value={brandSettings.tagline}
                      onChange={(e) => setBrandSettings({ ...brandSettings, tagline: e.target.value })}
                      placeholder="Your Trusted Real Estate Partner"
                    />
                  </div>
                </div>

                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>โลโก้</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      ลากไฟล์โลโก้มาวางที่นี่ หรือคลิกเพื่ออัปโหลด
                    </p>
                    <Button variant="outline" size="sm">
                      เลือกไฟล์
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    รองรับ PNG, SVG, JPG (สูงสุด 2MB)
                  </p>
                </div>

                {/* Favicon Upload */}
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-muted">
                      <Image className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Button variant="outline" size="sm">
                        เปลี่ยน Favicon
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        ICO, PNG (32x32 หรือ 16x16 pixels)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setBrandSettings({
                      name: 'Chateau Platform',
                      tagline: 'Property Management System',
                      primaryColor: '#3b82f6',
                      secondaryColor: '#8b5cf6',
                      fontFamily: 'Inter',
                      borderRadius: 'medium'
                    })}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    รีเซ็ต
                  </Button>
                  <Button
                    onClick={handleSaveBrand}
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
          </TabsContent>

          {/* Preview */}
          <TabsContent value="preview" className="space-y-6">
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
                  <div
                    className="p-4"
                    style={{ backgroundColor: themeSettings.primaryColor, color: 'white' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold">{brandSettings.name}</h2>
                        <p className="text-sm opacity-80">{brandSettings.tagline}</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/20" />
                        <div className="w-8 h-8 rounded-full bg-white/20" />
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Preview */}
                  <div className="flex">
                    <div className="w-48 bg-muted p-4 space-y-2">
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
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  </main>
</div>
</div>
  );
};

export default AdminCustomization;
