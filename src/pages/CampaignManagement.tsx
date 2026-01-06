import { useState, useEffect } from 'react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Megaphone,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Users,
  MousePointer,
  BarChart3,
  TrendingUp,
  Calendar,
  Link as LinkIcon,
  Image as ImageIcon,
  Send,
  Clock,
  Target,
  Activity,
  Upload,
  X,
  Save,
  FileText,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';

// Types
interface Campaign {
  id: string;
  tenant_id: string;
  campaign_code: string;
  campaign_name: string;
  campaign_url?: string;
  image_url?: string;
  detail?: string;
  start_date: string;
  end_date: string;
  frequency: string;
  segments: string[];
  activities: string[];
  status: string;
  recipients_count: number;
  impressions_count: number;
  clicks_count: number;
  ctr: number;
  created_at: string;
  updated_at: string;
}

// Segment options (factors affecting purchase)
const SEGMENT_OPTIONS = [
  { value: 'income_high', label: 'รายได้สูง' },
  { value: 'income_medium', label: 'รายได้ปานกลาง' },
  { value: 'income_low', label: 'รายได้น้อย' },
  { value: 'age_young', label: 'กลุ่มอายุน้อย (18-30)' },
  { value: 'age_middle', label: 'กลุ่มวัยกลางคน (31-50)' },
  { value: 'age_senior', label: 'กลุ่มผู้สูงอายุ (51+)' },
  { value: 'first_home', label: 'บ้านหลังแรก' },
  { value: 'investment', label: 'ลงทุน/เก็งกำไร' },
  { value: 'family', label: 'ครอบครัว' },
  { value: 'single', label: 'โสด' },
];

// Activity options (Lead activities)
const ACTIVITY_OPTIONS = [
  { value: 'new_lead', label: 'Lead ใหม่' },
  { value: 'contacted', label: 'ติดต่อแล้ว' },
  { value: 'viewing_scheduled', label: 'นัดดูห้อง' },
  { value: 'viewed', label: 'ดูห้องแล้ว' },
  { value: 'negotiating', label: 'กำลังเจรจา' },
  { value: 'reserved', label: 'จอง' },
  { value: 'inactive', label: 'ไม่มีกิจกรรม 30 วัน' },
  { value: 'lost', label: 'เสียลูกค้า' },
];

// Frequency options
const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'วันละครั้ง' },
  { value: 'weekly', label: 'สัปดาห์ละครั้ง' },
  { value: 'biweekly', label: 'สองสัปดาห์ครั้ง' },
  { value: 'triweekly', label: 'สามสัปดาห์ครั้ง' },
  { value: 'monthly', label: 'เดือนละครั้ง' },
];

// Status options
const STATUS_OPTIONS = [
  { value: 'draft', label: 'แบบร่าง', color: 'bg-gray-100 text-gray-800' },
  { value: 'active', label: 'ส่งแล้ว', color: 'bg-green-100 text-green-800' },
  { value: 'paused', label: 'หยุดชั่วคราว', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'เสร็จสิ้น', color: 'bg-blue-100 text-blue-800' },
];

// Mock data for charts
const MOCK_SEGMENT_DATA = [
  { name: 'รายได้สูง', customers: 5.2, ctr: 3.4 },
  { name: 'รายได้ปานกลาง', customers: 3.6, ctr: 4.1 },
  { name: 'รายได้น้อย', customers: 4.3, ctr: 3.3 },
  { name: 'กลุ่มอายุน้อย', customers: 4.2, ctr: 3.9 },
  { name: 'วัยกลางคน', customers: 6.5, ctr: 5.1 },
  { name: 'ผู้สูงอายุ', customers: 5.7, ctr: 5.3 },
  { name: 'บ้านหลังแรก', customers: 5.1, ctr: 4.9 },
  { name: 'ลงทุน', customers: 4.7, ctr: 4.1 },
  { name: 'ครอบครัว', customers: 6.2, ctr: 4.7 },
  { name: 'โสด', customers: 3.1, ctr: 3.2 },
];

const MOCK_ACTIVITY_DATA = [
  { name: 'Lead ใหม่', customers: 5, ctr: 3.6 },
  { name: 'ติดต่อแล้ว', customers: 3.4, ctr: 4.1 },
  { name: 'นัดดูห้อง', customers: 4.2, ctr: 3.4 },
  { name: 'ดูห้องแล้ว', customers: 3.4, ctr: 3.3 },
  { name: 'กำลังเจรจา', customers: 4.3, ctr: 4.2 },
  { name: 'จอง', customers: 2.7, ctr: 2.7 },
  { name: 'ไม่มีกิจกรรม', customers: 6.5, ctr: 6.4 },
];

const MOCK_MONTHLY_CTR = [
  { month: 'ม.ค.', whatsapp: 65, messenger: 55, line: 45, email: 35, sms: 25 },
  { month: 'ก.พ.', whatsapp: 70, messenger: 58, line: 48, email: 38, sms: 28 },
  { month: 'มี.ค.', whatsapp: 68, messenger: 62, line: 52, email: 42, sms: 30 },
  { month: 'เม.ย.', whatsapp: 75, messenger: 65, line: 55, email: 45, sms: 32 },
  { month: 'พ.ค.', whatsapp: 78, messenger: 68, line: 58, email: 48, sms: 35 },
  { month: 'มิ.ย.', whatsapp: 82, messenger: 72, line: 62, email: 52, sms: 38 },
  { month: 'ก.ค.', whatsapp: 85, messenger: 75, line: 65, email: 55, sms: 40 },
  { month: 'ส.ค.', whatsapp: 80, messenger: 70, line: 60, email: 50, sms: 36 },
  { month: 'ก.ย.', whatsapp: 88, messenger: 78, line: 68, email: 58, sms: 42 },
  { month: 'ต.ค.', whatsapp: 90, messenger: 80, line: 70, email: 60, sms: 45 },
  { month: 'พ.ย.', whatsapp: 85, messenger: 75, line: 65, email: 55, sms: 40 },
  { month: 'ธ.ค.', whatsapp: 92, messenger: 82, line: 72, email: 62, sms: 48 },
];

const MOCK_TOP_CAMPAIGNS = [
  { name: 'ลดสนั่น', ctr: 34.4, clicks: 344 },
  { name: 'ซื้อเลย', ctr: 23.2, clicks: 232 },
  { name: 'คุ้มสุดๆ', ctr: 18.5, clicks: 185 },
  { name: 'ฟรีดาวน์', ctr: 16.3, clicks: 163 },
  { name: 'ดอกเบี้ย 0%', ctr: 10, clicks: 100 },
  { name: 'ฟรีแอร์', ctr: 9.8, clicks: 98 },
  { name: 'โปรแรงเดือน ม.ค.', ctr: 6.5, clicks: 65 },
];

const CampaignManagement = () => {
  const { currentTenant, userProfile } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    campaign_code: '',
    campaign_name: '',
    campaign_url: '',
    image_url: '',
    detail: '',
    start_date: '',
    end_date: '',
    frequency: 'daily',
    segments: [] as string[],
    activities: [] as string[],
    status: 'draft',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Statistics
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    totalRecipients: 0,
    totalImpressions: 0,
    totalClicks: 0,
    avgCtr: 0,
  });

  useEffect(() => {
    if (currentTenant) {
      fetchCampaigns();
    }
  }, [currentTenant]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const campaignsData = data || [];
      setCampaigns(campaignsData);

      // Calculate statistics
      const totalRecipients = campaignsData.reduce((sum, c) => sum + (c.recipients_count || 0), 0);
      const totalImpressions = campaignsData.reduce((sum, c) => sum + (c.impressions_count || 0), 0);
      const totalClicks = campaignsData.reduce((sum, c) => sum + (c.clicks_count || 0), 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      setStats({
        totalCampaigns: campaignsData.length,
        totalRecipients: totalRecipients || 5000, // Mock if no data
        totalImpressions: totalImpressions || 10000,
        totalClicks: totalClicks || 2500,
        avgCtr: avgCtr || 25,
      });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      // Set mock stats if error
      setStats({
        totalCampaigns: 50,
        totalRecipients: 5000,
        totalImpressions: 10000,
        totalClicks: 2500,
        avgCtr: 25,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      campaign_code: '',
      campaign_name: '',
      campaign_url: '',
      image_url: '',
      detail: '',
      start_date: '',
      end_date: '',
      frequency: 'daily',
      segments: [],
      activities: [],
      status: 'draft',
    });
    setImageFile(null);
    setImagePreview('');
    setFormError('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('Attempting upload to bucket: campaigns, path:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('campaigns')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload success:', uploadData);

      const { data } = supabase.storage
        .from('campaigns')
        .getPublicUrl(filePath);

      console.log('Public URL:', data.publicUrl);
      return data.publicUrl;
    } catch (err: any) {
      console.error('Error uploading image:', err?.message || err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      // Validation
      if (!formData.campaign_code) {
        setFormError('กรุณาระบุรหัส Campaign');
        setFormLoading(false);
        return;
      }
      if (!formData.campaign_name) {
        setFormError('กรุณาระบุชื่อ Campaign');
        setFormLoading(false);
        return;
      }
      if (!formData.start_date || !formData.end_date) {
        setFormError('กรุณาระบุวันที่เริ่มและสิ้นสุด');
        setFormLoading(false);
        return;
      }

      let imageUrl = formData.image_url;
      if (imageFile) {
        console.log('Uploading image...', imageFile.name);
        const uploadedUrl = await uploadImage(imageFile);
        console.log('Upload result:', uploadedUrl);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          setFormError('ไม่สามารถอัปโหลดรูปได้ กรุณาตรวจสอบ Storage bucket');
          setFormLoading(false);
          return;
        }
      }

      const campaignData = {
        tenant_id: currentTenant?.id,
        campaign_code: formData.campaign_code,
        campaign_name: formData.campaign_name,
        campaign_url: formData.campaign_url || null,
        image_url: imageUrl || null,
        detail: formData.detail || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        frequency: formData.frequency,
        segments: formData.segments,
        activities: formData.activities,
        status: formData.status,
        created_by: userProfile?.id,
      };

      let campaignId: string | undefined;

      if (isEditing && selectedCampaign) {
        // Update existing campaign
        const { error } = await supabase
          .from('campaigns')
          .update(campaignData)
          .eq('id', selectedCampaign.id);

        if (error) throw error;
        campaignId = selectedCampaign.id;

        // Log activity for update
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant?.id,
            p_user_id: userProfile?.id,
            p_activity_type: 'campaign_updated',
            p_description: `แก้ไขแคมเปญ: ${formData.campaign_name}`,
            p_metadata: {
              campaign_id: selectedCampaign.id,
              campaign_code: formData.campaign_code,
              campaign_name: formData.campaign_name,
              status: formData.status
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      } else {
        // Create new campaign
        const { data, error } = await supabase
          .from('campaigns')
          .insert([campaignData])
          .select();

        if (error) throw error;
        campaignId = data?.[0]?.id;

        // Log activity for creation
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant?.id,
            p_user_id: userProfile?.id,
            p_activity_type: 'campaign_created',
            p_description: `สร้างแคมเปญใหม่: ${formData.campaign_name}`,
            p_metadata: {
              campaign_id: campaignId,
              campaign_code: formData.campaign_code,
              campaign_name: formData.campaign_name,
              status: formData.status
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      }

      fetchCampaigns();
      setShowAddModal(false);
      resetForm();
      setIsEditing(false);
      setSelectedCampaign(null);
    } catch (err: any) {
      console.error('Error saving campaign:', err);
      if (err.code === '23505') {
        setFormError('รหัส Campaign นี้ถูกใช้แล้ว');
      } else {
        setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      campaign_code: campaign.campaign_code,
      campaign_name: campaign.campaign_name,
      campaign_url: campaign.campaign_url || '',
      image_url: campaign.image_url || '',
      detail: campaign.detail || '',
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      frequency: campaign.frequency,
      segments: campaign.segments || [],
      activities: campaign.activities || [],
      status: campaign.status,
    });
    setImagePreview(campaign.image_url || '');
    setIsEditing(true);
    setShowAddModal(true);
  };

  const handleDelete = async () => {
    if (!selectedCampaign) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', selectedCampaign.id);

      if (error) throw error;

      // Log activity for deletion
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: userProfile?.id,
          p_activity_type: 'campaign_deleted',
          p_description: `ลบแคมเปญ: ${selectedCampaign.campaign_name}`,
          p_metadata: {
            campaign_id: selectedCampaign.id,
            campaign_code: selectedCampaign.campaign_code,
            campaign_name: selectedCampaign.campaign_name
          }
        });
      } catch {
        // Ignore log_activity errors
      }

      fetchCampaigns();
      setShowDeleteDialog(false);
      setSelectedCampaign(null);
    } catch (err: any) {
      console.error('Error deleting campaign:', err);
    }
  };

  const handleView = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowViewModal(true);
  };

  const toggleSegment = (value: string) => {
    setFormData(prev => ({
      ...prev,
      segments: prev.segments.includes(value)
        ? prev.segments.filter(s => s !== value)
        : [...prev.segments, value]
    }));
  };

  const toggleActivity = (value: string) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.includes(value)
        ? prev.activities.filter(a => a !== value)
        : [...prev.activities, value]
    }));
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.campaign_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return <Badge className={option?.color || 'bg-gray-100'}>{option?.label || status}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6">
            {/* Page Title */}
            <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100 mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Megaphone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">แคมเปญ</h1>
                      <p className="text-gray-600 mt-1">
                        จัดการแคมเปญโปรโมชันผ่าน LINE
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      resetForm();
                      setIsEditing(false);
                      setSelectedCampaign(null);
                      setShowAddModal(true);
                    }}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    สร้างแคมเปญใหม่
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Section 1: Statistics Overview */}
            <div className="space-y-6 mb-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <Megaphone className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.totalCampaigns}</p>
                        <p className="text-sm text-white/80">แคมเปญ</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.totalRecipients.toLocaleString()}</p>
                        <p className="text-sm text-white/80">ผู้รับแคมเปญ</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <Eye className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
                        <p className="text-sm text-white/80">การแสดงผล</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <MousePointer className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.totalClicks.toLocaleString()}</p>
                        <p className="text-sm text-white/80">การคลิก</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-500 to-rose-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.avgCtr.toFixed(1)}%</p>
                        <p className="text-sm text-white/80">CTR</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 1: Segment & Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Segment Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-5 h-5 text-violet-600" />
                      แผนภูมิเปอร์เซ็นต์ลูกค้าแต่ละ Segment
                    </CardTitle>
                    <CardDescription className="text-xs">
                      แผนภูมิเปอร์เซ็นต์ Click Through Rate (CTR) แต่ละ Segment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={MOCK_SEGMENT_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="customers" name="ลูกค้า (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ctr" name="CTR (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Activity Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-5 h-5 text-cyan-600" />
                      แผนภูมิเปอร์เซ็นต์ลูกค้าแต่ละ Activity
                    </CardTitle>
                    <CardDescription className="text-xs">
                      แผนภูมิเปอร์เซ็นต์ Click Through Rate (CTR) แต่ละ Activity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={MOCK_ACTIVITY_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="customers" name="ลูกค้า (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ctr" name="CTR (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 2: Monthly CTR & Top Campaigns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly CTR Chart - LINE Only */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-violet-600" />
                      แผนภูมิเปอร์เซ็นต์ Click Through Rate (CTR) รายเดือน
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={MOCK_MONTHLY_CTR} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="line" radius={[4, 4, 0, 0]}>
                          {MOCK_MONTHLY_CTR.map((entry, index) => {
                            // ไล่สีม่วงจากอ่อน (จาง) ไปเข้ม (12 เดือน)
                            const colors = [
                              '#f3e8ff', // ม.ค. - ม่วงอ่อนมากๆ
                              '#e9d5ff', // ก.พ. - ม่วงอ่อนมาก
                              '#d8b4fe', // มี.ค. - ม่วงอ่อน
                              '#c4b5fd', // เม.ย. - ม่วงอ่อน
                              '#c084fc', // พ.ค. - ม่วงอ่อน-กลาง
                              '#a78bfa', // มิ.ย. - ม่วงกลาง
                              '#a855f7', // ก.ค. - ม่วงกลาง-เข้ม
                              '#9333ea', // ส.ค. - ม่วงเข้ม
                              '#8b5cf6', // ก.ย. - violet
                              '#7c3aed', // ต.ค. - violet เข้ม
                              '#6d28d9', // พ.ย. - ม่วงเข้มมาก
                              '#5b21b6', // ธ.ค. - ม่วงเข้มสุด
                            ];
                            return <Cell key={`cell-${index}`} fill={colors[index]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Campaigns */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                      Top แคมเปญที่อัตราการคลิกสูง
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {MOCK_TOP_CAMPAIGNS.map((campaign, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-sm text-gray-500 w-24 text-right truncate">{campaign.name}</span>
                          <div className="flex-1 relative h-6">
                            <div
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-violet-500 rounded"
                              style={{ width: `${campaign.ctr}%` }}
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white font-semibold">
                              {campaign.ctr}%
                            </span>
                          </div>
                          <span className="text-sm text-gray-600 w-12">{campaign.clicks}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Section 2: Campaign Management Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-violet-600">{filteredCampaigns.length}</span>
                      <span className="text-base font-medium">รายชื่อแคมเปญ</span>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        ส่งแล้ว [{campaigns.filter(c => c.status === 'active').length}]
                      </Badge>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        ยังไม่ส่ง [{campaigns.filter(c => c.status === 'draft').length}]
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหาแคมเปญ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="สถานะ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-12">ลำดับ</TableHead>
                        <TableHead>รหัสแคมเปญ</TableHead>
                        <TableHead>ชื่อแคมเปญ</TableHead>
                        <TableHead>Segment</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>ระยะเวลา</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead className="text-right">CTR (%)</TableHead>
                        <TableHead className="w-24 text-center">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
                              <span className="ml-2">กำลังโหลด...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredCampaigns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                            ไม่พบแคมเปญ
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCampaigns.map((campaign, index) => (
                          <TableRow key={campaign.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono text-sm">{campaign.campaign_code}</TableCell>
                            <TableCell className="font-medium">{campaign.campaign_name}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-[150px]">
                                {(campaign.segments || []).slice(0, 2).map((seg, i) => {
                                  const option = SEGMENT_OPTIONS.find(o => o.value === seg);
                                  return (
                                    <Badge key={i} variant="secondary" className="text-xs bg-violet-50 text-violet-700">
                                      {option?.label || seg}
                                    </Badge>
                                  );
                                })}
                                {(campaign.segments?.length || 0) > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{campaign.segments.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-[150px]">
                                {(campaign.activities || []).slice(0, 2).map((act, i) => {
                                  const option = ACTIVITY_OPTIONS.find(o => o.value === act);
                                  return (
                                    <Badge key={i} variant="secondary" className="text-xs bg-cyan-50 text-cyan-700">
                                      {option?.label || act}
                                    </Badge>
                                  );
                                })}
                                {(campaign.activities?.length || 0) > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{campaign.activities.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
                            </TableCell>
                            <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                            <TableCell className="text-right">
                              <span className={`font-semibold ${campaign.ctr > 20 ? 'text-green-600' : campaign.ctr > 10 ? 'text-amber-600' : 'text-gray-600'}`}>
                                {campaign.ctr.toFixed(1)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleView(campaign)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    ดู
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEdit(campaign)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    แก้ไข
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedCampaign(campaign);
                                      setShowDeleteDialog(true);
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    ลบ
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>

        {/* Add/Edit Campaign Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden p-0 flex flex-col" hideCloseButton>
            {/* Accessibility - Hidden Title & Description */}
            <DialogTitle className="sr-only">
              {isEditing ? 'แก้ไขแคมเปญ' : 'เพิ่มแคมเปญใหม่'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              กรอกรายละเอียดแคมเปญสำหรับส่งโปรโมชันผ่าน LINE
            </DialogDescription>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#676AF1]/10 via-[#8B5CF6]/10 to-[#676AF1]/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#676AF1] to-[#8B5CF6] rounded-xl shadow-md">
                  <Megaphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {isEditing ? 'แก้ไขแคมเปญ' : 'เพิ่มแคมเปญใหม่'}
                  </h2>
                  <p className="text-xs text-gray-500">กรอกรายละเอียดแคมเปญสำหรับส่งโปรโมชันผ่าน LINE</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                  setIsEditing(false);
                  setSelectedCampaign(null);
                }}
                disabled={formLoading}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {/* Section 1: รูปโปรโมชัน - Purple */}
                <Card className="border-2 border-purple-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-purple-50 to-purple-100/50 border-b border-purple-100">
                      <div className="p-1.5 bg-purple-500 rounded-lg">
                        <ImageIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-purple-900 text-sm">รูปโปรโมชัน</h3>
                        <p className="text-xs text-purple-600">รูปภาพสำหรับแสดงในแคมเปญ</p>
                      </div>
                    </div>
                    <div className="p-4">
                      {imagePreview ? (
                        <div className="relative w-full">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-xl border-2 border-purple-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview('');
                              setFormData(prev => ({ ...prev, image_url: '' }));
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-md"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors bg-purple-50/30">
                          <div className="p-3 bg-purple-100 rounded-full mb-2">
                            <Upload className="w-6 h-6 text-purple-500" />
                          </div>
                          <span className="text-sm font-medium text-purple-700">คลิกเพื่ออัปโหลดรูปโปรโมชัน</span>
                          <span className="text-xs text-gray-500 mt-1">รองรับไฟล์ PNG, JPG, GIF</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            disabled={formLoading}
                          />
                        </label>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Section 2: ข้อมูลพื้นฐาน - Blue */}
                <Card className="border-2 border-blue-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-100">
                      <div className="p-1.5 bg-blue-500 rounded-lg">
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-blue-900 text-sm">ข้อมูลพื้นฐาน</h3>
                        <p className="text-xs text-blue-600">รหัส ชื่อ และ URL ของแคมเปญ</p>
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="campaign_code" className="text-sm font-medium">รหัส Campaign <span className="text-red-500">*</span></Label>
                          <Input
                            id="campaign_code"
                            value={formData.campaign_code}
                            onChange={(e) => setFormData(prev => ({ ...prev, campaign_code: e.target.value }))}
                            placeholder="เช่น C2024010001"
                            disabled={formLoading}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="campaign_name" className="text-sm font-medium">ชื่อ Campaign <span className="text-red-500">*</span></Label>
                          <Input
                            id="campaign_name"
                            value={formData.campaign_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, campaign_name: e.target.value }))}
                            placeholder="เช่น โปรลดสนั่น ต้อนรับปีใหม่"
                            disabled={formLoading}
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="campaign_url" className="text-sm font-medium flex items-center gap-1.5">
                          <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                          Campaign URL
                        </Label>
                        <Input
                          id="campaign_url"
                          value={formData.campaign_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, campaign_url: e.target.value }))}
                          placeholder="https://example.com/promo"
                          disabled={formLoading}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="detail" className="text-sm font-medium">รายละเอียด (ข้อความ)</Label>
                        <Textarea
                          id="detail"
                          value={formData.detail}
                          onChange={(e) => setFormData(prev => ({ ...prev, detail: e.target.value }))}
                          placeholder="รายละเอียดแคมเปญ..."
                          rows={3}
                          disabled={formLoading}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 3: ระยะเวลาและความถี่ - Green */}
                <Card className="border-2 border-green-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-green-50 to-green-100/50 border-b border-green-100">
                      <div className="p-1.5 bg-green-500 rounded-lg">
                        <Calendar className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-900 text-sm">ระยะเวลาและความถี่</h3>
                        <p className="text-xs text-green-600">กำหนดช่วงเวลาและความถี่ในการส่ง</p>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="start_date" className="text-sm font-medium">วันที่เริ่ม <span className="text-red-500">*</span></Label>
                          <Input
                            id="start_date"
                            type="date"
                            value={formData.start_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                            disabled={formLoading}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_date" className="text-sm font-medium">วันสิ้นสุด <span className="text-red-500">*</span></Label>
                          <Input
                            id="end_date"
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                            disabled={formLoading}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="frequency" className="text-sm font-medium">ความถี่ในการส่ง</Label>
                          <Select
                            value={formData.frequency}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                            disabled={formLoading}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCY_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 4: Segment - Violet */}
                <Card className="border-2 border-violet-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-violet-50 to-violet-100/50 border-b border-violet-100">
                      <div className="p-1.5 bg-violet-500 rounded-lg">
                        <Target className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-violet-900 text-sm">Segment (กลุ่มเป้าหมาย)</h3>
                        <p className="text-xs text-violet-600">เลือกปัจจัยที่ส่งผลต่อการซื้อ</p>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {SEGMENT_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                              formData.segments.includes(option.value)
                                ? 'border-violet-400 bg-violet-50'
                                : 'border-gray-200 bg-white hover:border-violet-200 hover:bg-violet-50/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.segments.includes(option.value)}
                              onChange={() => toggleSegment(option.value)}
                              className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              disabled={formLoading}
                            />
                            <span className="text-sm">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 5: Activity - Cyan */}
                <Card className="border-2 border-cyan-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-cyan-100/50 border-b border-cyan-100">
                      <div className="p-1.5 bg-cyan-500 rounded-lg">
                        <Activity className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-cyan-900 text-sm">Activity (กิจกรรมของ Lead)</h3>
                        <p className="text-xs text-cyan-600">เลือกกลุ่มกิจกรรมที่ต้องการส่งแคมเปญ</p>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {ACTIVITY_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                              formData.activities.includes(option.value)
                                ? 'border-cyan-400 bg-cyan-50'
                                : 'border-gray-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.activities.includes(option.value)}
                              onChange={() => toggleActivity(option.value)}
                              className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                              disabled={formLoading}
                            />
                            <span className="text-sm">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 6: สถานะ - Gray */}
                <Card className="border-2 border-gray-200 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                      <div className="p-1.5 bg-gray-600 rounded-lg">
                        <Settings className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">สถานะแคมเปญ</h3>
                        <p className="text-xs text-gray-600">กำหนดสถานะการใช้งาน</p>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-3">
                        {STATUS_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                              formData.status === option.value
                                ? 'border-violet-400 bg-violet-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              checked={formData.status === option.value}
                              onChange={() => setFormData(prev => ({ ...prev, status: option.value }))}
                              className="sr-only"
                              disabled={formLoading}
                            />
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              formData.status === option.value ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
                            }`}>
                              {formData.status === option.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className={`font-medium ${formData.status === option.value ? 'text-violet-700' : 'text-gray-700'}`}>
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Error Message */}
                {formError && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">เกิดข้อผิดพลาด</p>
                        <p className="text-sm text-red-600 mt-1">{formError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Footer - Fixed at bottom */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                  setIsEditing(false);
                  setSelectedCampaign(null);
                }}
                disabled={formLoading}
                className="flex-1 border-gray-300 hover:bg-gray-100"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={formLoading}
                className="flex-1 bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] hover:opacity-90 text-white shadow-md"
              >
                {formLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    กำลังบันทึก...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" />
                    {isEditing ? 'บันทึกการแก้ไข' : 'สร้างแคมเปญ'}
                  </div>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Campaign Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden p-0 flex flex-col" hideCloseButton>
            {/* Accessibility - Hidden Title & Description */}
            <DialogTitle className="sr-only">รายละเอียดแคมเปญ</DialogTitle>
            <DialogDescription className="sr-only">ดูข้อมูลแคมเปญและสถิติการใช้งาน</DialogDescription>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#676AF1]/10 via-[#8B5CF6]/10 to-[#676AF1]/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#676AF1] to-[#8B5CF6] rounded-xl shadow-md">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">รายละเอียดแคมเปญ</h2>
                  <p className="text-xs text-gray-500">ดูข้อมูลแคมเปญและสถิติการใช้งาน</p>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content - Scrollable */}
            {selectedCampaign && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Image Section */}
                <Card className="border-2 border-purple-100 shadow-sm overflow-hidden">
                  {selectedCampaign.image_url ? (
                    <img
                      src={selectedCampaign.image_url}
                      alt={selectedCampaign.campaign_name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-purple-50 to-violet-100 flex flex-col items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-purple-300" />
                      <span className="text-sm text-purple-400 mt-2">ไม่มีรูปโปรโมชัน</span>
                    </div>
                  )}
                </Card>

                {/* Basic Info Card */}
                <Card className="border-2 border-blue-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-100">
                      <div className="p-1.5 bg-blue-500 rounded-lg">
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-blue-900 text-sm">ข้อมูลพื้นฐาน</h3>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Megaphone className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">รหัสแคมเปญ</p>
                            <p className="font-mono font-medium text-gray-900">{selectedCampaign.campaign_code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <FileText className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">ชื่อแคมเปญ</p>
                            <p className="font-medium text-gray-900">{selectedCampaign.campaign_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Calendar className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">ระยะเวลา</p>
                            <p className="font-medium text-gray-900">{formatDate(selectedCampaign.start_date)} - {formatDate(selectedCampaign.end_date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Clock className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">ความถี่</p>
                            <p className="font-medium text-gray-900">{FREQUENCY_OPTIONS.find(o => o.value === selectedCampaign.frequency)?.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Settings className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">สถานะ</p>
                            {getStatusBadge(selectedCampaign.status)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">CTR</p>
                            <p className="font-bold text-green-600">{selectedCampaign.ctr}%</p>
                          </div>
                        </div>
                      </div>

                      {selectedCampaign.campaign_url && (
                        <div className="pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">URL</p>
                          <a href={selectedCampaign.campaign_url} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                            <LinkIcon className="w-3.5 h-3.5" />
                            {selectedCampaign.campaign_url}
                          </a>
                        </div>
                      )}

                      {selectedCampaign.detail && (
                        <div className="pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">รายละเอียด</p>
                          <p className="text-sm text-gray-700">{selectedCampaign.detail}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Segments Card */}
                <Card className="border-2 border-violet-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-violet-50 to-violet-100/50 border-b border-violet-100">
                      <div className="p-1.5 bg-violet-500 rounded-lg">
                        <Target className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-violet-900 text-sm">Segments ({selectedCampaign.segments?.length || 0})</h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {(selectedCampaign.segments || []).length > 0 ? (
                          (selectedCampaign.segments || []).map((seg, i) => {
                            const option = SEGMENT_OPTIONS.find(o => o.value === seg);
                            return (
                              <Badge key={i} className="bg-violet-100 text-violet-700 px-3 py-1">
                                {option?.label || seg}
                              </Badge>
                            );
                          })
                        ) : (
                          <p className="text-sm text-gray-400">ไม่ได้ระบุ Segment</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Activities Card */}
                <Card className="border-2 border-cyan-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-cyan-100/50 border-b border-cyan-100">
                      <div className="p-1.5 bg-cyan-500 rounded-lg">
                        <Activity className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-cyan-900 text-sm">Activities ({selectedCampaign.activities?.length || 0})</h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {(selectedCampaign.activities || []).length > 0 ? (
                          (selectedCampaign.activities || []).map((act, i) => {
                            const option = ACTIVITY_OPTIONS.find(o => o.value === act);
                            return (
                              <Badge key={i} className="bg-cyan-100 text-cyan-700 px-3 py-1">
                                {option?.label || act}
                              </Badge>
                            );
                          })
                        ) : (
                          <p className="text-sm text-gray-400">ไม่ได้ระบุ Activity</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats Card */}
                <Card className="border-2 border-amber-100 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-100">
                      <div className="p-1.5 bg-amber-500 rounded-lg">
                        <BarChart3 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-amber-900 text-sm">สถิติแคมเปญ</h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-violet-50 rounded-xl">
                          <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Users className="w-5 h-5 text-violet-600" />
                          </div>
                          <p className="text-2xl font-bold text-violet-600">{selectedCampaign.recipients_count.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">ผู้รับ</p>
                        </div>
                        <div className="text-center p-4 bg-cyan-50 rounded-xl">
                          <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Eye className="w-5 h-5 text-cyan-600" />
                          </div>
                          <p className="text-2xl font-bold text-cyan-600">{selectedCampaign.impressions_count.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">แสดงผล</p>
                        </div>
                        <div className="text-center p-4 bg-amber-50 rounded-xl">
                          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <MousePointer className="w-5 h-5 text-amber-600" />
                          </div>
                          <p className="text-2xl font-bold text-amber-600">{selectedCampaign.clicks_count.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">คลิก</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowViewModal(false)}
                className="flex-1 border-gray-300 hover:bg-gray-100"
              >
                ปิด
              </Button>
              <Button
                onClick={() => {
                  setShowViewModal(false);
                  if (selectedCampaign) handleEdit(selectedCampaign);
                }}
                className="flex-1 bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] hover:opacity-90 text-white shadow-md"
              >
                <Edit className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="p-0 overflow-hidden max-w-md" hideCloseButton>
            {/* Header */}
            <div className="bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold !text-white">
                    ยืนยันการลบแคมเปญ
                  </DialogTitle>
                  <DialogDescription className="!text-purple-100 text-sm mt-0.5">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Campaign Info Card */}
              <Card className="border-2 border-purple-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                    <div className="p-1.5 bg-purple-500 rounded-lg">
                      <Megaphone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900">ข้อมูลแคมเปญที่จะลบ</h3>
                      <p className="text-xs text-purple-600">ตรวจสอบข้อมูลก่อนดำเนินการ</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Campaign Code */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileText className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">รหัสแคมเปญ</p>
                        <p className="font-mono font-medium text-gray-900">{selectedCampaign?.campaign_code}</p>
                      </div>
                    </div>
                    {/* Campaign Name */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Megaphone className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">ชื่อแคมเปญ</p>
                        <p className="font-medium text-gray-900">{selectedCampaign?.campaign_name}</p>
                      </div>
                    </div>
                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Settings className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">สถานะ</p>
                        {selectedCampaign && getStatusBadge(selectedCampaign.status)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Warning Box */}
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">คำเตือน</p>
                    <p className="text-sm text-red-700 mt-1">
                      การลบแคมเปญจะทำให้ข้อมูลสถิติและประวัติการส่งทั้งหมดถูกลบไปด้วย
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t bg-gray-50">
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                  className="flex-1 border-gray-300 hover:bg-gray-100"
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบแคมเปญ
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminGuard>
  );
};

export default CampaignManagement;
