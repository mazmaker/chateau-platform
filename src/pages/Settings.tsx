import { useState, useEffect, useRef, useMemo } from 'react';
import { User, Mail, Phone, Lock, Bell, Globe, Camera, Shield, Loader2, ArrowLeft, Eye, EyeOff, Check, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { PageTabs } from '@/components/ui/PageTabs';

// Password strength levels
type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number;
  rules: {
    minLength: boolean;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, userProfile, refreshUser, currentTenant } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Push notification permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'not-supported'>('not-supported');

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Preferences state
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    language: 'th'
  });

  // Load user data on mount
  useEffect(() => {
    if (userProfile) {
      setProfileData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
      });
    }
  }, [userProfile]);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);

      // Listen for permission changes
      const handlePermissionChange = () => {
        setNotificationPermission(Notification.permission);
      };

      // Add event listener for permission changes (Chrome/Edge)
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' }).then((permissionStatus) => {
          permissionStatus.addEventListener('change', handlePermissionChange);
          return () => {
            permissionStatus.removeEventListener('change', handlePermissionChange);
          };
        }).catch(() => {
          // Fallback: just set initial permission
        });
      }
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('เบราว์เซอร์ของคุณไม่รองรับการแจ้งเตือน');
      return;
    }

    if (Notification.permission === 'granted') {
      // If already granted, turn off
      toast.info('การแจ้งเตือนถูกปิดใช้งานแล้ว');
      setPreferences({ ...preferences, pushNotifications: false });
      return;
    }

    if (Notification.permission === 'denied') {
      toast.error('การแจ้งเตือนถูกบล็อก กรุณาไปที่การตั้งค่าเบราว์เซอร์เพื่อเปิดใช้งาน');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        setPreferences({ ...preferences, pushNotifications: true });
        toast.success('เปิดใช้งานการแจ้งเตือนสำเร็จ');

        // Show a test notification
        new Notification('CHATEAU Platform', {
          body: 'การแจ้งเตือนพร้อมใช้งานแล้ว',
          icon: '/vite.svg',
        });
      } else if (permission === 'denied') {
        setPreferences({ ...preferences, pushNotifications: false });
        toast.error('การแจ้งเตือนถูกปฏิเสธ');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('ไม่สามารถขอสิทธิ์การแจ้งเตือนได้');
    }
  };

  // Password strength checker
  const checkPasswordStrength = (password: string): PasswordStrengthResult => {
    const rules = {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const passedRules = Object.values(rules).filter(Boolean).length;
    let score = 0;
    let strength: PasswordStrength = 'weak';

    if (passedRules === 5) {
      score = 100;
      strength = 'very-strong';
    } else if (passedRules === 4) {
      score = 75;
      strength = 'strong';
    } else if (passedRules === 3) {
      score = 50;
      strength = 'medium';
    } else if (passedRules === 2) {
      score = 25;
      strength = 'weak';
    } else {
      score = 0;
      strength = 'weak';
    }

    return { strength, score, rules };
  };

  // Calculate password strength in real-time
  const passwordStrength = useMemo(() => {
    return checkPasswordStrength(passwordData.newPassword);
  }, [passwordData.newPassword]);

  const tabs = [
    { id: 'profile', label: 'โปรไฟล์', icon: User },
    { id: 'security', label: 'ความปลอดภัย', icon: Shield },
    { id: 'preferences', label: 'การแจ้งเตือน', icon: Bell },
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update users table
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Update auth metadata as well
      await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          phone: profileData.phone
        }
      });

      // Refresh user data
      await refreshUser();

      toast.success('บันทึกข้อมูลโปรไฟล์สำเร็จ');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('กรุณาอัปโหลดไฟล์ JPG, PNG, GIF หรือ WebP เท่านั้น');
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 2MB');
      return;
    }

    setAvatarLoading(true);

    try {
      // Create an image element to compress/resize the image
      const img = new Image();
      img.src = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Calculate optimal dimensions (max 400x400)
      const maxDim = 400;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
      }

      // Create canvas to resize the image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Cannot get canvas context');

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with quality 0.8
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8);
      });

      // Clean up object URL
      URL.revokeObjectURL(img.src);

      // Create File from blob
      const compressedFile = new File([blob], `avatar_${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });

      const fileExt = 'jpg';
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      // Refresh user data
      await refreshUser();

      toast.success('อัปโหลดรูปโปรไฟล์สำเร็จ');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('ไม่สามารถอัปโหลดรูปโปรไฟล์ได้');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate current password is provided
    if (!passwordData.currentPassword) {
      toast.error('กรุณากรอกรหัสผ่านเดิม');
      setLoading(false);
      return;
    }

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('รหัสผ่านใหม่ไม่ตรงกัน');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (passwordStrength.score < 50) {
      toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร และมีตัวพิมพ์ใหญ่ พิมพ์เล็ก และตัวเลข');
      setLoading(false);
      return;
    }

    // Check new password is different from current
    if (passwordData.currentPassword === passwordData.newPassword) {
      toast.error('รหัสผ่านใหม่ต้องแตกต่างจากรหัสผ่านเดิม');
      setLoading(false);
      return;
    }

    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        toast.error('รหัสผ่านเดิมไม่ถูกต้อง');
        setLoading(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      // Log password change for security audit
      console.log('[Security] Password changed for user:', user?.email, 'at:', new Date().toISOString());

      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);

    try {
      // Save to user metadata for now (can be moved to separate table later)
      const { error } = await supabase.auth.updateUser({
        data: {
          preferences: preferences
        }
      });

      if (error) throw error;

      toast.success('บันทึกการแจ้งเตือนสำเร็จ');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('ไม่สามารถบันทึกการแจ้งเตือนได้');
    } finally {
      setLoading(false);
    }
  };

  const getUserInitials = () => {
    if (profileData.full_name) {
      return profileData.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    return user?.email?.split('@')[0].toUpperCase() || 'U';
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">รูปโปรไฟล์</h3>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt={profileData.full_name || 'Profile'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-semibold">
                  {getUserInitials()}
                </span>
              )}
            </div>
            {avatarLoading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-foreground" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <h4 className="font-medium text-foreground">อัปโหลดรูปโปรไฟล์</h4>
            <p className="text-sm text-muted-foreground mt-1">JPG, PNG หรือ GIF ขนาดสูงสุด 2MB</p>
            <p className="text-xs text-muted-foreground">ขนาดแนะนำ: 400x400px (ระบบจะปรับขนาดอัตโนมัติ)</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">ข้อมูลส่วนตัว</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">ชื่อ-นามสกุล</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                placeholder="กรอกชื่อ-นามสกุล"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">อีเมล</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">ไม่สามารถเปลี่ยนอีเมลได้</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">เบอร์โทรศัพท์</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                placeholder="08x-xxx-xxxx"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="gradient-primary text-primary-foreground px-6 rounded-xl"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก</> : 'บันทึกข้อมูล'}
          </Button>
        </div>
      </form>

      {/* Account Info (Read-only) */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">ข้อมูลบัญชี</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">อ่านอย่างเดียว</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">บทบาท</label>
            <p className="font-medium text-foreground capitalize">{userProfile?.role || '-'}</p>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">สถานะ</label>
            <p className="font-medium text-success">{userProfile?.is_active ? 'ใช้งานอยู่' : 'ระงับการใช้งาน'}</p>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">บริษัท</label>
            <p className="font-medium text-foreground">{currentTenant?.company_name_cached || currentTenant?.name || '-'}</p>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">เข้าร่วมเมื่อ</label>
            <p className="font-medium text-foreground">{userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      {/* Password Change */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">เปลี่ยนรหัสผ่าน</h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">

          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">รหัสผ่านเดิม</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full pl-10 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                placeholder="กรอกรหัสผ่านเดิม"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">รหัสผ่านใหม่</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full pl-10 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                placeholder="กรอกรหัสผ่านใหม่"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {passwordData.newPassword && (
              <div className="mt-3 space-y-2">
                {/* Strength Bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength.strength === 'very-strong' ? 'bg-green-500 w-full' :
                        passwordStrength.strength === 'strong' ? 'bg-green-400 w-3/4' :
                        passwordStrength.strength === 'medium' ? 'bg-yellow-400 w-1/2' :
                        'bg-red-500 w-1/4'
                      }`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    passwordStrength.strength === 'very-strong' ? 'text-green-600' :
                    passwordStrength.strength === 'strong' ? 'text-green-500' :
                    passwordStrength.strength === 'medium' ? 'text-yellow-600' :
                    'text-red-500'
                  }`}>
                    {passwordStrength.strength === 'very-strong' ? 'แข็งแรงมาก' :
                     passwordStrength.strength === 'strong' ? 'แข็งแรง' :
                     passwordStrength.strength === 'medium' ? 'ปานกลาง' :
                     'อ่อนแอ'}
                  </span>
                </div>

                {/* Password Rules */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {[
                    { key: 'minLength', label: 'อย่างน้อย 8 ตัวอักษร', passed: passwordStrength.rules.minLength },
                    { key: 'hasLowercase', label: 'ตัวพิมพ์เล็ก (a-z)', passed: passwordStrength.rules.hasLowercase },
                    { key: 'hasUppercase', label: 'ตัวพิมพ์ใหญ่ (A-Z)', passed: passwordStrength.rules.hasUppercase },
                    { key: 'hasNumber', label: 'ตัวเลข (0-9)', passed: passwordStrength.rules.hasNumber },
                    { key: 'hasSpecial', label: 'อักขระพิเศษ (!@#$)', passed: passwordStrength.rules.hasSpecial },
                  ].map((rule) => (
                    <div key={rule.key} className={`flex items-center gap-2 text-xs ${
                      rule.passed ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {rule.passed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">ยืนยันรหัสผ่านใหม่</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full pl-10 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password Match Indicator */}
            {passwordData.confirmPassword && (
              <div className={`mt-2 text-xs flex items-center gap-1 ${
                passwordData.newPassword === passwordData.confirmPassword
                  ? 'text-green-600'
                  : 'text-red-500'
              }`}>
                {passwordData.newPassword === passwordData.confirmPassword ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>รหัสผ่านตรงกัน</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>รหัสผ่านไม่ตรงกัน</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword || passwordStrength.score < 50}
              className="gradient-primary text-primary-foreground px-6 rounded-xl"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังอัปเดต</> : 'เปลี่ยนรหัสผ่าน'}
            </Button>
          </div>
        </form>
      </div>

      {/* Security Tips */}
      <div className="bg-gray-50 border-gray-200">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">คำแนะนำความปลอดภัย</h4>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• ใช้รหัสผ่านที่มีอย่างน้อย 8 ตัวอักษร</li>
              <li>• ใช้ตัวอักษรผสมตัวใหญ่-เล็ก ตัวเลข และอักขระพิเศษ</li>
              <li>• ไม่ใช้รหัสผ่านเดิมกับเว็บอื่น</li>
              <li>• เปลี่ยนรหัสผ่านเมื่อสงสัยว่ามีการใช้งานโดยไม่ได้รับอนุญาต</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      {/* Language */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">ภาษา</h3>
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <select
            value={preferences.language}
            onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
            className="flex-1 px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
          >
            <option value="th">ไทย (Thai)</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">การแจ้งเตือน</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <h4 className="font-medium text-foreground">อีเมลแจ้งเตือน</h4>
                <p className="text-sm text-muted-foreground">รับการแจ้งเตือนทางอีเมล</p>
              </div>
            </div>
            <button
              onClick={() => setPreferences({ ...preferences, emailNotifications: !preferences.emailNotifications })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.emailNotifications ? 'bg-gray-700' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <h4 className="font-medium text-foreground">Push Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  {notificationPermission === 'not-supported' && 'เบราว์เซอร์ไม่รองรับ'}
                  {notificationPermission === 'granted' && 'เปิดใช้งานอยู่'}
                  {notificationPermission === 'denied' && 'ถูกบล็อกในการตั้งค่าเบราว์เซอร์'}
                  {notificationPermission === 'default' && 'ปิดใช้งานอยู่'}
                </p>
              </div>
            </div>
            <button
              onClick={requestNotificationPermission}
              disabled={notificationPermission === 'not-supported'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                notificationPermission === 'granted' ? 'bg-gray-700' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notificationPermission === 'granted' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSavePreferences}
            disabled={loading}
            className="gradient-primary text-primary-foreground px-6 rounded-xl"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก</> : 'บันทึกการแจ้งเตือน'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
            <p className="text-muted-foreground mt-1">จัดการข้อมูลโปรไฟล์และการตั้งค่าของคุณ</p>
          </div>

          {/* Settings Content */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-56">
              <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {/* Content */}
            <div className="flex-1">
              {activeTab === 'profile' && renderProfileTab()}
              {activeTab === 'security' && renderSecurityTab()}
              {activeTab === 'preferences' && renderPreferencesTab()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
