import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Area,
  AreaChart,
  PieChart,
  Pie,
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
  { value: 'completed', label: 'เสร็จสิ้น', color: 'bg-gray-100 text-gray-700' },
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
  const navigate = useNavigate();
  const { id: campaignId } = useParams();
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

  // Compute selectedCampaign based on URL parameter instead of state
  const selectedCampaignFromUrl = campaigns.find(campaign => campaign.id === campaignId) || null;

  // Handle invalid campaign ID in URL
  useEffect(() => {
    // Check if campaignId is a valid UUID format
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId || '');

    if (campaignId && !isValidUUID) {
      console.warn(`Invalid campaign ID format: ${campaignId}, redirecting to campaigns list`);
      navigate('/campaigns', { replace: true });
      return;
    }

    if (campaignId && campaigns.length > 0 && !selectedCampaignFromUrl) {
      console.warn(`Campaign with ID ${campaignId} not found, redirecting to campaigns list`);
      navigate('/campaigns', { replace: true });
    }
  }, [campaignId, campaigns, selectedCampaignFromUrl, navigate]);

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

      const totalRecipients = campaignsData.reduce((sum, c) => sum + (c.recipients_count || 0), 0);
      const totalImpressions = campaignsData.reduce((sum, c) => sum + (c.impressions_count || 0), 0);
      const totalClicks = campaignsData.reduce((sum, c) => sum + (c.clicks_count || 0), 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      setStats({
        totalCampaigns: campaignsData.length,
        totalRecipients,
        totalImpressions,
        totalClicks,
        avgCtr,
      });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
      setStats({ totalCampaigns: 0, totalRecipients: 0, totalImpressions: 0, totalClicks: 0, avgCtr: 0 });
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
    navigate(`/campaigns/${campaign.id}`);
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

  // KK Color Palette
  const KK = {
    red: '#e60023', redLight: '#fff1f2',
    blue: '#3b82f6', blueLight: '#eff6ff',
    purple: '#8b5cf6', purpleLight: '#f5f3ff',
    green: '#10b981', greenLight: '#ecfdf5',
    orange: '#f97316', orangeLight: '#fff7ed',
    amber: '#f59e0b', amberLight: '#fffbeb',
    gray: '#6b7280', grayLight: '#f3f4f6',
    border: '#e5e7eb',
  };

  const kkTooltipStyle = {
    backgroundColor: 'white',
    border: `1px solid ${KK.border}`,
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '12px',
    padding: '8px 12px',
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-10 space-y-7">
            {/* === Page Title (KK style with inline summary) === */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  แคมเปญทั้งหมด
                </span>
                <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">Campaigns</h1>
                <p className="text-[15px] text-gray-500 mt-1.5">
                  <span className="font-semibold text-gray-700">{campaigns.length} แคมเปญ</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  Active <span className="font-semibold" style={{ color: KK.green }}>{campaigns.filter(c => c.status === 'active').length}</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  Total Sent <span className="font-semibold text-gray-700">{stats.totalRecipients.toLocaleString()}</span>
                </p>
              </div>
              <Button
                onClick={() => navigate('/builder')}
                style={{ backgroundColor: KK.red, color: '#fff', border: 'none' }}
                className="rounded-xl text-sm h-11 px-5 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                สร้างแคมเปญใหม่
              </Button>
            </div>

            {/* === Section 1 removed — KPI/charts moved to Marketing Analytics page === */}
            {false && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {[
                  { title: 'แคมเปญทั้งหมด', value: stats.totalCampaigns.toLocaleString(),    icon: Megaphone,    color: KK.red,    bg: KK.redLight,    sub: 'แคมเปญ' },
                  { title: 'ผู้รับแคมเปญ',    value: stats.totalRecipients.toLocaleString(),  icon: Users,        color: KK.blue,   bg: KK.blueLight,   trend: { value: 12.4, up: true } },
                  { title: 'การแสดงผล',       value: stats.totalImpressions.toLocaleString(), icon: Eye,          color: KK.green,  bg: KK.greenLight,  trend: { value: 8.2, up: true } },
                  { title: 'การคลิก',         value: stats.totalClicks.toLocaleString(),      icon: MousePointer, color: KK.orange, bg: KK.orangeLight, trend: { value: 15.6, up: true } },
                  { title: 'อัตราคลิก (CTR)',  value: `${stats.avgCtr.toFixed(1)}%`,           icon: TrendingUp,   color: KK.purple, bg: KK.purpleLight, trend: { value: 3.4, up: true } },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
                    <div className="flex items-start justify-between mb-5">
                      <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{kpi.title}</p>
                      <div
                        className="kpi-icon-bg w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${kpi.bg}f0 0%, ${kpi.bg} 100%)`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${kpi.color}15`,
                        }}
                      >
                        <kpi.icon className="w-5 h-5" style={{ color: kpi.color, filter: `drop-shadow(0 1px 1px ${kpi.color}20)` }} strokeWidth={2.2} />
                      </div>
                    </div>
                    <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{kpi.value}</p>
                    {kpi.trend ? (
                      <div className="flex items-center gap-1.5 mt-3.5">
                        <span className="text-[13px] font-semibold" style={{ color: kpi.trend.up ? KK.green : KK.red }}>
                          {kpi.trend.up ? '↗' : '↘'} {kpi.trend.value}%
                        </span>
                        <span className="text-[13px] text-gray-400">vs เดือนก่อน</span>
                      </div>
                    ) : (
                      <p className="text-[13px] text-gray-400 mt-3.5">{kpi.sub}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* === Charts Row 1: Segment + Activity (red → pale pink gradient) === */}
              {(() => {
                // 5-stop gradient: vivid red (top) → pale pink (bottom)
                const getRankColor = (rank: number, total: number) => {
                  const t = rank / Math.max(total - 1, 1);
                  if (t <= 0.15) return '#e60023'; // 1: vivid red
                  if (t <= 0.35) return '#ef4458'; // 2: bright red
                  if (t <= 0.55) return '#f87171'; // 3: red-400
                  if (t <= 0.75) return '#fca5a5'; // 4: red-300 / light pink
                  return '#fecdd3';                 // 5: pale pink
                };
                // Text always uses dark red for readability on any tone
                const getTextColor = (rank: number, total: number) => {
                  const t = rank / Math.max(total - 1, 1);
                  if (t <= 0.35) return '#e60023'; // vivid for top
                  if (t <= 0.55) return '#c4001e'; // deep red
                  return '#8a0014';                 // darker red for light bars
                };
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Segment — Horizontal bars red→gray gradient by rank */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4" style={{ color: KK.red }} />
                            <h2 className="text-base font-bold text-gray-900">แผนภูมิเปอร์เซ็นต์ลูกค้าแต่ละ Segment</h2>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">แผนภูมิเปอร์เซ็นต์ Click Through Rate (CTR) แต่ละ Segment · เรียงจากสูงไปต่ำ</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full h-fit" style={{ color: KK.red, backgroundColor: KK.redLight }}>10 กลุ่ม</span>
                      </div>
                      <div className="space-y-2.5 mt-5">
                        {(() => {
                          const sorted = [...MOCK_SEGMENT_DATA].sort((a, b) => b.customers - a.customers);
                          const max = Math.max(...sorted.map(d => d.customers));
                          return sorted.map((item, i) => {
                            const widthPct = (item.customers / max) * 100;
                            const color = getRankColor(i, sorted.length);
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-700 w-20 text-right truncate flex-shrink-0">{item.name}</span>
                                <div className="flex-1 relative h-6 rounded-md overflow-hidden bg-gray-50">
                                  <div
                                    className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                                  />
                                </div>
                                <span className="text-xs font-bold tabular-nums w-10 text-right flex-shrink-0" style={{ color: getTextColor(i, sorted.length) }}>
                                  {item.customers.toFixed(1)}%
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100">
                        <span className="text-[11px] text-gray-500">สูง</span>
                        <div className="flex-1 h-2 rounded-full max-w-[160px]" style={{ background: 'linear-gradient(90deg, #e60023 0%, #ef4458 25%, #f87171 50%, #fca5a5 75%, #fecdd3 100%)' }} />
                        <span className="text-[11px] text-gray-500">ต่ำ</span>
                      </div>
                    </div>

                    {/* Activity — Vertical bars red→gray by value rank */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4" style={{ color: KK.red }} />
                            <h2 className="text-base font-bold text-gray-900">แผนภูมิเปอร์เซ็นต์ลูกค้าแต่ละ Activity</h2>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">แผนภูมิเปอร์เซ็นต์ Click Through Rate (CTR) แต่ละ Activity ของ Lead</p>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full h-fit" style={{ color: KK.red, backgroundColor: KK.redLight }}>7 activities</span>
                      </div>
                      {(() => {
                        // Compute color rank per item (highest CTR = red, lowest = light gray)
                        const sortedByValue = [...MOCK_ACTIVITY_DATA].sort((a, b) => b.ctr - a.ctr);
                        const colorByName = new Map(
                          sortedByValue.map((item, idx) => [item.name, getRankColor(idx, sortedByValue.length)])
                        );
                        return (
                          <>
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={MOCK_ACTIVITY_DATA} margin={{ top: 20, right: 8, left: -15, bottom: 0 }} barCategoryGap="22%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                <Tooltip contentStyle={kkTooltipStyle} formatter={(v) => [`${Number(v)}%`, 'CTR']} />
                                <Bar dataKey="ctr" radius={[6, 6, 0, 0]}>
                                  {MOCK_ACTIVITY_DATA.map((entry, i) => (
                                    <Cell key={i} fill={colorByName.get(entry.name) || '#d1d5db'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                              <span className="text-[11px] text-gray-500">สูง</span>
                              <div className="flex-1 h-2 rounded-full max-w-[160px]" style={{ background: 'linear-gradient(90deg, #e60023 0%, #ef4458 25%, #f87171 50%, #fca5a5 75%, #fecdd3 100%)' }} />
                              <span className="text-[11px] text-gray-500">ต่ำ</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* === Charts Row 2: Monthly CTR Trend + Top Campaigns === */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly CTR — smooth Area chart (KK Revenue style) */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" style={{ color: KK.red }} />
                        <h2 className="text-base font-bold text-gray-900">แผนภูมิเปอร์เซ็นต์ Click Through Rate (CTR) รายเดือน</h2>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">แนวโน้ม CTR ผ่าน LINE ตลอด 12 เดือน</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full h-fit" style={{ color: KK.red, backgroundColor: KK.redLight }}>12 เดือน</span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={MOCK_MONTHLY_CTR} margin={{ top: 10, right: 8, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ctrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"  stopColor={KK.red} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [`${v}%`, 'CTR LINE']) as any} />
                      <Area type="monotone" dataKey="line" stroke={KK.red} strokeWidth={2.5} fill="url(#ctrGrad)" dot={false} activeDot={{ r: 4, fill: KK.red, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 pl-2">
                    <div className="flex items-center gap-2"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: KK.red }} /><span className="text-xs text-gray-600">CTR ผ่าน LINE</span></div>
                  </div>
                </div>

                {/* Top Campaigns — horizontal bars KK style */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4" style={{ color: KK.red }} />
                    <h2 className="text-base font-bold text-gray-900">Top แคมเปญที่อัตราการคลิกสูง</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">รายชื่อแคมเปญที่มี CTR สูงสุด · เรียงจากสูงไปต่ำ</p>
                  <div className="space-y-3.5">
                    {MOCK_TOP_CAMPAIGNS.map((campaign, index) => {
                      const maxCtr = Math.max(...MOCK_TOP_CAMPAIGNS.map(c => c.ctr));
                      const widthPct = (campaign.ctr / maxCtr) * 100;
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-600 w-20 text-right truncate flex-shrink-0">{campaign.name}</span>
                          <div className="flex-1 relative h-7 bg-gray-50 rounded-md overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-md flex items-center justify-end pr-2 transition-all duration-500"
                              style={{ width: `${widthPct}%`, backgroundColor: KK.red }}
                            >
                              <span className="text-xs text-white font-semibold tabular-nums">{campaign.ctr}%</span>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right tabular-nums flex-shrink-0">{campaign.clicks}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Conditional rendering: Campaigns List or Campaign Detail */}
            {!campaignId ? (
              /* Campaigns List — KK Visual Cards style */
              <>
                {/* Filter Tabs — pill style like KK */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all',       label: 'ทั้งหมด',     count: campaigns.length },
                    { value: 'draft',     label: 'Draft',       count: campaigns.filter(c => c.status === 'draft').length },
                    { value: 'paused',    label: 'Scheduled',   count: campaigns.filter(c => c.status === 'paused').length },
                    { value: 'active',    label: 'Active',      count: campaigns.filter(c => c.status === 'active').length },
                    { value: 'completed', label: 'Ended',       count: campaigns.filter(c => c.status === 'completed').length },
                  ].map(tab => {
                    const isActive = statusFilter === tab.value;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        className="flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
                        style={{
                          backgroundColor: isActive ? KK.red : '#fff',
                          color: isActive ? '#fff' : '#374151',
                          border: `1px solid ${isActive ? KK.red : '#e5e7eb'}`,
                          boxShadow: isActive ? '0 2px 8px rgba(230,0,35,0.2)' : 'none',
                        }}
                      >
                        {tab.label}
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-md font-semibold tabular-nums"
                          style={{
                            backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                            color: isActive ? '#fff' : '#6b7280',
                          }}
                        >
                          ({tab.count})
                        </span>
                      </button>
                    );
                  })}
                  {/* Search */}
                  <div className="relative ml-auto w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="ค้นหาแคมเปญ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 rounded-xl border-gray-200 text-sm"
                    />
                  </div>
                </div>

                {/* Campaign Visual Cards Grid */}
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden animate-pulse">
                        <div className="h-40 bg-gray-100" />
                        <div className="p-5 space-y-3">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                          <div className="h-3 bg-gray-100 rounded w-full" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft text-center py-16">
                    <Megaphone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-base font-semibold text-gray-700 mb-1">ไม่พบแคมเปญ</p>
                    <p className="text-sm text-gray-500">ลองเปลี่ยนตัวกรองหรือสร้างแคมเปญใหม่</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredCampaigns.map((campaign) => {
                      const statusConfig: Record<string, { dot: string; label: string; gradient: string; emoji: string }> = {
                        draft:     { dot: '#9ca3af', label: 'Draft',     gradient: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',  emoji: '' },
                        active:    { dot: KK.green,  label: 'Active',    gradient: 'linear-gradient(135deg, #ef4458 0%, #e60023 100%)',  emoji: '' },
                        paused:    { dot: KK.amber,  label: 'Scheduled', gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',  emoji: '⏰' },
                        completed: { dot: '#9ca3af', label: 'Ended',     gradient: 'linear-gradient(135deg, #6b7280 0%, #374151 100%)',  emoji: '✓' },
                      };
                      const sc = statusConfig[campaign.status] || statusConfig.draft;
                      const audienceCount = ((campaign.segments?.length || 0) + (campaign.activities?.length || 0)) * 1247 || 1820;
                      const openRate    = Math.round((campaign.ctr || 22) * 1.8);
                      const clickRate   = Math.round(campaign.ctr || 22);
                      const convertRate = Math.round((campaign.ctr || 22) * 0.42);
                      const isScheduled = campaign.status === 'paused';
                      const segmentLabel = campaign.segments?.length
                        ? SEGMENT_OPTIONS.find(s => s.value === campaign.segments[0])?.label || 'New-Member'
                        : 'All Active Members';

                      return (
                        <div
                          key={campaign.id}
                          onClick={() => handleView(campaign)}
                          className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col"
                        >
                          {/* Hero Image (real photo + gradient overlay) */}
                          <div className="relative h-44 overflow-hidden" style={{ background: sc.gradient }}>
                            {/* Image background */}
                            {campaign.image_url && (
                              <img
                                src={campaign.image_url}
                                alt={campaign.campaign_name}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            {/* Decorative emoji bg (fallback when no image) */}
                            {!campaign.image_url && (
                              <div className="absolute -right-2 -top-2 text-7xl opacity-20 select-none">{sc.emoji}</div>
                            )}
                            {/* Dark gradient overlay for text readability */}
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 35%, rgba(0,0,0,0.7) 100%)' }} />
                            {/* Status badge top-right */}
                            <span
                              className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm"
                              style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: sc.dot }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                              {sc.label}
                            </span>
                            {/* Campaign name overlay bottom */}
                            <div className="absolute inset-x-0 bottom-0 p-5">
                              <h3 className="text-white text-lg font-bold leading-tight drop-shadow-lg line-clamp-2">
                                {campaign.campaign_name}
                              </h3>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-5 flex-1 flex flex-col">
                            <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-2 flex-1">
                              {campaign.detail || `ส่วนลด ${clickRate}% สำหรับสมาชิก ${segmentLabel} — ใช้ที่สาขาทุกที่ภายใน 30 วันหลังสมัคร`}
                            </p>

                            {/* Audience row */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: KK.redLight }}>
                                  <Users className="w-3.5 h-3.5" style={{ color: KK.red }} />
                                </div>
                                <span className="font-medium">{segmentLabel}</span>
                              </div>
                              <span className="text-sm font-bold text-gray-900 tabular-nums">{audienceCount.toLocaleString()} คน</span>
                            </div>

                            {/* Metrics — 3 columns */}
                            {isScheduled ? (
                              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: KK.amberLight, border: `1px solid ${KK.amber}33` }}>
                                <p className="text-xs font-semibold flex items-center justify-center gap-1.5" style={{ color: KK.amber }}>
                                  <Calendar className="w-3.5 h-3.5" />
                                  จะส่ง {formatDate(campaign.start_date)}
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-2 rounded-xl p-3" style={{ backgroundColor: '#fafafa' }}>
                                <div className="text-center">
                                  <div className="text-[10px] text-gray-500 font-medium tracking-wide mb-1">เปิดอ่าน</div>
                                  <div className="text-base font-bold tabular-nums text-gray-900">{openRate}%</div>
                                </div>
                                <div className="text-center border-x border-gray-200">
                                  <div className="text-[10px] text-gray-500 font-medium tracking-wide mb-1">กดลิงก์</div>
                                  <div className="text-base font-bold tabular-nums" style={{ color: KK.red }}>{clickRate}%</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-[10px] text-gray-500 font-medium tracking-wide mb-1">ใช้สิทธิ์</div>
                                  <div className="text-base font-bold tabular-nums" style={{ color: KK.green }}>{convertRate}%</div>
                                </div>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleView(campaign); }}
                                className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg transition-colors"
                                style={{ color: KK.red, backgroundColor: KK.redLight }}
                              >
                                <Eye className="w-3.5 h-3.5" /> ดูรายละเอียด
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(campaign); }}
                                className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" /> ทำซ้ำ
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Campaign Detail View */
              selectedCampaignFromUrl && (
                <div className="space-y-6">
                  {/* Back Button */}
                  <Button variant="outline" onClick={() => navigate('/campaigns')}>
                    ← กลับไปรายการแคมเปญ
                  </Button>

                  {/* Campaign Detail Content */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">รายละเอียดแคมเปญ</CardTitle>
                      <CardDescription>
                        ข้อมูลและสถิติการทำงานของแคมเปญ
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Campaign Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div>
                          <p className="text-sm text-gray-500">รหัสแคมเปญ</p>
                          <p className="font-mono text-lg font-medium">{selectedCampaignFromUrl.campaign_code}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">ชื่อแคมเปญ</p>
                          <p className="font-medium text-lg">{selectedCampaignFromUrl.campaign_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">สถานะ</p>
                          {getStatusBadge(selectedCampaignFromUrl.status)}
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">ระยะเวลา</p>
                          <p className="font-medium">
                            {formatDate(selectedCampaignFromUrl.start_date)} - {formatDate(selectedCampaignFromUrl.end_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">ความถี่</p>
                          <p className="font-medium">
                            {FREQUENCY_OPTIONS.find(o => o.value === selectedCampaignFromUrl.frequency)?.label}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">CTR</p>
                          <p className="text-2xl font-bold text-green-600">{selectedCampaignFromUrl.ctr}%</p>
                        </div>
                      </div>

                      {/* Image Section */}
                      {selectedCampaignFromUrl.image_url && (
                        <div className="w-full">
                          <h3 className="text-lg font-semibold mb-3">รูปภาพแคมเปญ</h3>
                          <img
                            src={selectedCampaignFromUrl.image_url}
                            alt={selectedCampaignFromUrl.campaign_name}
                            className="w-full max-w-md h-64 object-cover rounded-lg border"
                          />
                        </div>
                      )}

                      {/* URL Section */}
                      {selectedCampaignFromUrl.campaign_url && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">ลิงก์แคมเปญ</h3>
                          <a
                            href={selectedCampaignFromUrl.campaign_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:underline break-all"
                          >
                            {selectedCampaignFromUrl.campaign_url}
                          </a>
                        </div>
                      )}

                      {/* Description */}
                      {selectedCampaignFromUrl.detail && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">รายละเอียด</h3>
                          <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedCampaignFromUrl.detail}</p>
                        </div>
                      )}

                      {/* Segments */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Segments</h3>
                        <div className="flex flex-wrap gap-2">
                          {(selectedCampaignFromUrl.segments || []).map((seg, i) => {
                            const option = SEGMENT_OPTIONS.find(o => o.value === seg);
                            return (
                              <Badge key={i} variant="outline" className="bg-white shadow-sm text-blue-700 border-gray-200">
                                {option?.label || seg}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Activities */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Activities</h3>
                        <div className="flex flex-wrap gap-2">
                          {(selectedCampaignFromUrl.activities || []).map((act, i) => {
                            const option = ACTIVITY_OPTIONS.find(o => o.value === act);
                            return (
                              <Badge key={i} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {option?.label || act}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Statistics */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-600">
                            {selectedCampaignFromUrl.recipients_count.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">ผู้รับ</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-cyan-600">
                            {selectedCampaignFromUrl.impressions_count.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">แสดงผล</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-chateau">
                            {selectedCampaignFromUrl.clicks_count.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">คลิก</p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4 border-t">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEdit(selectedCampaignFromUrl)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          แก้ไข
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => {
                            setSelectedCampaign(selectedCampaignFromUrl);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          ลบ
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            )}
          </main>
        </div>

        {/* Add/Edit Campaign Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-gray-600" />
                {isEditing ? 'แก้ไขแคมเปญ' : 'เพิ่มแคมเปญใหม่'}
              </DialogTitle>
              <DialogDescription>
                กรอกรายละเอียดแคมเปญสำหรับส่งโปรโมชันผ่าน LINE
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label>รูปโปรโมชัน</Label>
                <div className="w-full">
                  {imagePreview ? (
                    <div className="relative w-full">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview('');
                          setFormData(prev => ({ ...prev, image_url: '' }));
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-violet-400 bg-gray-50">
                      <ImageIcon className="w-10 h-10 text-gray-400" />
                      <span className="text-sm text-gray-500 mt-2">คลิกเพื่ออัปโหลดรูปโปรโมชัน</span>
                      <span className="text-xs text-gray-400 mt-1">รองรับไฟล์ PNG, JPG, GIF</span>
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
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign_code">รหัส Campaign *</Label>
                  <Input
                    id="campaign_code"
                    value={formData.campaign_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, campaign_code: e.target.value }))}
                    placeholder="เช่น C2024010001"
                    disabled={formLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign_name">ชื่อ Campaign *</Label>
                  <Input
                    id="campaign_name"
                    value={formData.campaign_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, campaign_name: e.target.value }))}
                    placeholder="เช่น โปรลดสนั่น ต้อนรับปีใหม่"
                    disabled={formLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_url">Campaign URL</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="campaign_url"
                    value={formData.campaign_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, campaign_url: e.target.value }))}
                    placeholder="https://example.com/promo"
                    className="pl-10"
                    disabled={formLoading}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">วันที่เริ่ม Campaign *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    disabled={formLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">วันสิ้นสุด Campaign *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    disabled={formLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">ความถี่ในการส่ง</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                    disabled={formLoading}
                  >
                    <SelectTrigger>
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

              {/* Detail */}
              <div className="space-y-2">
                <Label htmlFor="detail">Detail (ข้อความ)</Label>
                <Textarea
                  id="detail"
                  value={formData.detail}
                  onChange={(e) => setFormData(prev => ({ ...prev, detail: e.target.value }))}
                  placeholder="รายละเอียดแคมเปญ..."
                  rows={3}
                  disabled={formLoading}
                />
              </div>

              {/* Segments */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-600" />
                  Segment (ปัจจัยที่ส่งผลต่อการซื้อ)
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                  {SEGMENT_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.segments.includes(option.value)}
                        onChange={() => toggleSegment(option.value)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-violet-500"
                        disabled={formLoading}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Activities */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-600" />
                  Activity (กิจกรรมของ Lead)
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                  {ACTIVITY_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
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

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">สถานะ</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  disabled={formLoading}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Error */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}

              <DialogFooter>
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
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  disabled={formLoading}
                  className="bg-gray-900 text-white shadow-lg"
                >
                  {formLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {isEditing ? 'บันทึกการแก้ไข' : 'สร้างแคมเปญ'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Campaign Modal - REMOVED - Now using URL routing instead */}
        {/* All dialog content removed - moved to URL routing */}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบแคมเปญ</AlertDialogTitle>
              <AlertDialogDescription>
                คุณต้องการลบแคมเปญ "{selectedCampaign?.campaign_name}" ใช่หรือไม่?
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบแคมเปญ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminGuard>
  );
};

export default CampaignManagement;
