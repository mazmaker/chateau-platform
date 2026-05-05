import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Key,
  TrendingUp,
  Settings,
  Headphones,
  Building2,
  Users,
  Briefcase
} from 'lucide-react';

export interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  category: 'basic' | 'analytics' | 'advanced' | 'support';
  icon: React.ComponentType<any>;
  requiredPlan?: string;
}

// ฟีเจอร์ทั้งหมดที่ระบบรองรับ
export const AVAILABLE_FEATURES: FeatureDefinition[] = [
  // Basic Features
  {
    id: 'ระบบจัดการลูกค้า',
    label: 'ระบบจัดการลูกค้า',
    description: 'จัดการข้อมูลลูกค้าและ CRM พื้นฐาน',
    category: 'basic',
    icon: Users
  },
  {
    id: 'ระบบ Leads',
    label: 'ระบบ Leads',
    description: 'จัดการลูกค้าเป้าหมายและการติดตาม',
    category: 'basic',
    icon: Briefcase
  },
  {
    id: 'ระบบแคมเปญ',
    label: 'ระบบแคมเปญ',
    description: 'สร้างและจัดการแคมเปญการตลาด',
    category: 'basic',
    icon: Building2
  },

  // Analytics Features
  {
    id: 'รายงานวิเคราะห์',
    label: 'รายงานวิเคราะห์',
    description: 'รายงานสถิติและข้อมูลเชิงลึกพื้นฐาน',
    category: 'analytics',
    icon: BarChart3,
    requiredPlan: 'Professional+'
  },
  {
    id: 'API Access',
    label: 'API Access',
    description: 'เชื่อมต่อกับระบบภายนอกผ่าน API',
    category: 'analytics',
    icon: Key,
    requiredPlan: 'Professional+'
  },

  // Advanced Features
  {
    id: 'รายงานวิเคราะห์ขั้นสูง',
    label: 'รายงานวิเคราะห์ขั้นสูง',
    description: 'AI Analytics, Forecasting, Cohort Analysis',
    category: 'advanced',
    icon: TrendingUp,
    requiredPlan: 'Enterprise'
  },
  {
    id: 'Custom Development',
    label: 'Custom Development',
    description: 'พัฒนาฟีเจอร์เฉพาะธุรกิจ',
    category: 'advanced',
    icon: Settings,
    requiredPlan: 'Enterprise'
  },

  // Support Features
  {
    id: 'Support 24/7',
    label: 'Support 24/7',
    description: 'บริการสนับสนุน 24 ชั่วโมง 7 วัน',
    category: 'support',
    icon: Headphones,
    requiredPlan: 'Enterprise'
  }
];

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    basic: 'ฟีเจอร์พื้นฐาน',
    analytics: 'การวิเคราะห์',
    advanced: 'ฟีเจอร์ขั้นสูง',
    support: 'การสนับสนุน'
  };
  return labels[category] || category;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    basic: 'bg-blue-100 text-blue-800',
    analytics: 'bg-chateau-100 text-chateau-700',
    advanced: 'bg-purple-100 text-purple-800',
    support: 'bg-green-100 text-green-800'
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
};

interface FeatureSelectorProps {
  selectedFeatures: string[];
  onFeatureChange: (features: string[]) => void;
  disabled?: boolean;
}

export const FeatureSelector: React.FC<FeatureSelectorProps> = ({
  selectedFeatures,
  onFeatureChange,
  disabled = false
}) => {
  const handleFeatureToggle = (featureId: string) => {
    if (disabled) return;

    if (selectedFeatures.includes(featureId)) {
      onFeatureChange(selectedFeatures.filter(id => id !== featureId));
    } else {
      onFeatureChange([...selectedFeatures, featureId]);
    }
  };

  // Group features by category
  const featuresByCategory = AVAILABLE_FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureDefinition[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">คุณสมบัติระบบ (Features)</Label>
        <Badge variant="outline">{selectedFeatures.length} ฟีเจอร์</Badge>
      </div>

      {Object.entries(featuresByCategory).map(([category, features]) => (
        <Card key={category} className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className={getCategoryColor(category)}>
                {getCategoryLabel(category)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {features.map((feature) => {
                const isSelected = selectedFeatures.includes(feature.id);
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-chateau-200 bg-chateau-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => handleFeatureToggle(feature.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleFeatureToggle(feature.id)}
                      disabled={disabled}
                      className="mt-1"
                    />
                    <Icon className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium cursor-pointer">
                          {feature.label}
                        </Label>
                        {feature.requiredPlan && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-chateau-100 text-chateau-600"
                          >
                            {feature.requiredPlan}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ))}

      {/* Summary */}
      {selectedFeatures.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-chateau-50 to-chateau-50 border-chateau-100">
          <div className="space-y-2">
            <h4 className="font-semibold text-chateau-800">ฟีเจอร์ที่เลือก:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedFeatures.map((featureId) => {
                const feature = AVAILABLE_FEATURES.find(f => f.id === featureId);
                return (
                  <Badge
                    key={featureId}
                    variant="secondary"
                    className="bg-chateau-100 text-chateau-700"
                  >
                    {feature?.label || featureId}
                  </Badge>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default FeatureSelector;