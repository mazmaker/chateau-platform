import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PotentialScoreCard } from '@/components/leads/PotentialScoreCard';
import { LoanEstimationCard } from '@/components/leads/LoanEstimationCard';
import { LeadSourceEditor } from '@/components/leads/LeadSourceEditor';
import { getPurchasePurposeLabel as sharedGetPurchasePurposeLabel } from '@/lib/purchasePurpose';
import { calculateLeadScore } from '@/lib/leadScoring';
import { estimateLoan } from '@/lib/loanEstimation';
import type { LeadScoringData, PotentialScore, LoanEstimation } from '@/types/leadScoring';
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
  // Optional scoring fields (set when present in DB)
  credit_score?: number | null;
  monthly_income?: number | null;
  monthly_debt?: number | null;
  employment_type?: string | null;
  years_employed?: number | null;
  age?: number | null;
  gender?: string | null;
  marital_status?: string | null;
  education?: string | null;
  household_size?: number | null;
  number_of_dependents?: number | null;
  is_first_time_buyer?: boolean | null;
  has_co_borrower?: boolean | null;
  existing_properties?: number | null;
  down_payment_ready?: number | null;
  savings?: number | null;
  urgency_level?: string | null;
  decision_maker?: boolean | null;
  financing_approved?: boolean | null;
  website_visits?: number | null;
  pages_viewed?: number | null;
  time_on_site?: number | null;
  brochure_downloads?: number | null;
  site_visit_attended?: boolean | null;
  sold_property_recently?: boolean | null;
  workplace?: string | null;
  company_name?: string | null;
  priority?: string | null;
  estimated_value?: number | null;
  expected_close_date?: string | null;
  last_contact_date?: string | null;
  next_follow_up?: string | null;
  potential_score?: number | null;
  financial_score?: number | null;
  engagement_score?: number | null;
  urgency_score?: number | null;
  fit_score?: number | null;
  conversion_probability?: number | null;
  // Catch-all for misc DB columns referenced by scoring/loan calculators
  [key: string]: any;
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

  // Real Lead Scoring & Loan Estimation
  const [leadScore, setLeadScore] = useState<PotentialScore | null>(null);
  const [loanEstimation, setLoanEstimation] = useState<LoanEstimation | null>(null);
  const [mlProbability, setMlProbability] = useState<number | null>(null);

  // Get currently selected interest
  const selectedInterest = interests.find(i => i.id === selectedInterestId);

  useEffect(() => {
    if (leadId && currentTenant) {
      fetchLeadData();
    }
  }, [leadId, currentTenant]);

  // Calculate lead score and loan estimation whenever customer or lead data changes
  useEffect(() => {
    if (customer && lead && (selectedInterest || unit || interests.length === 0)) {
      calculateScoresAndEstimation();
    }
  }, [customer, lead, selectedInterest, unit]);

  // Re-apply ML probability when it arrives after initial score calculation
  useEffect(() => {
    if (mlProbability !== null && leadScore) {
      setLeadScore(prev => prev ? {
        ...prev,
        conversion_probability: mlProbability,
        overall_score: Math.round(mlProbability * 100),
      } as any : prev);
    }
  }, [mlProbability]);

  const fetchMLScore = async (leadData: Lead) => {
    if (!currentTenant) return;
    try {
      const res = await fetch(
        'https://pqnjvcbmnatrtvpqnrdx.supabase.co/functions/v1/score-lead',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: currentTenant.id,
            features: {
              credit_score:       leadData.credit_score       ?? null,
              monthly_income:     leadData.monthly_income     ?? null,
              monthly_debt:       leadData.monthly_debt       ?? null,
              down_payment_ready: leadData.down_payment_ready ?? null,
              savings:            leadData.savings            ?? null,
              years_employed:     leadData.years_employed     ?? null,
              dti_ratio:          leadData.dti_ratio          ?? null,
              ltv_ratio:          leadData.ltv_ratio          ?? null,
              website_visits:     leadData.website_visits     ?? null,
              pages_viewed:       leadData.pages_viewed       ?? null,
              time_on_site:       leadData.time_on_site       ?? null,
              brochure_downloads: leadData.brochure_downloads ?? null,
              site_visit_attended: leadData.site_visit_attended ? 1 : 0,
              financial_score:    leadData.financial_score    ?? null,
              engagement_score:   leadData.engagement_score   ?? null,
              urgency_score:      leadData.urgency_score      ?? null,
              fit_score:          leadData.fit_score          ?? null,
              age:                leadData.age                ?? null,
              decision_maker:     leadData.decision_maker     ? 1 : 0,
              financing_approved: leadData.financing_approved ? 1 : 0,
            },
          }),
        },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.conversion_probability === 'number') {
          setMlProbability(json.conversion_probability);
        }
      }
    } catch (err) {
      console.error('ML scoring error:', err);
    }
  };

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
        fetchMLScore(leadData);

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

  // Calculate lead score and loan estimation with real data
  const calculateScoresAndEstimation = () => {
    if (!customer || !lead) return;

    const prefs = customer.preferences || {};
    const currentInterest = selectedInterest;
    // fallback unit when no lead_interests exist
    const effectiveUnit = currentInterest?.unit ?? unit;

    // Prepare lead scoring data — DB columns return null, scoring type expects undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoringData: LeadScoringData = {
      credit_score: lead.credit_score ?? undefined,
      monthly_income: lead.monthly_income ?? undefined,
      monthly_debt: lead.monthly_debt ?? undefined,
      employment_type: (lead.employment_type ?? undefined) as any,
      years_employed: lead.years_employed ?? undefined,

      age: lead.age ?? undefined,
      gender: (lead.gender ?? undefined) as any,
      marital_status: (lead.marital_status ?? undefined) as any,
      education: (lead.education ?? undefined) as any,
      household_size: lead.household_size ?? undefined,

      down_payment_ready: lead.down_payment_ready ?? undefined,
      savings: lead.savings ?? undefined,

      // Behavioral (mock data for now - would come from tracking)
      website_visits: 5,
      pages_viewed: 15,
      time_on_site: 30,

      urgency_level: currentInterest?.interest_level === 'high' ? 'high' :
                     currentInterest?.interest_level === 'low' ? 'low' : 'medium',
      interest_level: currentInterest?.interest_level || 'medium',

      budget_max: (effectiveUnit as any)?.price || (property as any)?.base_price || 0,
      purchase_timeline: '3_months',
    } as any;

    // Calculate potential score
    try {
      const score = calculateLeadScore(scoringData);
      // Override with ML model result when available
      if (mlProbability !== null) {
        (score as any).conversion_probability = mlProbability;
        (score as any).overall_score = Math.round(mlProbability * 100);
      }
      setLeadScore(score);
    } catch (error) {
      console.error('Error calculating lead score:', error);
      setLeadScore(null);
    }

    // Calculate loan estimation if we have enough financial data
    if (lead.monthly_income && (effectiveUnit as any)?.price) {
      try {
        const estimation = estimateLoan({
          monthly_income: lead.monthly_income ?? undefined,
          monthly_debt: lead.monthly_debt || 0,
          property_value: (effectiveUnit as any).price,
          down_payment: lead.down_payment_ready || 0,
          credit_score: lead.credit_score || 700,
          age: lead.age ?? undefined,
          employment_type: (lead.employment_type ?? undefined) as any,
          years_employed: lead.years_employed ?? undefined,
        });
        setLoanEstimation(estimation);
      } catch (error) {
        console.error('Error calculating loan estimation:', error);
        setLoanEstimation(null);
      }
    } else {
      setLoanEstimation(null);
    }
  };

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

  const getPurchasePurposeLabel = (purpose?: string) => sharedGetPurchasePurposeLabel(purpose);

  const getSourceLabel = (source?: string) => {
    const labels: Record<string, string> = {
      website: 'Website', facebook: 'Facebook', line: 'LINE', referral: 'แนะนำ',
      walk_in: 'Walk-in', online_google: 'Google', online_facebook: 'Facebook'
    };
    return labels[source || ''] || source || '-';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                <Target className="w-7 h-7 text-chateau" />
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
              <Card className="shadow-soft border border-gray-200 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-chateau to-chateau-600 text-white">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    ข้อมูล Lead
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="w-12 h-12 bg-chateau-50 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-chateau" />
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
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <Phone className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-xs text-gray-500">เบอร์โทร</p>
                          <p className="font-medium">{customer?.phone || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <Mail className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-xs text-gray-500">อีเมล</p>
                          <p className="font-medium">{customer?.email || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <Briefcase className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="text-xs text-gray-500">สถานที่ทำงาน</p>
                          <p className="font-medium">{prefs.workplace || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <MapPin className="w-5 h-5 text-chateau" />
                        <div>
                          <p className="text-xs text-gray-500">ที่อยู่</p>
                          <p className="font-medium text-sm">
                            {prefs.address ?
                              `${prefs.address.sub_district || ''} ${prefs.address.district || ''} ${prefs.address.province || ''}`.trim() || '-'
                              : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <Globe className="w-5 h-5 text-cyan-500" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 mb-1">แหล่งที่มาของ Lead</p>
                          {lead?.id && (
                            <LeadSourceEditor
                              leadId={lead.id}
                              currentSource={lead.source}
                              onUpdated={(newSource) => {
                                setLead((prev: any) => prev ? { ...prev, source: newSource } : prev);
                              }}
                            />
                          )}
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
              <Card className="shadow-soft border border-gray-200 overflow-hidden h-full">
                <CardHeader className="bg-gray-50 border-b border-gray-100">
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <Home className="w-5 h-5 text-chateau" />
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
                                ? 'border-chateau bg-chateau-50/40 shadow-soft'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-chateau text-white' : 'bg-gray-100'
                              }`}>
                                <Building2 className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{interest.property?.name || 'โครงการ'}</p>
                                <p className="text-xs text-gray-500">ยูนิต {interest.unit?.unit_number || '-'}</p>
                                {interest.unit?.price && (
                                  <p className="text-xs font-semibold text-chateau">{formatCurrency(interest.unit.price)}</p>
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
                    <div className="p-3 rounded-lg border-2 border-chateau bg-chateau-50/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-chateau rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{property?.name || '-'}</p>
                          <p className="text-xs text-gray-500">ยูนิต {unit?.unit_number || '-'}</p>
                          <p className="text-xs font-semibold text-chateau">{formatCurrency((unit as any)?.price || 0)}</p>
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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
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
                    <p className="text-xs text-chateau font-medium">กำลังวิเคราะห์ข้อมูลยูนิต</p>
                    <Badge className={getInterestStatusBadge(selectedInterest.status).color}>
                      {getInterestStatusBadge(selectedInterest.status).label}
                    </Badge>
                  </div>
                  <p className="font-bold text-lg text-gray-900">{selectedInterest.property?.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>ยูนิต <strong>{selectedInterest.unit?.unit_number}</strong></span>
                    {selectedInterest.unit?.price && (
                      <span className="font-bold text-chateau">{formatCurrency(selectedInterest.unit.price)}</span>
                    )}
                    <span className={getInterestLevelBadge(selectedInterest.interest_level).color}>
                      {getInterestLevelBadge(selectedInterest.interest_level).label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
                  <Target className="w-4 h-4 text-chateau" />
                  <span className="text-sm font-medium">{getPurchasePurposeLabel(prefs.purchase_purpose)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Lead Scoring & Loan Estimation - Real Components */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Lead Potential Score Card */}
            {leadScore && <PotentialScoreCard score={leadScore} />}

            {/* Loan Estimation Card */}
            {loanEstimation && <LoanEstimationCard estimation={loanEstimation} />}

            {/* Show message if no data available */}
            {!leadScore && !loanEstimation && (
              <Card className="shadow-soft border border-gray-200 lg:col-span-2">
                <CardContent className="p-8 text-center">
                  <div className="text-gray-400 mb-3">
                    <BarChart3 className="w-16 h-16 mx-auto" />
                  </div>
                  <p className="text-lg font-medium text-gray-600">ไม่สามารถคำนวณคะแนนได้</p>
                  <p className="text-sm text-gray-500 mt-2">
                    กรุณาเพิ่มข้อมูลการเงินและอาชีพของลูกค้าเพื่อดูการวิเคราะห์
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

        </main>
      </div>
    </div>
  );
};

export default LeadCDP;
