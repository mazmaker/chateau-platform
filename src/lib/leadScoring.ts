/**
 * Lead Scoring Engine
 *
 * Purpose: Rule-based algorithm for calculating lead potential scores
 * Approach: Weighted scoring across multiple factors
 */

import type {
  LeadScoringData,
  PotentialScore,
  ScoreBreakdown,
  KeyFactor,
  ConfidenceLevel,
  ScoringConfig,
} from '@/types/leadScoring';

// ========================================
// Configuration
// ========================================

const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    financial: 0.35, // 35% - Most important for real estate
    engagement: 0.25, // 25% - Shows interest level
    urgency: 0.20, // 20% - Timeline matters
    fit: 0.20, // 20% - Property/budget fit
  },
  thresholds: {
    high_score: 75,
    medium_score: 50,
    low_score: 30,
  },
  credit_score_ranges: {
    excellent: [750, 850],
    good: [700, 749],
    fair: [650, 699],
    poor: [300, 649],
  },
  dti_thresholds: {
    excellent: 28,
    good: 36,
    fair: 43,
    poor: 100,
  },
};

// ========================================
// Financial Score Calculation
// ========================================

function calculateFinancialScore(data: LeadScoringData): {
  score: number;
  factors: KeyFactor[];
  coverage: number;
} {
  const factors: KeyFactor[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  // Credit score factor removed — Thai real estate sales don't have access to NCB
  // reports at the lead stage. The financial category now scores from income/down/
  // employment only. totalWeight normalizes the result over present factors.

  // 1. Income to Price Ratio (30% of financial score)
  if (data.monthly_income && data.budget_max) {
    const incomeWeight = 0.3;
    const annualIncome = data.monthly_income * 12;
    const priceToIncomeRatio = data.budget_max / annualIncome;
    let incomeScore = 0;
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';

    let description: string;
    if (priceToIncomeRatio <= 3) {
      incomeScore = 100;
      impact = 'positive';
      description = `กำลังซื้อดีเยี่ยม ราคายูนิต ${priceToIncomeRatio.toFixed(1)} เท่าของรายได้ต่อปี`;
    } else if (priceToIncomeRatio <= 5) {
      incomeScore = 70;
      impact = 'neutral';
      description = `กำลังซื้อเข้าเกณฑ์ ราคายูนิต ${priceToIncomeRatio.toFixed(1)} เท่าของรายได้ต่อปี`;
    } else if (priceToIncomeRatio <= 7) {
      incomeScore = 40;
      impact = 'neutral';
      description = `กำลังซื้อใกล้เพดาน ราคายูนิต ${priceToIncomeRatio.toFixed(1)} เท่าของรายได้ต่อปี`;
    } else {
      incomeScore = 20;
      impact = 'negative';
      description = `โอกาสอนุมัติต่ำ ราคายูนิตมากกว่ารายได้ ${priceToIncomeRatio.toFixed(1)} เท่าต่อปี`;
    }

    totalScore += incomeScore * incomeWeight;
    totalWeight += incomeWeight;

    factors.push({
      factor: 'รายได้เทียบกับราคายูนิต',
      impact,
      score: incomeScore,
      weight: incomeWeight,
      description,
    });
  }

  // 3. Down Payment Readiness (20% of financial score)
  if (data.down_payment_ready && data.budget_max) {
    const downPaymentWeight = 0.2;
    const downPaymentPercent = (data.down_payment_ready / data.budget_max) * 100;
    let downPaymentScore = 0;
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';

    let dpDescription: string;
    if (downPaymentPercent >= 30) {
      downPaymentScore = 100;
      impact = 'positive';
      dpDescription = `เงินดาวน์ดีเยี่ยม ${downPaymentPercent.toFixed(0)}% ของราคายูนิต`;
    } else if (downPaymentPercent >= 20) {
      downPaymentScore = 80;
      impact = 'positive';
      dpDescription = `เงินดาวน์เข้าเกณฑ์ ${downPaymentPercent.toFixed(0)}% ของราคายูนิต`;
    } else if (downPaymentPercent >= 10) {
      downPaymentScore = 50;
      impact = 'neutral';
      dpDescription = `เงินดาวน์ต่ำกว่าเกณฑ์ ${downPaymentPercent.toFixed(0)}% ของราคายูนิต (ขั้นต่ำ 20%)`;
    } else {
      downPaymentScore = 20;
      impact = 'negative';
      dpDescription = `โอกาสอนุมัติต่ำ เงินดาวน์น้อยกว่า 10% ของราคายูนิต`;
    }

    totalScore += downPaymentScore * downPaymentWeight;
    totalWeight += downPaymentWeight;

    factors.push({
      factor: 'เงินดาวน์พร้อม',
      impact,
      score: downPaymentScore,
      weight: downPaymentWeight,
      description: dpDescription,
    });
  }

  // 4. Employment Stability (10% of financial score)
  if (data.employment_type && data.years_employed) {
    const employmentWeight = 0.1;
    let employmentScore = 0;
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';

    // Base score from employment type
    const typeScore = {
      government: 100,
      private: 70,
      business: 60,
      freelance: 40,
    }[data.employment_type];

    // Adjust by years employed
    let stabilityLabel: string;
    if (data.years_employed >= 5) {
      employmentScore = typeScore;
      impact = 'positive';
      stabilityLabel = 'อายุงานมั่นคง';
    } else if (data.years_employed >= 2) {
      employmentScore = typeScore * 0.8;
      impact = 'neutral';
      stabilityLabel = 'อายุงานปานกลาง';
    } else {
      employmentScore = typeScore * 0.5;
      impact = 'negative';
      stabilityLabel = 'อายุงานน้อย';
    }

    totalScore += employmentScore * employmentWeight;
    totalWeight += employmentWeight;

    const occupationLabel =
      data.employment_type === 'government' ? 'ข้าราชการ'
      : data.employment_type === 'private' ? 'พนักงานเอกชน'
      : data.employment_type === 'business' ? 'ธุรกิจส่วนตัว'
      : 'Freelance';

    factors.push({
      factor: 'ความมั่นคงในการทำงาน',
      impact,
      score: employmentScore,
      weight: employmentWeight,
      description: `${stabilityLabel} ${occupationLabel} ${data.years_employed} ปี`,
    });
  }

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  return {
    score: Math.round(finalScore),
    factors: factors.map((f) => ({ ...f, category: 'financial' as const })),
    coverage: totalWeight, // weights sum to 1.0 when complete
  };
}

// ========================================
// Engagement Score Calculation
// ========================================

function calculateEngagementScore(data: LeadScoringData): {
  score: number;
  factors: KeyFactor[];
  coverage: number;
} {
  const factors: KeyFactor[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  // 1. Website Activity (30%)
  if (data.website_visits !== undefined && data.pages_viewed !== undefined) {
    const activityWeight = 0.3;
    const visitScore = Math.min(100, (data.website_visits / 10) * 100);
    const pageScore = Math.min(100, (data.pages_viewed / 20) * 100);
    const avgScore = (visitScore + pageScore) / 2;

    const impact: 'positive' | 'negative' | 'neutral' =
      avgScore >= 70 ? 'positive' : avgScore >= 40 ? 'neutral' : 'negative';

    totalScore += avgScore * activityWeight;
    totalWeight += activityWeight;

    factors.push({
      factor: 'กิจกรรมบนเว็บไซต์',
      impact,
      score: avgScore,
      weight: activityWeight,
      description: `เข้าชม ${data.website_visits} ครั้ง ดูหน้า ${data.pages_viewed} หน้า`,
    });
  }

  // 2. Content Engagement (25%)
  if (data.brochure_downloads !== undefined) {
    const contentWeight = 0.25;
    const contentScore = Math.min(100, (data.brochure_downloads / 5) * 100);
    const impact: 'positive' | 'negative' | 'neutral' =
      contentScore >= 60 ? 'positive' : contentScore >= 20 ? 'neutral' : 'negative';

    totalScore += contentScore * contentWeight;
    totalWeight += contentWeight;

    factors.push({
      factor: 'การดาวน์โหลดเอกสาร',
      impact,
      score: contentScore,
      weight: contentWeight,
      description: `ดาวน์โหลดโบรชัวร์ ${data.brochure_downloads} ครั้ง`,
    });
  }

  // 3. Site Visit (25%)
  if (data.site_visit_attended !== undefined) {
    const siteVisitWeight = 0.25;
    const siteVisitScore = data.site_visit_attended ? 100 : 0;
    const impact = data.site_visit_attended ? 'positive' : 'negative';

    totalScore += siteVisitScore * siteVisitWeight;
    totalWeight += siteVisitWeight;

    factors.push({
      factor: 'การเยี่ยมชมโครงการ',
      impact,
      score: siteVisitScore,
      weight: siteVisitWeight,
      description: data.site_visit_attended
        ? 'เคยเยี่ยมชมโครงการแล้ว'
        : 'ยังไม่เคยเยี่ยมชมโครงการ',
    });
  }

  // 4. Interaction Count (20%)
  if (data.interaction_count !== undefined) {
    const interactionWeight = 0.2;
    const interactionScore = Math.min(100, (data.interaction_count / 10) * 100);
    const impact: 'positive' | 'negative' | 'neutral' =
      interactionScore >= 70 ? 'positive' : interactionScore >= 30 ? 'neutral' : 'negative';

    totalScore += interactionScore * interactionWeight;
    totalWeight += interactionWeight;

    factors.push({
      factor: 'จำนวนการติดต่อ',
      impact,
      score: interactionScore,
      weight: interactionWeight,
      description: `มีการติดต่อสื่อสาร ${data.interaction_count} ครั้ง`,
    });
  }

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  return {
    score: Math.round(finalScore),
    factors: factors.map((f) => ({ ...f, category: 'engagement' as const })),
    coverage: totalWeight,
  };
}

// ========================================
// Urgency Score Calculation
// ========================================

function calculateUrgencyScore(data: LeadScoringData): {
  score: number;
  factors: KeyFactor[];
  coverage: number;
} {
  const factors: KeyFactor[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  // 1. Urgency Level (60%)
  if (data.urgency_level) {
    const urgencyWeight = 0.6;
    const urgencyScores = {
      high: 100,
      medium: 60,
      low: 30,
    };
    const urgencyScore = urgencyScores[data.urgency_level];
    const impact: 'positive' | 'negative' | 'neutral' =
      urgencyScore >= 80 ? 'positive' : urgencyScore >= 50 ? 'neutral' : 'negative';

    totalScore += urgencyScore * urgencyWeight;
    totalWeight += urgencyWeight;

    factors.push({
      factor: 'ระดับความเร่งด่วน',
      impact,
      score: urgencyScore,
      weight: urgencyWeight,
      description: `ความเร่งด่วน${
        data.urgency_level === 'high'
          ? 'สูง - ต้องการซื้อโดยเร็ว'
          : data.urgency_level === 'medium'
          ? 'ปานกลาง'
          : 'ต่ำ - ยังพิจารณาอยู่'
      }`,
    });
  }

  // 2. Purchase Timeline (40%)
  if (data.purchase_timeline) {
    const timelineWeight = 0.4;
    let timelineScore = 50;
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';

    if (data.purchase_timeline.includes('1_month') || data.purchase_timeline.includes('immediate')) {
      timelineScore = 100;
      impact = 'positive';
    } else if (
      data.purchase_timeline.includes('3_months') ||
      data.purchase_timeline.includes('2_months')
    ) {
      timelineScore = 80;
      impact = 'positive';
    } else if (data.purchase_timeline.includes('6_months')) {
      timelineScore = 60;
      impact = 'neutral';
    } else {
      timelineScore = 30;
      impact = 'negative';
    }

    totalScore += timelineScore * timelineWeight;
    totalWeight += timelineWeight;

    factors.push({
      factor: 'กรอบเวลาการซื้อ',
      impact,
      score: timelineScore,
      weight: timelineWeight,
      description: `วางแผนซื้อภายใน${data.purchase_timeline}`,
    });
  }

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 50; // Default to 50 if no data

  return {
    score: Math.round(finalScore),
    factors: factors.map((f) => ({ ...f, category: 'urgency' as const })),
    coverage: totalWeight,
  };
}

// ========================================
// Fit Score Calculation
// ========================================

function calculateFitScore(data: LeadScoringData): {
  score: number;
  factors: KeyFactor[];
  coverage: number;
} {
  const factors: KeyFactor[] = [];
  let totalScore = 0;
  let totalWeight = 0;

  // 1. Interest Level (40%)
  if (data.interest_level) {
    const interestWeight = 0.4;
    const interestScores: Record<string, number> = {
      high: 100,
      medium: 60,
      low: 30,
    };
    const interestScore = interestScores[data.interest_level] || 50;
    const impact: 'positive' | 'negative' | 'neutral' =
      interestScore >= 80 ? 'positive' : interestScore >= 50 ? 'neutral' : 'negative';

    totalScore += interestScore * interestWeight;
    totalWeight += interestWeight;

    factors.push({
      factor: 'ระดับความสนใจ',
      impact,
      score: interestScore,
      weight: interestWeight,
      description: `ความสนใจ${
        data.interest_level === 'high'
          ? 'สูงมาก'
          : data.interest_level === 'medium'
          ? 'ปานกลาง'
          : 'ต่ำ'
      }`,
    });
  }

  // 2. Budget Alignment (30%)
  if (data.budget_min && data.budget_max) {
    const budgetWeight = 0.3;
    const budgetRange = data.budget_max - data.budget_min;
    const avgBudget = (data.budget_min + data.budget_max) / 2;

    // Check if budget is realistic (not too wide range)
    const rangePercent = (budgetRange / avgBudget) * 100;
    let budgetScore = 70; // default
    let impact: 'positive' | 'negative' | 'neutral' = 'neutral';

    if (rangePercent <= 20) {
      budgetScore = 100;
      impact = 'positive';
    } else if (rangePercent <= 40) {
      budgetScore = 80;
      impact = 'positive';
    } else if (rangePercent <= 60) {
      budgetScore = 60;
      impact = 'neutral';
    } else {
      budgetScore = 40;
      impact = 'negative';
    }

    totalScore += budgetScore * budgetWeight;
    totalWeight += budgetWeight;

    factors.push({
      factor: 'ความชัดเจนของงบประมาณ',
      impact,
      score: budgetScore,
      weight: budgetWeight,
      description: `งบประมาณ ${(data.budget_min / 1000000).toFixed(1)}-${(
        data.budget_max / 1000000
      ).toFixed(1)} ล้านบาท`,
    });
  }

  // 3. Decision Maker (20%)
  if (data.decision_maker !== undefined) {
    const decisionWeight = 0.2;
    const decisionScore = data.decision_maker ? 100 : 50;
    const impact = data.decision_maker ? 'positive' : 'neutral';

    totalScore += decisionScore * decisionWeight;
    totalWeight += decisionWeight;

    factors.push({
      factor: 'ผู้มีอำนาจตัดสินใจ',
      impact,
      score: decisionScore,
      weight: decisionWeight,
      description: data.decision_maker
        ? 'เป็นผู้ตัดสินใจหลัก'
        : 'ไม่ใช่ผู้ตัดสินใจหลัก',
    });
  }

  // 4. Financing Approved (10%)
  if (data.financing_approved !== undefined) {
    const financingWeight = 0.1;
    const financingScore = data.financing_approved ? 100 : 40;
    const impact = data.financing_approved ? 'positive' : 'neutral';

    totalScore += financingScore * financingWeight;
    totalWeight += financingWeight;

    factors.push({
      factor: 'สถานะการอนุมัติสินเชื่อ',
      impact,
      score: financingScore,
      weight: financingWeight,
      description: data.financing_approved
        ? 'ได้รับอนุมัติสินเชื่อแล้ว'
        : 'ยังไม่ได้ขออนุมัติสินเชื่อ',
    });
  }

  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 50;

  return {
    score: Math.round(finalScore),
    factors: factors.map((f) => ({ ...f, category: 'fit' as const })),
    coverage: totalWeight,
  };
}

// ========================================
// Main Scoring Function
// ========================================

export function calculateLeadScore(
  data: LeadScoringData,
  config: ScoringConfig = DEFAULT_CONFIG
): PotentialScore {
  // Calculate component scores
  const financial = calculateFinancialScore(data);
  const engagement = calculateEngagementScore(data);
  const urgency = calculateUrgencyScore(data);
  const fit = calculateFitScore(data);

  // Calculate weighted overall score
  const overallScore = Math.round(
    financial.score * config.weights.financial +
      engagement.score * config.weights.engagement +
      urgency.score * config.weights.urgency +
      fit.score * config.weights.fit
  );

  // Calculate conversion probability (sigmoid function)
  const conversionProbability = Number(
    (1 / (1 + Math.exp(-((overallScore - 50) / 15)))).toFixed(4)
  );

  // Determine confidence level based on data completeness
  const allFactors = [
    ...financial.factors,
    ...engagement.factors,
    ...urgency.factors,
    ...fit.factors,
  ];
  const dataCompleteness = allFactors.length / 12; // Assume 12 total possible factors
  let confidenceLevel: ConfidenceLevel = 'low';
  if (dataCompleteness >= 0.7) {
    confidenceLevel = 'high';
  } else if (dataCompleteness >= 0.4) {
    confidenceLevel = 'medium';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Analyze factors
  allFactors.forEach((factor) => {
    if (factor.score >= 80 && factor.impact === 'positive') {
      strengths.push(`${factor.factor}: ${factor.description}`);
    } else if (factor.score <= 40 && factor.impact === 'negative') {
      weaknesses.push(`${factor.factor}: ${factor.description}`);
    }
  });

  // Generate actionable recommendations
  if (financial.score < 60) {
    recommendations.push('ควรช่วยประเมินสินเชื่อและเงินดาวน์');
  }
  if (engagement.score < 50) {
    recommendations.push('ควรเพิ่มการติดต่อสื่อสารและส่งข้อมูลเพิ่มเติม');
  }
  if (urgency.score < 50) {
    recommendations.push('ควรสอบถามเหตุผลและกรอบเวลาการตัดสินใจ');
  }
  if (!data.site_visit_attended) {
    recommendations.push('ควรนัดหมายเพื่อเยี่ยมชมโครงการ');
  }

  // Next best actions
  const nextBestActions: string[] = [];
  if (overallScore >= 75) {
    nextBestActions.push('ติดตามเพื่อปิดการขายโดยเร็ว');
    nextBestActions.push('เสนอโปรโมชันพิเศษ');
  } else if (overallScore >= 50) {
    nextBestActions.push('นัดหมายนำชมโครงการ');
    nextBestActions.push('ส่งข้อมูลรายละเอียดเพิ่มเติม');
  } else {
    nextBestActions.push('สร้างความสัมพันธ์และเก็บข้อมูลเพิ่มเติม');
    nextBestActions.push('ติดตามสถานะเป็นระยะ');
  }

  return {
    overall_score: overallScore,
    conversion_probability: conversionProbability,
    confidence_level: confidenceLevel,
    score_breakdown: {
      financial_score: financial.score,
      engagement_score: engagement.score,
      urgency_score: urgency.score,
      fit_score: fit.score,
    },
    score_coverage: {
      financial: financial.coverage,
      engagement: engagement.coverage,
      urgency: urgency.coverage,
      fit: fit.coverage,
    },
    key_factors: allFactors.sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 10),
    strengths,
    weaknesses,
    recommendations,
    next_best_actions: nextBestActions,
    calculated_at: new Date(),
    model_version: '1.0.0-rule-based',
  };
}
