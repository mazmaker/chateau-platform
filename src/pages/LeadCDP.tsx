import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  Users,
  GraduationCap,
  Heart,
  Calendar,
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Home,
  BarChart3,
  CheckCircle,
  XCircle,
  Globe,
  Layers,
  Ruler,
  BedDouble,
  Bath,
  Building,
  Wallet
} from 'lucide-react';
import {
  InterestStatus,
  InterestLevel,
  INTEREST_STATUS_OPTIONS,
  INTEREST_LEVEL_OPTIONS,
} from '@/types/lead-interest';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { supabase } from '@/lib/supabase';

interface Lead {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string;
  unit_id?: string;
  status: string;
  source: string;
  notes: string;
  created_at: string;
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  preferences?: {
    first_name?: string;
    last_name?: string;
    gender?: string;
    age?: number;
    marital_status?: string;
    education?: string;
    family_members?: number;
    occupation?: string;
    monthly_income?: number;
    monthly_debt?: number;
    workplace?: string;
    address?: {
      province?: string;
      district?: string;
      sub_district?: string;
    };
    purchase_purpose?: string;
  };
}

interface Property {
  id: string;
  name: string;
  type: string;
  location?: string;
  thumbnail_url?: string;
}

interface Unit {
  id: string;
  unit_number: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  floor?: number;
  thumbnail_url?: string;
}

interface LeadInterestWithDetails {
  id: string;
  lead_id: string;
  property_id: string;
  unit_id: string;
  status: InterestStatus;
  interest_level: InterestLevel;
  notes?: string;
  viewing_date?: string;
  created_at: string;
  property?: Property;
  unit?: Unit;
}

const LeadCDP = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [interests, setInterests] = useState<LeadInterestWithDetails[]>([]);
  const [selectedInterestId, setSelectedInterestId] = useState<string>('');
  // Keep legacy single property/unit for backwards compatibility
  const [property, setProperty] = useState<Property | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);

  useEffect(() => {
    if (leadId && currentTenant) {
      fetchLeadData();
    }
  }, [leadId, currentTenant]);

  const fetchLeadData = async () => {
    setLoading(true);
    try {
      // Fetch lead
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadData) {
        setLead(leadData);

        // Fetch customer
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', leadData.customer_id)
          .single();
        setCustomer(customerData);

        // Fetch lead interests with property and unit details
        const { data: interestsData } = await supabase
          .from('lead_interests')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });

        if (interestsData && interestsData.length > 0) {
          // Fetch all properties and units for the interests
          const propertyIds = [...new Set(interestsData.map(i => i.property_id))];
          const unitIds = [...new Set(interestsData.map(i => i.unit_id))];

          const [{ data: propertiesData }, { data: unitsData }] = await Promise.all([
            supabase.from('properties').select('*').in('id', propertyIds),
            supabase.from('units').select('*').in('id', unitIds)
          ]);

          const propertiesMap = new Map((propertiesData || []).map(p => [p.id, p]));
          const unitsMap = new Map((unitsData || []).map(u => [u.id, u]));

          const enrichedInterests: LeadInterestWithDetails[] = interestsData.map(interest => ({
            ...interest,
            property: propertiesMap.get(interest.property_id),
            unit: unitsMap.get(interest.unit_id)
          }));

          setInterests(enrichedInterests);
          // Select the first interest by default
          if (enrichedInterests.length > 0) {
            setSelectedInterestId(enrichedInterests[0].id);
          }
        }

        // Fallback: Fetch legacy property/unit from lead if no interests
        const { data: propertyData } = await supabase
          .from('properties')
          .select('*')
          .eq('id', leadData.property_id)
          .single();
        setProperty(propertyData);

        if (leadData.unit_id) {
          const { data: unitData } = await supabase
            .from('units')
            .select('*')
            .eq('id', leadData.unit_id)
            .single();
          setUnit(unitData);
        }
      }
    } catch (error) {
      console.error('Error fetching lead data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Get currently selected interest
  const selectedInterest = interests.find(i => i.id === selectedInterestId);

  // Helper function to generate mock data per interest
  const getInterestAnalysis = (interest: LeadInterestWithDetails | undefined) => {
    // Use interest ID for consistent random data per unit
    const baseNum = interest ? parseInt(interest.id.replace(/\D/g, '').slice(0, 8) || '0') : 0;
    const interestLevelBonus = interest?.interest_level === 'high' ? 15 : interest?.interest_level === 'medium' ? 5 : 0;

    const potentialScore = Math.min(95, Math.floor((baseNum % 30) + 55 + interestLevelBonus));
    const buyChance = potentialScore;
    const notBuyChance = 100 - potentialScore;

    const prefs = customer?.preferences || {};
    const monthlyIncome = prefs.monthly_income || 50000 + (baseNum % 10) * 10000;
    const monthlyDebt = prefs.monthly_debt || 5000 + (baseNum % 5) * 2000;
    const unitPrice = interest?.unit?.price || 3000000 + (baseNum % 5) * 500000;
    const loanAmount = Math.round(unitPrice * (0.7 + ((baseNum % 20) / 100)));

    const loanComparisonData = [
      { name: 'ราคาบ้าน', value: unitPrice, fill: '#6366f1' },
      { name: 'วงเงินกู้', value: loanAmount, fill: '#22c55e' }
    ];

    const potentialGaugeData = [
      { name: 'score', value: potentialScore, fill: potentialScore >= 70 ? '#22c55e' : potentialScore >= 50 ? '#eab308' : '#ef4444' }
    ];

    const positiveFactors = {
      financial: [
        { name: 'ภาระหนี้สินรวม', value: Math.min(95, 75 + (baseNum % 20)), icon: CreditCard },
        { name: 'รายได้ต่อเดือน', value: Math.min(95, 68 + (baseNum % 25)), icon: Wallet }
      ],
      property: [
        { name: 'จำนวนยูนิตในโครงการ', value: Math.min(95, 82 + (baseNum % 15)), icon: Building },
        { name: 'ราคาขาย', value: Math.min(95, 71 + (baseNum % 20)), icon: DollarSign },
        { name: 'ขนาดพื้นที่ใช้สอย', value: Math.min(95, 65 + (baseNum % 30)), icon: Ruler },
        { name: 'ขนาดที่ดิน', value: Math.min(95, 58 + (baseNum % 35)), icon: Layers },
        { name: 'จำนวนห้องน้ำ', value: Math.min(95, 72 + (baseNum % 20)), icon: Bath },
        { name: 'จำนวนชั้นของยูนิต', value: Math.min(95, 61 + (baseNum % 30)), icon: Building2 },
        { name: 'จำนวนห้องนอน', value: Math.min(95, 77 + (baseNum % 18)), icon: BedDouble }
      ],
      demographic: [
        { name: 'จำนวนสมาชิกในครอบครัว', value: Math.min(95, 69 + (baseNum % 25)), icon: Users },
        { name: 'อายุ', value: Math.min(95, 74 + (baseNum % 20)), icon: Calendar },
        { name: 'ระดับการศึกษา', value: Math.min(95, 66 + (baseNum % 28)), icon: GraduationCap },
        { name: 'อาชีพ', value: Math.min(95, 78 + (baseNum % 17)), icon: Briefcase }
      ],
      geographic: [
        { name: 'อำเภอสถานที่ทำงาน', value: Math.min(95, 63 + (baseNum % 30)), icon: MapPin },
        { name: 'อำเภอที่ตั้งโครงการ', value: Math.min(95, 71 + (baseNum % 22)), icon: Building2 },
        { name: 'ตำบลสถานที่ทำงาน', value: Math.min(95, 55 + (baseNum % 38)), icon: Globe },
        { name: 'จังหวัดสถานที่ทำงาน', value: Math.min(95, 68 + (baseNum % 25)), icon: MapPin },
        { name: 'ตำบลที่ตั้งโครงการ', value: Math.min(95, 59 + (baseNum % 33)), icon: Globe }
      ]
    };

    const negativeFactors = {
      property: [
        { name: 'สิ่งอำนวยความสะดวก', value: 35 + (baseNum % 25), icon: Home },
        { name: 'ประเภทโครงการ', value: 28 + (baseNum % 30), icon: Building }
      ],
      demographic: [
        { name: 'สถานภาพการสมรส', value: 22 + (baseNum % 35), icon: Heart },
        { name: 'เพศ', value: 18 + (baseNum % 28), icon: User }
      ],
      geographic: [
        { name: 'จังหวัดที่ตั้งโครงการ', value: 31 + (baseNum % 30), icon: MapPin }
      ]
    };

    return {
      potentialScore,
      buyChance,
      notBuyChance,
      monthlyIncome,
      monthlyDebt,
      unitPrice,
      loanAmount,
      loanComparisonData,
      potentialGaugeData,
      positiveFactors,
      negativeFactors
    };
  };

  // Get analysis for selected interest or fallback to legacy data
  const currentAnalysis = getInterestAnalysis(selectedInterest);
  const { potentialScore, buyChance, notBuyChance, monthlyIncome, monthlyDebt, unitPrice, loanAmount, loanComparisonData, potentialGaugeData, positiveFactors, negativeFactors } = currentAnalysis;

  const prefs = customer?.preferences || {};

  // Helper to get interest status label
  const getInterestStatusBadge = (status: InterestStatus) => {
    const option = INTEREST_STATUS_OPTIONS.find(o => o.value === status);
    return option ? { label: `${option.icon} ${option.label}`, color: option.color } : { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  const getInterestLevelBadge = (level: InterestLevel) => {
    const option = INTEREST_LEVEL_OPTIONS.find(o => o.value === level);
    return option ? { label: `${option.icon} ${option.label}`, color: option.color } : { label: level, color: 'text-gray-600' };
  };

  const getGenderLabel = (gender?: string) => {
    const labels: Record<string, string> = { male: 'ชาย', female: 'หญิง', other: 'อื่นๆ' };
    return labels[gender || ''] || '-';
  };

  const getMaritalLabel = (status?: string) => {
    const labels: Record<string, string> = { single: 'โสด', married: 'สมรส', widowed: 'หม้าย', divorced: 'หย่า' };
    return labels[status || ''] || '-';
  };

  const getEducationLabel = (edu?: string) => {
    const labels: Record<string, string> = {
      primary: 'ประถมศึกษา', junior_high: 'ม.ต้น', senior_high: 'ม.ปลาย',
      vocational: 'ปวช./ปวส.', bachelor: 'ปริญญาตรี', master: 'ปริญญาโท', doctorate: 'ปริญญาเอก'
    };
    return labels[edu || ''] || '-';
  };

  const getPurchasePurposeLabel = (purpose?: string) => {
    const labels: Record<string, string> = {
      residence: 'เพื่ออยู่อาศัย', speculation: 'เก็งกำไร', monthly_rent: 'ปล่อยเช่ารายเดือน',
      daily_rent: 'ปล่อยเช่ารายวัน', investment: 'ลงทุน', children: 'ซื้อให้บุตรหลาน'
    };
    return labels[purpose || ''] || '-';
  };

  const getSourceLabel = (source?: string) => {
    const labels: Record<string, string> = {
      website: 'Website', facebook: 'Facebook', line: 'LINE', referral: 'แนะนำ',
      walk_in: 'Walk-in', online_google: 'Google', online_facebook: 'Facebook'
    };
    return labels[source || ''] || source || '-';
  };

  const FactorBar = ({ name, value, icon: Icon, isPositive = true }: { name: string; value: number; icon: any; isPositive?: boolean }) => (
    <div className="flex items-center gap-3 py-2">
      <Icon className={`w-4 h-4 ${isPositive ? 'text-cyan-600' : 'text-pink-600'}`} />
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-700">{name}</span>
          <span className={`font-semibold ${isPositive ? 'text-cyan-600' : 'text-pink-600'}`}>{value}%</span>
        </div>
        <Progress value={value} className={`h-2 ${isPositive ? '[&>div]:bg-cyan-500' : '[&>div]:bg-pink-500'}`} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6">
          {/* Back Button & Title */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" size="sm" onClick={() => navigate('/leads')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับ
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-7 h-7 text-violet-600" />
                Customer Data Platform (CDP)
              </h1>
              <p className="text-gray-600">รายละเอียดและการวิเคราะห์ข้อมูลลูกค้า</p>
            </div>
          </div>

          {/* Row 1: Lead Info + Unit Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Left Column - Lead Information */}
            <div className="lg:col-span-2">
              {/* Section 1: Lead Information */}
              <Card className="shadow-lg border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-600 text-white">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    ข้อมูล Lead
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg">
                        <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">ชื่อ - นามสกุล</p>
                          <p className="font-semibold text-lg">
                            {prefs.first_name || ''} {prefs.last_name || customer?.full_name || '-'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <User className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">เพศ</p>
                            <p className="font-medium text-sm">{getGenderLabel(prefs.gender)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">อายุ</p>
                            <p className="font-medium text-sm">{prefs.age || '-'} ปี</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Heart className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">สถานภาพ</p>
                            <p className="font-medium text-sm">{getMaritalLabel(prefs.marital_status)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <GraduationCap className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">การศึกษา</p>
                            <p className="font-medium text-sm">{getEducationLabel(prefs.education)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg col-span-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">สมาชิกในครอบครัว</p>
                            <p className="font-medium text-sm">{prefs.family_members || '-'} คน</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <Phone className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500">เบอร์โทร</p>
                          <p className="font-medium">{customer?.phone || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <Mail className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-xs text-gray-500">อีเมล</p>
                          <p className="font-medium">{customer?.email || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                        <Briefcase className="w-5 h-5 text-orange-600" />
                        <div>
                          <p className="text-xs text-gray-500">สถานที่ทำงาน</p>
                          <p className="font-medium">{prefs.workplace || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <MapPin className="w-5 h-5 text-purple-600" />
                        <div>
                          <p className="text-xs text-gray-500">ที่อยู่</p>
                          <p className="font-medium text-sm">
                            {prefs.address ?
                              `${prefs.address.sub_district || ''} ${prefs.address.district || ''} ${prefs.address.province || ''}`.trim() || '-'
                              : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg">
                        <Globe className="w-5 h-5 text-teal-600" />
                        <div>
                          <p className="text-xs text-gray-500">แหล่งที่มาของ Lead</p>
                          <Badge variant="outline" className="mt-1">{getSourceLabel(lead?.source)}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Unit Selection */}
            <div className="lg:col-span-1">
              {/* Section 2: Unit Interests */}
              <Card className="shadow-lg border-0 overflow-hidden h-full">
                <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                  <CardTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5" />
                    เลือกยูนิตที่สนใจ ({interests.length > 0 ? interests.length : 1})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                  {interests.length > 0 ? (
                    <div className="space-y-2">
                      {interests.map((interest) => {
                        const statusBadge = getInterestStatusBadge(interest.status);
                        const levelBadge = getInterestLevelBadge(interest.interest_level);
                        const isSelected = interest.id === selectedInterestId;
                        return (
                          <button
                            key={interest.id}
                            onClick={() => setSelectedInterestId(interest.id)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              isSelected
                                ? 'border-cyan-500 bg-cyan-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-cyan-200' : 'bg-gray-100'
                              }`}>
                                <Building2 className={`w-5 h-5 ${isSelected ? 'text-cyan-700' : 'text-gray-500'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{interest.property?.name || 'โครงการ'}</p>
                                <p className="text-xs text-gray-500">ยูนิต {interest.unit?.unit_number || '-'}</p>
                                {interest.unit?.price && (
                                  <p className="text-xs font-semibold text-cyan-600">{formatCurrency(interest.unit.price)}</p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                <Badge className={`${statusBadge.color} text-xs`}>
                                  {statusBadge.label}
                                </Badge>
                                <span className={`text-xs ${levelBadge.color}`}>{levelBadge.label}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    // Fallback to legacy single unit display
                    <div className="p-3 rounded-lg border-2 border-cyan-500 bg-cyan-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-200 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-cyan-700" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{property?.name || '-'}</p>
                          <p className="text-xs text-gray-500">ยูนิต {unit?.unit_number || '-'}</p>
                          <p className="text-xs font-semibold text-cyan-600">{formatCurrency(unitPrice)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Row 2: Selected Unit Details + Analysis */}
          {selectedInterest && (
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-24 h-20 bg-gray-200 rounded-lg overflow-hidden shadow-md flex-shrink-0">
                  {selectedInterest.unit?.thumbnail_url || selectedInterest.property?.thumbnail_url ? (
                    <img
                      src={selectedInterest.unit?.thumbnail_url || selectedInterest.property?.thumbnail_url}
                      alt="Unit"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-violet-600 font-medium">กำลังวิเคราะห์ข้อมูลยูนิต</p>
                    <Badge className={getInterestStatusBadge(selectedInterest.status).color}>
                      {getInterestStatusBadge(selectedInterest.status).label}
                    </Badge>
                  </div>
                  <p className="font-bold text-lg text-gray-900">{selectedInterest.property?.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>ยูนิต <strong>{selectedInterest.unit?.unit_number}</strong></span>
                    {selectedInterest.unit?.price && (
                      <span className="font-bold text-cyan-600">{formatCurrency(selectedInterest.unit.price)}</span>
                    )}
                    <span className={getInterestLevelBadge(selectedInterest.interest_level).color}>
                      {getInterestLevelBadge(selectedInterest.interest_level).label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">{getPurchasePurposeLabel(prefs.purchase_purpose)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Loan Potential + Potential Score (Equal Height) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Loan Potential */}
            <Card className="shadow-lg border-0 overflow-hidden flex flex-col">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  ศักยภาพในการขอสินเชื่อ
                  {selectedInterest && (
                    <span className="text-xs font-normal opacity-80 ml-2">
                      (ยูนิต {selectedInterest.unit?.unit_number})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col justify-center">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Chart */}
                  <div className="h-48 min-h-[192px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={192}>
                      <BarChart data={loanComparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                        <YAxis type="category" dataKey="name" width={80} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {loanComparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">รายได้ต่อเดือน</p>
                          <p className="text-lg font-bold text-green-600">{formatCurrency(monthlyIncome)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">ภาระหนี้ต่อเดือน</p>
                          <p className="text-lg font-bold text-red-600">{formatCurrency(monthlyDebt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">ประมาณการวงเงินกู้</p>
                          <p className="text-lg font-bold text-blue-600">{formatCurrency(loanAmount)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Potential Score */}
            <Card className="shadow-lg border-0 overflow-hidden flex flex-col">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Potential Score
                  {selectedInterest && (
                    <span className="text-xs font-normal opacity-80 ml-2">
                      (ยูนิต {selectedInterest.unit?.unit_number})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col justify-center">
                {/* Gauge Chart */}
                <div className="flex flex-col items-center mb-4">
                  <div className="h-36 min-h-[144px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%" minHeight={144}>
                      <RadialBarChart
                        cx="50%"
                        cy="100%"
                        innerRadius="75%"
                        outerRadius="95%"
                        startAngle={180}
                        endAngle={0}
                        data={potentialGaugeData}
                      >
                        <RadialBar
                          background
                          dataKey="value"
                          cornerRadius={5}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    {/* Score text positioned inside the gauge */}
                    <div className="absolute inset-0 flex items-end justify-center pb-2">
                      <div className="text-center">
                        <p className={`text-4xl font-bold ${potentialScore >= 70 ? 'text-green-600' : potentialScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {potentialScore}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm mt-2">Potential Score</p>
                </div>

                {/* Buy/Not Buy Chance */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-xl text-center border border-green-100">
                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600">{buyChance}%</p>
                    <p className="text-xs text-gray-600">โอกาสซื้อ</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl text-center border border-red-100">
                    <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-500">{notBuyChance}%</p>
                    <p className="text-xs text-gray-600">โอกาสไม่ซื้อ</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 4: Factors (Positive + Negative Side by Side) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Positive Factors */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-cyan-500 to-teal-600 text-white py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-5 h-5" />
                  ปัจจัยที่ส่งผลให้ขายได้
                  {selectedInterest && (
                    <span className="text-xs font-normal opacity-80 ml-1">
                      (ยูนิต {selectedInterest.unit?.unit_number})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                {/* Financial */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-cyan-600" />
                    สถานะทางการเงิน
                  </h4>
                  <div className="space-y-1">
                    {positiveFactors.financial.map((f, i) => (
                      <FactorBar key={i} name={f.name} value={f.value} icon={f.icon} isPositive />
                    ))}
                  </div>
                </div>

                {/* Property */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-600" />
                    โครงสร้างอสังหาริมทรัพย์
                  </h4>
                  <div className="space-y-1">
                    {positiveFactors.property.map((f, i) => (
                      <FactorBar key={i} name={f.name} value={f.value} icon={f.icon} isPositive />
                    ))}
                  </div>
                </div>

                {/* Demographic */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-600" />
                    ข้อมูลประชากร
                  </h4>
                  <div className="space-y-1">
                    {positiveFactors.demographic.map((f, i) => (
                      <FactorBar key={i} name={f.name} value={f.value} icon={f.icon} isPositive />
                    ))}
                  </div>
                </div>

                {/* Geographic */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-600" />
                    ข้อมูลภูมิศาสตร์
                  </h4>
                  <div className="space-y-1">
                    {positiveFactors.geographic.map((f, i) => (
                      <FactorBar key={i} name={f.name} value={f.value} icon={f.icon} isPositive />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Negative Factors */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-600 text-white py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="w-5 h-5" />
                  ปัจจัยที่ส่งผลให้ขายไม่ได้
                  {selectedInterest && (
                    <span className="text-xs font-normal opacity-80 ml-1">
                      (ยูนิต {selectedInterest.unit?.unit_number})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                {/* Property */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-pink-600" />
                    โครงสร้างอสังหาริมทรัพย์
                  </h4>
                  <div className="space-y-1">
                    {negativeFactors.property.map((f, i) => (
                      <FactorBar key={i} name={f.name} value={f.value} icon={f.icon} isPositive={false} />
                    ))}
                  </div>
                </div>

                {/* Demographic */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-600" />
                    ข้อมูลประชากร
                  </h4>
                  <div className="space-y-1">
                    {negativeFactors.demographic.map((f, i) => (
                      <FactorBar key={i} name={f.name} value={f.value} icon={f.icon} isPositive={false} />
                    ))}
                  </div>
                </div>

                {/* Geographic */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-pink-600" />
                    ข้อมูลภูมิศาสตร์
                  </h4>
                  <div className="space-y-1">
                    {negativeFactors.geographic.map((f, i) => (
                      <FactorBar key={i} name={f.name} value={f.value} icon={f.icon} isPositive={false} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LeadCDP;
