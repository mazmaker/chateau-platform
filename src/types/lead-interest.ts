// Lead Interest types for tracking multiple unit interests per lead

export type InterestStatus =
  | 'interested'
  | 'viewing_scheduled'
  | 'viewed'
  | 'negotiating'
  | 'reserved'
  | 'won'
  | 'lost'
  | 'dropped';

export type InterestLevel = 'high' | 'medium' | 'low';

export interface LeadInterest {
  id: string;
  tenant_id: string;
  lead_id: string;
  property_id: string;
  unit_id: string;
  status: InterestStatus;
  interest_level: InterestLevel;
  notes?: string;
  viewing_date?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadInterestWithDetails extends LeadInterest {
  property?: {
    id: string;
    name: string;
    type: string;
  };
  unit?: {
    id: string;
    unit_number: string;
    price?: number;
    status?: string;
  };
}

export const INTEREST_STATUS_OPTIONS: { value: InterestStatus; label: string; icon: string; color: string }[] = [
  { value: 'interested', label: 'สนใจ', icon: '', color: 'bg-blue-100 text-blue-800' },
  { value: 'viewing_scheduled', label: 'นัดดูห้อง', icon: '', color: 'bg-purple-100 text-purple-800' },
  { value: 'viewed', label: 'ดูแล้ว', icon: '', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'negotiating', label: 'กำลังเจรจา', icon: '', color: 'bg-orange-100 text-orange-800' },
  { value: 'reserved', label: 'จอง', icon: '', color: 'bg-chateau-100 text-chateau-700' },
  { value: 'won', label: 'ปิดการขาย', icon: '', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'ไม่สำเร็จ', icon: '', color: 'bg-red-100 text-red-800' },
  { value: 'dropped', label: 'ไม่สนใจแล้ว', icon: '', color: 'bg-gray-100 text-gray-800' },
];

export const INTEREST_LEVEL_OPTIONS: { value: InterestLevel; label: string; icon: string; color: string }[] = [
  { value: 'high', label: 'สนใจมาก', icon: '', color: 'text-red-600' },
  { value: 'medium', label: 'สนใจปานกลาง', icon: '', color: 'text-yellow-600' },
  { value: 'low', label: 'สนใจน้อย', icon: '', color: 'text-blue-600' },
];

export const getInterestStatusLabel = (status: InterestStatus): string => {
  const option = INTEREST_STATUS_OPTIONS.find(o => o.value === status);
  return option ? `${option.icon} ${option.label}` : status;
};

export const getInterestLevelLabel = (level: InterestLevel): string => {
  const option = INTEREST_LEVEL_OPTIONS.find(o => o.value === level);
  return option ? `${option.icon} ${option.label}` : level;
};
