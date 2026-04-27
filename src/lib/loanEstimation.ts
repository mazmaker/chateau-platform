/**
 * Loan Estimation Calculator
 *
 * Purpose: Calculate maximum loan amount, monthly payments, and loan eligibility
 * Based on: Thai banking standards and real estate financing practices
 */

import type {
  LoanEstimationInput,
  LoanEstimation,
  AffordabilityMetrics,
  LoanBreakdown,
  KeyFactor,
  AffordabilityStatus,
} from '@/types/leadScoring';

// ========================================
// Thai Banking Standards (2026)
// ========================================

const LOAN_STANDARDS = {
  // Maximum ratios allowed by Thai banks
  MAX_DTI_RATIO: 43, // Maximum Debt-to-Income ratio (%)
  MAX_LTV_RATIO: 90, // Maximum Loan-to-Value ratio (%)

  // Recommended ratios for comfort
  RECOMMENDED_DTI: 36,
  RECOMMENDED_LTV: 80,

  // Housing expense ratio
  MAX_HOUSING_RATIO: 28, // % of income for housing

  // Interest rates by credit score (annual %)
  INTEREST_RATES: {
    excellent: 4.5, // 750+
    good: 5.5, // 700-749
    fair: 6.5, // 650-699
    poor: 7.5, // <650
  },

  // Maximum loan terms by age
  MAX_AGE_AT_MATURITY: 70, // Maximum age when loan matures
  DEFAULT_LOAN_TERM: 30, // Default term in years
};

// ========================================
// Interest Rate Estimation
// ========================================

function estimateInterestRate(creditScore: number, employmentType?: string): number {
  let baseRate: number;

  // Base rate by credit score
  if (creditScore >= 750) {
    baseRate = LOAN_STANDARDS.INTEREST_RATES.excellent;
  } else if (creditScore >= 700) {
    baseRate = LOAN_STANDARDS.INTEREST_RATES.good;
  } else if (creditScore >= 650) {
    baseRate = LOAN_STANDARDS.INTEREST_RATES.fair;
  } else {
    baseRate = LOAN_STANDARDS.INTEREST_RATES.poor;
  }

  // Adjust for employment type
  if (employmentType === 'government') {
    baseRate -= 0.5; // Government employees get better rates
  } else if (employmentType === 'freelance') {
    baseRate += 0.5; // Freelancers pay higher rates
  }

  return Math.max(3.5, Math.min(9.0, baseRate)); // Clamp between 3.5% and 9%
}

// ========================================
// Maximum Loan Term Calculation
// ========================================

function calculateMaxLoanTerm(age?: number, requestedTerm?: number): number {
  const defaultTerm = requestedTerm || LOAN_STANDARDS.DEFAULT_LOAN_TERM;

  if (!age) {
    return defaultTerm;
  }

  const maxTerm = LOAN_STANDARDS.MAX_AGE_AT_MATURITY - age;
  return Math.min(defaultTerm, Math.max(5, maxTerm)); // Minimum 5 years
}

// ========================================
// Monthly Payment Calculation
// ========================================

function calculateMonthlyPayment(
  loanAmount: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;

  if (monthlyRate === 0) {
    return loanAmount / numPayments;
  }

  const monthlyPayment =
    loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  return monthlyPayment;
}

// ========================================
// DTI (Debt-to-Income) Calculation
// ========================================

function calculateDTI(
  monthlyIncome: number,
  monthlyDebt: number,
  proposedPayment: number
): number {
  const totalMonthlyDebt = monthlyDebt + proposedPayment;
  return (totalMonthlyDebt / monthlyIncome) * 100;
}

// ========================================
// Maximum Loan Amount by DTI
// ========================================

function calculateMaxLoanByDTI(
  monthlyIncome: number,
  existingMonthlyDebt: number,
  interestRate: number,
  loanTermYears: number
): number {
  // Calculate maximum affordable monthly payment
  const maxMonthlyDebt = monthlyIncome * (LOAN_STANDARDS.MAX_DTI_RATIO / 100);
  const maxHousingPayment = maxMonthlyDebt - existingMonthlyDebt;

  if (maxHousingPayment <= 0) {
    return 0;
  }

  // Calculate loan amount from monthly payment
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTermYears * 12;

  if (monthlyRate === 0) {
    return maxHousingPayment * numPayments;
  }

  const maxLoan =
    maxHousingPayment *
    ((Math.pow(1 + monthlyRate, numPayments) - 1) /
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)));

  return maxLoan;
}

// ========================================
// Maximum Loan Amount by LTV
// ========================================

function calculateMaxLoanByLTV(propertyValue: number, downPayment: number): number {
  const maxLoanByLTV = propertyValue * (LOAN_STANDARDS.MAX_LTV_RATIO / 100);
  const maxLoanAfterDownPayment = propertyValue - downPayment;

  return Math.min(maxLoanByLTV, maxLoanAfterDownPayment);
}

// ========================================
// Affordability Status
// ========================================

function determineAffordabilityStatus(
  dtiRatio: number,
  ltvRatio: number,
  creditScore: number
): AffordabilityStatus {
  if (
    dtiRatio <= LOAN_STANDARDS.RECOMMENDED_DTI &&
    ltvRatio <= LOAN_STANDARDS.RECOMMENDED_LTV &&
    creditScore >= 750
  ) {
    return 'excellent';
  } else if (
    dtiRatio <= LOAN_STANDARDS.MAX_DTI_RATIO &&
    ltvRatio <= LOAN_STANDARDS.MAX_LTV_RATIO &&
    creditScore >= 650
  ) {
    return 'good';
  } else if (dtiRatio <= LOAN_STANDARDS.MAX_DTI_RATIO + 5 && creditScore >= 600) {
    return 'fair';
  } else {
    return 'poor';
  }
}

// ========================================
// Approval Probability Calculation
// ========================================

function calculateApprovalProbability(
  creditScore: number,
  dtiRatio: number,
  ltvRatio: number,
  yearsEmployed?: number,
  employmentType?: string
): number {
  let probability = 0.5; // Base 50%

  // Credit score impact (40%)
  if (creditScore >= 750) {
    probability += 0.4;
  } else if (creditScore >= 700) {
    probability += 0.3;
  } else if (creditScore >= 650) {
    probability += 0.15;
  } else if (creditScore >= 600) {
    probability += 0.05;
  } else {
    probability -= 0.1;
  }

  // DTI ratio impact (30%)
  if (dtiRatio <= 28) {
    probability += 0.3;
  } else if (dtiRatio <= 36) {
    probability += 0.2;
  } else if (dtiRatio <= 43) {
    probability += 0.05;
  } else {
    probability -= 0.15;
  }

  // LTV ratio impact (20%)
  if (ltvRatio <= 70) {
    probability += 0.2;
  } else if (ltvRatio <= 80) {
    probability += 0.1;
  } else if (ltvRatio <= 90) {
    probability += 0.0;
  } else {
    probability -= 0.1;
  }

  // Employment stability impact (10%)
  if (yearsEmployed && yearsEmployed >= 5) {
    probability += 0.1;
  } else if (yearsEmployed && yearsEmployed >= 2) {
    probability += 0.05;
  }

  if (employmentType === 'government') {
    probability += 0.05;
  } else if (employmentType === 'freelance') {
    probability -= 0.05;
  }

  return Math.max(0, Math.min(1, probability));
}

// ========================================
// Generate Approval Factors
// ========================================

function generateApprovalFactors(
  creditScore: number,
  dtiRatio: number,
  ltvRatio: number,
  yearsEmployed?: number
): KeyFactor[] {
  const factors: KeyFactor[] = [];

  // Credit Score Factor
  let creditImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  let creditScore_display = creditScore;

  if (creditScore >= 750) {
    creditImpact = 'positive';
  } else if (creditScore < 650) {
    creditImpact = 'negative';
  }

  factors.push({
    factor: 'คะแนนเครดิต',
    impact: creditImpact,
    score: Math.min(100, (creditScore / 850) * 100),
    weight: 0.4,
    description: `คะแนนเครดิต ${creditScore_display} ${
      creditImpact === 'positive'
        ? '(ดีเยี่ยม)'
        : creditImpact === 'neutral'
        ? '(ปานกลาง)'
        : '(ต่ำ)'
    }`,
  });

  // DTI Ratio Factor
  let dtiImpact: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (dtiRatio <= 36) {
    dtiImpact = 'positive';
  } else if (dtiRatio > 43) {
    dtiImpact = 'negative';
  }

  factors.push({
    factor: 'อัตราส่วนหนี้ต่อรายได้',
    impact: dtiImpact,
    score: Math.max(0, 100 - dtiRatio * 2),
    weight: 0.3,
    description: `DTI ${dtiRatio.toFixed(1)}% ${
      dtiImpact === 'positive'
        ? '(ต่ำกว่ามาตรฐาน)'
        : dtiImpact === 'neutral'
        ? '(อยู่ในเกณฑ์)'
        : '(สูงเกินไป)'
    }`,
  });

  // LTV Ratio Factor
  let ltvImpact: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (ltvRatio <= 80) {
    ltvImpact = 'positive';
  } else if (ltvRatio > 90) {
    ltvImpact = 'negative';
  }

  factors.push({
    factor: 'อัตราส่วนเงินกู้ต่อมูลค่าทรัพย์',
    impact: ltvImpact,
    score: Math.max(0, 100 - ltvRatio),
    weight: 0.2,
    description: `LTV ${ltvRatio.toFixed(1)}% ${
      ltvImpact === 'positive'
        ? '(ดีมาก)'
        : ltvImpact === 'neutral'
        ? '(ปานกลาง)'
        : '(สูง)'
    }`,
  });

  // Employment Stability Factor
  if (yearsEmployed !== undefined) {
    let empImpact: 'positive' | 'negative' | 'neutral' = 'neutral';

    if (yearsEmployed >= 5) {
      empImpact = 'positive';
    } else if (yearsEmployed < 2) {
      empImpact = 'negative';
    }

    factors.push({
      factor: 'ความมั่นคงในการทำงาน',
      impact: empImpact,
      score: Math.min(100, (yearsEmployed / 10) * 100),
      weight: 0.1,
      description: `อายุงาน ${yearsEmployed.toFixed(1)} ปี`,
    });
  }

  return factors;
}

// ========================================
// Main Loan Estimation Function
// ========================================

export function estimateLoan(input: LoanEstimationInput): LoanEstimation {
  // Determine interest rate
  const interestRate =
    input.interest_rate ||
    estimateInterestRate(input.credit_score, input.employment_type);

  // Determine loan term
  const loanTermYears = calculateMaxLoanTerm(input.age, input.loan_term_years);

  // Calculate maximum loan by DTI
  const maxLoanByDTI = calculateMaxLoanByDTI(
    input.monthly_income,
    input.monthly_debt,
    interestRate,
    loanTermYears
  );

  // Calculate maximum loan by LTV
  const maxLoanByLTV = calculateMaxLoanByLTV(input.property_value, input.down_payment);

  // Maximum loan is the minimum of both constraints
  const maxLoanAmount = Math.min(maxLoanByDTI, maxLoanByLTV);

  // Recommended loan amount (80% of max for safety)
  const recommendedLoanAmount = maxLoanAmount * 0.8;

  // Calculate loan amount (actual loan needed)
  const loanAmount = input.property_value - input.down_payment;

  // Use the smaller of needed vs maximum
  const actualLoanAmount = Math.min(loanAmount, maxLoanAmount);

  // Calculate monthly payment
  const monthlyPayment = calculateMonthlyPayment(
    actualLoanAmount,
    interestRate,
    loanTermYears
  );

  // Calculate DTI ratio
  const dtiRatio = calculateDTI(input.monthly_income, input.monthly_debt, monthlyPayment);

  // Calculate LTV ratio
  const ltvRatio = (actualLoanAmount / input.property_value) * 100;

  // Calculate housing expense ratio
  const housingExpenseRatio = (monthlyPayment / input.monthly_income) * 100;

  // Calculate approval probability
  const approvalProbability = calculateApprovalProbability(
    input.credit_score,
    dtiRatio,
    ltvRatio,
    input.years_employed,
    input.employment_type
  );

  // Determine affordability status
  const affordabilityStatus = determineAffordabilityStatus(
    dtiRatio,
    ltvRatio,
    input.credit_score
  );

  // Calculate total interest and payment
  const totalPayment = monthlyPayment * loanTermYears * 12;
  const totalInterest = totalPayment - actualLoanAmount;

  // Build affordability metrics
  const affordability: AffordabilityMetrics = {
    dti_ratio: Number(dtiRatio.toFixed(2)),
    ltv_ratio: Number(ltvRatio.toFixed(2)),
    approval_probability: Number(approvalProbability.toFixed(4)),
    status: affordabilityStatus,
    housing_expense_ratio: Number(housingExpenseRatio.toFixed(2)),
  };

  // Build loan breakdown
  const breakdown: LoanBreakdown = {
    property_value: input.property_value,
    down_payment: input.down_payment,
    loan_amount: actualLoanAmount,
    monthly_payment: monthlyPayment,
    total_interest: totalInterest,
    total_payment: totalPayment,
  };

  // Generate warnings
  const warnings: string[] = [];

  if (dtiRatio > LOAN_STANDARDS.MAX_DTI_RATIO) {
    warnings.push(
      `อัตราส่วนหนี้ต่อรายได้ ${dtiRatio.toFixed(1)}% สูงเกินมาตรฐาน (ควรไม่เกิน ${
        LOAN_STANDARDS.MAX_DTI_RATIO
      }%)`
    );
  }

  if (ltvRatio > LOAN_STANDARDS.MAX_LTV_RATIO) {
    warnings.push(
      `อัตราส่วนเงินกู้ต่อมูลค่าทรัพย์ ${ltvRatio.toFixed(1)}% สูงเกินกว่าที่ธนาคารจะอนุมัติ`
    );
  }

  if (input.credit_score < 650) {
    warnings.push('คะแนนเครดิตต่ำกว่าเกณฑ์มาตรฐาน อาจได้อัตราดอกเบี้ยสูงหรือถูกปฏิเสธ');
  }

  if (actualLoanAmount < loanAmount) {
    const shortfall = loanAmount - actualLoanAmount;
    warnings.push(
      `เงินกู้ที่สามารถได้รับอนุมัติต่ำกว่าที่ต้องการ ${(shortfall / 1000000).toFixed(
        2
      )} ล้านบาท`
    );
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (dtiRatio > 36) {
    recommendations.push('ควรลดหนี้สินรายเดือนเพื่อเพิ่มโอกาสอนุมัติสินเชื่อ');
  }

  if (ltvRatio > 80) {
    recommendations.push(
      `ควรเพิ่มเงินดาวน์อย่างน้อย ${(
        ((ltvRatio - 80) / 100) *
        input.property_value /
        1000000
      ).toFixed(2)} ล้านบาท`
    );
  }

  if (input.credit_score < 700) {
    recommendations.push('ควรปรับปรุงคะแนนเครดิตเพื่อรับอัตราดอกเบี้ยที่ดีขึ้น');
  }

  if (!input.has_co_borrower && affordabilityStatus !== 'excellent') {
    recommendations.push('พิจารณาใช้ผู้กู้ร่วมเพื่อเพิ่มวงเงินและโอกาสอนุมัติ');
  }

  if (approvalProbability < 0.7) {
    recommendations.push('ควรปรึกษาที่ปรึกษาสินเชื่อเพื่อประเมินตัวเลือกที่เหมาะสม');
  }

  // Generate approval factors
  const approvalFactors = generateApprovalFactors(
    input.credit_score,
    dtiRatio,
    ltvRatio,
    input.years_employed
  );

  // Build assumptions
  const assumptions: string[] = [
    `อัตราดอกเบี้ย ${interestRate.toFixed(2)}% ต่อปี (แบบคงที่)`,
    `ระยะเวลากู้ ${loanTermYears} ปี`,
    `ค่างวดเท่ากันทุกเดือน (Amortization)`,
    'ไม่รวมค่าธรรมเนียมและค่าใช้จ่ายอื่นๆ',
    'ตัวเลขเป็นการประเมินเบื้องต้นเท่านั้น',
  ];

  return {
    max_loan_amount: Math.round(maxLoanAmount),
    recommended_loan_amount: Math.round(recommendedLoanAmount),
    monthly_payment: Math.round(monthlyPayment),
    interest_rate: Number(interestRate.toFixed(2)),
    loan_term_years: loanTermYears,
    affordability,
    breakdown: {
      property_value: breakdown.property_value,
      down_payment: breakdown.down_payment,
      loan_amount: Math.round(breakdown.loan_amount),
      monthly_payment: Math.round(breakdown.monthly_payment),
      total_interest: Math.round(breakdown.total_interest),
      total_payment: Math.round(breakdown.total_payment),
    },
    warnings,
    recommendations,
    approval_factors: approvalFactors,
    calculated_at: new Date(),
    assumptions,
  };
}

// ========================================
// Utility Functions
// ========================================

/**
 * Format currency in Thai Baht
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate affordability score (0-100)
 */
export function calculateAffordabilityScore(estimation: LoanEstimation): number {
  let score = 100;

  // Deduct based on DTI
  if (estimation.affordability.dti_ratio > 43) {
    score -= 30;
  } else if (estimation.affordability.dti_ratio > 36) {
    score -= 15;
  }

  // Deduct based on LTV
  if (estimation.affordability.ltv_ratio > 90) {
    score -= 25;
  } else if (estimation.affordability.ltv_ratio > 80) {
    score -= 10;
  }

  // Deduct based on approval probability
  score -= (1 - estimation.affordability.approval_probability) * 45;

  return Math.max(0, Math.round(score));
}
