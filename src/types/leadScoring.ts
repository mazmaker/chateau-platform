/**
 * Lead Scoring and Loan Estimation Types
 *
 * Purpose: Type definitions for AI-based lead scoring and loan estimation features
 */

// ========================================
// Core Types
// ========================================

export type EmploymentType = 'government' | 'private' | 'business' | 'freelance';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type UrgencyLevel = 'high' | 'medium' | 'low';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ImpactType = 'positive' | 'negative' | 'neutral';
export type AffordabilityStatus = 'excellent' | 'good' | 'fair' | 'poor';

// ========================================
// Lead Scoring Data
// ========================================

export interface LeadScoringData {
  // Financial Information
  credit_score?: number; // 300-850
  monthly_income?: number;
  monthly_debt?: number;
  down_payment_ready?: number;
  savings?: number;

  // Employment Information
  employment_type?: EmploymentType;
  years_employed?: number;
  company_name?: string;

  // Demographics
  age?: number;
  household_size?: number;
  marital_status?: MaritalStatus;
  has_co_borrower?: boolean;
  number_of_dependents?: number;

  // Property History
  is_first_time_buyer?: boolean;
  existing_properties?: number;
  sold_property_recently?: boolean;

  // Behavioral Data
  website_visits?: number;
  pages_viewed?: number;
  time_on_site?: number; // minutes
  brochure_downloads?: number;
  site_visit_attended?: boolean;
  interaction_count?: number;

  // Intent Signals
  urgency_level?: UrgencyLevel;
  decision_maker?: boolean;
  financing_approved?: boolean;
  interest_level?: string;
  interest_status?: string;

  // Budget & Timeline
  budget_min?: number;
  budget_max?: number;
  purchase_timeline?: string;
}

// ========================================
// Scoring Results
// ========================================

export interface ScoreBreakdown {
  financial_score: number; // 0-100
  engagement_score: number; // 0-100
  urgency_score: number; // 0-100
  fit_score: number; // 0-100
}

// Per-category data completeness (0-1) — tells UI when to dim score or show "ข้อมูลไม่พอ"
export interface ScoreCoverage {
  financial: number;
  engagement: number;
  urgency: number;
  fit: number;
}

export type FactorCategory = 'financial' | 'engagement' | 'urgency' | 'fit';

export interface KeyFactor {
  factor: string;
  impact: ImpactType;
  score: number;
  weight: number;
  description: string;
  category?: FactorCategory; // present for new scores; legacy scores omit it
}

export interface PotentialScore {
  // Overall Metrics
  overall_score: number; // 0-100
  conversion_probability: number; // 0-1
  confidence_level: ConfidenceLevel;

  // Detailed Breakdown
  score_breakdown: ScoreBreakdown;
  // Coverage per category (0-1) — share of possible factors that had data
  score_coverage?: ScoreCoverage;

  // Analysis
  key_factors: KeyFactor[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  next_best_actions: string[];

  // Metadata
  calculated_at: Date;
  model_version: string;
}

// ========================================
// Loan Estimation
// ========================================

export interface LoanEstimationInput {
  // Required Fields
  monthly_income: number;
  monthly_debt: number;
  property_value: number;
  down_payment: number;
  credit_score: number;

  // Optional Fields
  age?: number;
  employment_type?: EmploymentType;
  years_employed?: number;
  loan_term_years?: number; // default: 30
  interest_rate?: number; // if not provided, will be estimated
  has_co_borrower?: boolean;
}

export interface AffordabilityMetrics {
  dti_ratio: number; // Debt-to-Income Ratio (%)
  ltv_ratio: number; // Loan-to-Value Ratio (%)
  approval_probability: number; // 0-1
  status: AffordabilityStatus;
  housing_expense_ratio: number; // % of income for housing
}

export interface LoanBreakdown {
  property_value: number;
  down_payment: number;
  loan_amount: number;
  monthly_payment: number;
  total_interest: number;
  total_payment: number;
}

export interface LoanEstimation {
  // Loan Details
  max_loan_amount: number;
  recommended_loan_amount: number;
  monthly_payment: number;
  interest_rate: number;
  loan_term_years: number;

  // Affordability Analysis
  affordability: AffordabilityMetrics;

  // Financial Breakdown
  breakdown: LoanBreakdown;

  // Warnings & Recommendations
  warnings: string[];
  recommendations: string[];

  // Source of the max_loan_amount — 'estimate' = system formula, 'manual' = bank
  // Pre-approval entered by Sales. Drives the "ธนาคารอนุมัติแล้ว" badge in the UI.
  source?: 'estimate' | 'manual';

  // Metadata
  calculated_at: Date;
  assumptions: string[];
}

// ========================================
// Combined CDP Data
// ========================================

export interface LeadCDPData {
  lead_id: string;
  lead_name: string;
  potential_score?: PotentialScore;
  loan_estimation?: LoanEstimation;
  last_updated?: Date;
}

// ========================================
// API Request/Response Types
// ========================================

export interface CalculateScoreRequest {
  lead_id: string;
  lead_data: LeadScoringData;
  property_id?: string;
  unit_id?: string;
}

export interface CalculateScoreResponse {
  success: boolean;
  data?: PotentialScore;
  error?: string;
}

export interface EstimateLoanRequest {
  lead_id: string;
  loan_data: LoanEstimationInput;
}

export interface EstimateLoanResponse {
  success: boolean;
  data?: LoanEstimation;
  error?: string;
}

// ========================================
// Scoring Configuration
// ========================================

export interface ScoringWeights {
  financial: number;
  engagement: number;
  urgency: number;
  fit: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  thresholds: {
    high_score: number; // e.g., 80
    medium_score: number; // e.g., 50
    low_score: number; // e.g., 30
  };
  credit_score_ranges: {
    excellent: [number, number]; // [750, 850]
    good: [number, number]; // [700, 749]
    fair: [number, number]; // [650, 699]
    poor: [number, number]; // [300, 649]
  };
  dti_thresholds: {
    excellent: number; // < 28%
    good: number; // < 36%
    fair: number; // < 43%
    poor: number; // >= 43%
  };
}
