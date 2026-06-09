import React from 'react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { Lock, Crown } from 'lucide-react';

export type SubscriptionFeature =
  | 'analytics'
  | 'api_access'
  | 'advanced_analytics'
  | 'custom_development'
  | 'support_24_7';

export type SubscriptionPlan = 'free' | 'starter' | 'professional' | 'enterprise';

// Package configurations with features - should match TenantManagement.tsx
const PACKAGE_CONFIGS = {
  free: {
    name: 'Free',
    features: ['โครงการสูงสุด 5 แห่ง', 'Admin 1 คน + Sales 2 คน', 'ระบบจัดการลูกค้า', 'ระบบ Leads']
  },
  starter: {
    name: 'Starter',
    features: ['โครงการสูงสุด 10 แห่ง', 'Admin 1 คน + Sales 4 คน', 'ระบบจัดการลูกค้า', 'ระบบ Leads']
  },
  professional: {
    name: 'Professional',
    features: ['โครงการสูงสุด 50 แห่ง', 'Admin 2 คน + Sales 8 คน', 'ระบบจัดการลูกค้า', 'ระบบ Leads', 'รายงานวิเคราะห์', 'API Access']
  },
  enterprise: {
    name: 'Enterprise',
    features: ['โครงการไม่จำกัด', 'Admin 4 คน + Sales 16 คน', 'ระบบทั้งหมด', 'รายงานวิเคราะห์ขั้นสูง', 'API Access', 'Support 24/7', 'Custom Development']
  }
};

// Map feature strings to subscription features
const FEATURE_MAPPING: Record<string, SubscriptionFeature> = {
  'รายงานวิเคราะห์': 'analytics',
  'API Access': 'api_access',
  'รายงานวิเคราะห์ขั้นสูง': 'advanced_analytics',
  'Custom Development': 'custom_development',
  'Support 24/7': 'support_24_7'
};

// Dynamic feature matrix based on package configurations
const getPlanFeatures = (plan: SubscriptionPlan): SubscriptionFeature[] => {
  const packageConfig = PACKAGE_CONFIGS[plan];
  if (!packageConfig) return [];

  const features: SubscriptionFeature[] = [];
  packageConfig.features.forEach(featureString => {
    const mappedFeature = FEATURE_MAPPING[featureString];
    if (mappedFeature) {
      features.push(mappedFeature);
    }
  });

  return features;
};

// Plan labels for display
const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise'
};

// Feature labels for display
const FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  analytics: 'รายงานวิเคราะห์',
  api_access: 'API Access',
  advanced_analytics: 'รายงานวิเคราะห์ขั้นสูง',
  custom_development: 'Custom Development',
  support_24_7: 'Support 24/7'
};

export const useSubscriptionFeatures = () => {
  const { currentTenant } = useSimpleAuth();

  const currentPlan = ((currentTenant as any)?.subscription_plan || 'starter') as SubscriptionPlan;

  const hasFeature = (feature: SubscriptionFeature): boolean => {
    const planFeatures = getPlanFeatures(currentPlan);
    return planFeatures.includes(feature);
  };

  const getRequiredPlanForFeature = (feature: SubscriptionFeature): SubscriptionPlan | null => {
    const plans: SubscriptionPlan[] = ['free', 'starter', 'professional', 'enterprise'];

    for (const plan of plans) {
      const features = getPlanFeatures(plan);
      if (features.includes(feature)) {
        return plan;
      }
    }
    return null;
  };

  const getUpgradeMessage = (feature: SubscriptionFeature): string => {
    const requiredPlan = getRequiredPlanForFeature(feature);
    const featureLabel = FEATURE_LABELS[feature];
    const planLabel = requiredPlan ? PLAN_LABELS[requiredPlan] : 'Premium';

    return `${featureLabel} ใช้ได้เฉพาะแพ็กเกจ ${planLabel} ขึ้นไป`;
  };

  return {
    currentPlan,
    hasFeature,
    getRequiredPlanForFeature,
    getUpgradeMessage,

    // Specific feature checks
    hasAnalytics: hasFeature('analytics'),
    hasApiAccess: hasFeature('api_access'),
    hasAdvancedAnalytics: hasFeature('advanced_analytics'),
    hasCustomDevelopment: hasFeature('custom_development'),
    hasSupport24_7: hasFeature('support_24_7'),

    // Plan info
    planLabel: PLAN_LABELS[currentPlan],
    availableFeatures: getPlanFeatures(currentPlan)
  };
};

// React component for protecting features based on subscription
export const SubscriptionGuard: React.FC<{
  feature: SubscriptionFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true
}) => {
  const { hasFeature, getUpgradeMessage, currentPlan, planLabel, getRequiredPlanForFeature } = useSubscriptionFeatures();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const requiredPlan = getRequiredPlanForFeature(feature);
  const isEnterprise = requiredPlan === 'enterprise';

  return (
    <div className="flex items-center gap-3 p-6 bg-gradient-to-br from-chateau-50 to-chateau-50 border-2 border-chateau-100 rounded-xl">
      {isEnterprise ? (
        <Crown className="w-8 h-8 text-chateau flex-shrink-0" />
      ) : (
        <Lock className="w-8 h-8 text-chateau flex-shrink-0" />
      )}
      <div className="flex-1">
        <h3 className="font-semibold text-chateau-800 mb-1">
          ฟีเจอร์พิเศษ {isEnterprise ? '' : ''}
        </h3>
        <p className="text-sm text-chateau-700 mb-3">
          {getUpgradeMessage(feature)}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-chateau-100 text-chateau-700 rounded-full">
            ปัจจุบัน: {planLabel}
          </span>
          <span className="text-chateau">→</span>
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
            ต้องการ: {PLAN_LABELS[requiredPlan || 'professional']}+
          </span>
        </div>
        <button
          className="mt-3 px-4 py-2 bg-chateau hover:bg-chateau-600 text-white text-sm font-medium rounded-lg transition-colors"
          onClick={() => {
            // Navigate to upgrade page or contact sales
            window.open('mailto:mazmakerdevai.1@gmail.com?subject=อัปเกรดแพ็กเกจ', '_blank');
          }}
        >
          {isEnterprise ? ' ติดต่อขาย' : ' อัปเกรด'}
        </button>
      </div>
    </div>
  );
};

export default useSubscriptionFeatures;