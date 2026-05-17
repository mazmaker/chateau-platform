// Shared helper: recompute potential_score + max_loan_amount for a lead, and persist to DB.
// Called by AddLeadModal/EditLeadModal after successful save so the Lead Management table
// shows real numbers immediately — no separate "calculate" step for Sales/Admin.
import { supabase } from './supabase';
import { calculateLeadScore } from './leadScoring';
import { estimateLoan } from './loanEstimation';
import type { LeadScoringData, LoanEstimationInput } from '@/types/leadScoring';

/**
 * Re-pull the lead's data from DB and compute scores + loan figures, then write them back.
 * Best-effort: errors are logged but don't throw — score recompute should never block a save.
 */
export async function recomputeLeadScore(leadId: string): Promise<void> {
  if (!leadId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error } = await (supabase.from('leads') as any)
      .select('credit_score, monthly_income, monthly_debt, employment_type, years_employed, age, gender, marital_status, education, household_size, down_payment_ready, savings, has_co_borrower, number_of_dependents, is_first_time_buyer, website_visits, pages_viewed, time_on_site, brochure_downloads, site_visit_attended, urgency_level, decision_maker, financing_approved, estimated_value, priority, max_loan_amount, loan_last_updated, score_last_updated')
      .eq('id', leadId)
      .maybeSingle();
    if (error || !lead) return;

    // Detect manual override: Sales set loan_last_updated AFTER score_last_updated
    // (or score_last_updated is null) — recompute should leave max_loan_amount alone.
    const loanWasManuallySet = lead.max_loan_amount != null && lead.loan_last_updated &&
      (!lead.score_last_updated || new Date(lead.loan_last_updated) > new Date(lead.score_last_updated));

    // Map DB nulls → undefined for the scoring library
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoringInput: LeadScoringData = {
      credit_score: lead.credit_score ?? undefined,
      monthly_income: lead.monthly_income ?? undefined,
      monthly_debt: lead.monthly_debt ?? 0,
      employment_type: (lead.employment_type ?? undefined) as any,
      years_employed: lead.years_employed ?? undefined,
      age: lead.age ?? undefined,
      gender: (lead.gender ?? undefined) as any,
      marital_status: (lead.marital_status ?? undefined) as any,
      education: (lead.education ?? undefined) as any,
      household_size: lead.household_size ?? undefined,
      down_payment_ready: lead.down_payment_ready ?? 0,
      savings: lead.savings ?? 0,
      website_visits: lead.website_visits ?? 0,
      pages_viewed: lead.pages_viewed ?? 0,
      time_on_site: lead.time_on_site ?? 0,
      brochure_downloads: lead.brochure_downloads ?? 0,
      site_visit_attended: lead.site_visit_attended ?? false,
      urgency_level: (lead.urgency_level ?? 'medium') as any,
      interest_level: (lead.priority ?? 'medium') as any,  // priority on lead = interest_level proxy
      decision_maker: lead.decision_maker ?? undefined,
      financing_approved: lead.financing_approved ?? undefined,
      budget_max: lead.estimated_value ?? undefined,
      purchase_timeline: '3_months',
    } as any;

    const score = calculateLeadScore(scoringInput);

    // Loan estimation (only if we have enough financial data)
    let loanResult: any = null;
    if (lead.monthly_income && lead.estimated_value) {
      const loanInput: LoanEstimationInput = {
        monthly_income: Number(lead.monthly_income),
        monthly_debt: Number(lead.monthly_debt || 0),
        credit_score: lead.credit_score ?? 700,
        property_value: Number(lead.estimated_value),
        down_payment: Number(lead.down_payment_ready || 0),
        age: lead.age ?? undefined,
        employment_type: lead.employment_type ?? undefined,
        savings: lead.savings ?? undefined,
        has_co_borrower: lead.has_co_borrower ?? false,
      } as any;
      try {
        loanResult = estimateLoan(loanInput);
      } catch { /* ignore — loan estimation may fail on edge cases */ }
    }

    // Write everything back in one update
    const updates: Record<string, any> = {
      potential_score: score.overall_score,
      financial_score: score.score_breakdown.financial_score,
      engagement_score: score.score_breakdown.engagement_score,
      urgency_score: score.score_breakdown.urgency_score,
      fit_score: score.score_breakdown.fit_score,
      conversion_probability: score.conversion_probability,
      score_last_updated: new Date().toISOString(),
    };
    if (loanResult && !loanWasManuallySet) {
      // Only overwrite max_loan_amount if Sales hasn't manually set it (via bank Pre-approval)
      updates.max_loan_amount = loanResult.max_loan_amount;
      updates.estimated_monthly_payment = loanResult.estimated_monthly_payment;
      updates.estimated_interest_rate = loanResult.interest_rate;
      updates.loan_term_years = loanResult.loan_term_years;
      updates.dti_ratio = loanResult.dti_ratio;
      updates.ltv_ratio = loanResult.ltv_ratio;
      updates.loan_approval_probability = loanResult.approval_probability;
      updates.loan_last_updated = new Date().toISOString();
    } else if (loanResult && loanWasManuallySet) {
      // Manual override active — keep max_loan_amount but still update derived metrics for reference
      updates.estimated_monthly_payment = loanResult.estimated_monthly_payment;
      updates.estimated_interest_rate = loanResult.interest_rate;
      updates.dti_ratio = loanResult.dti_ratio;
      updates.ltv_ratio = loanResult.ltv_ratio;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('leads') as any).update(updates).eq('id', leadId);
  } catch (err) {
    console.warn('[recomputeLeadScore] non-fatal error:', err);
  }
}
