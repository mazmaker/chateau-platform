/**
 * Loan Estimation Card Component
 *
 * Purpose: Display loan estimation with affordability analysis
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LoanEstimation } from '@/types/leadScoring';
import {
  Calendar,
  Percent,
  AlertTriangle,
  CheckCircle2,
  Info,
  Home,
  CreditCard,
  PiggyBank,
} from 'lucide-react';

interface LoanEstimationCardProps {
  estimation: LoanEstimation;
  loading?: boolean;
}

export function LoanEstimationCard({ estimation, loading }: LoanEstimationCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // 3-tier risk classification — Sales-facing label that combines DTI / LTV / Housing.
  // Replaces "Approval probability %" which over-promises (banks check NCB which we don't).
  const dti = estimation.affordability.dti_ratio;
  const ltv = estimation.affordability.ltv_ratio;
  const housing = estimation.affordability.housing_expense_ratio;
  type RiskTier = 'low' | 'medium' | 'high';
  const riskTier: RiskTier =
    dti > 43 || housing > 35 || ltv > 90 ? 'high'
    : dti > 36 || housing > 28 || ltv > 80 ? 'medium'
    : 'low';

  const RISK_META: Record<RiskTier, { label: string; tone: string; bg: string; border: string; reason: string; actions: string[] }> = {
    low: {
      label: 'อยู่ในเกณฑ์ดี',
      tone: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-200',
      reason: 'DTI / LTV / สัดส่วนค่าที่อยู่อาศัย อยู่ในเกณฑ์ที่ธนาคารแนะนำ',
      actions: [
        'แนะนำให้ลูกค้าขอ Pre-approval Letter เพื่อใช้จองทันที',
        'พิจารณานำเสนอ Unit ระดับเดียวกันหรือสูงกว่าได้',
      ],
    },
    medium: {
      label: 'ความเสี่ยงปานกลาง',
      tone: 'text-orange-700',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      reason: 'มี Ratio อย่างน้อย 1 ตัวที่เกินเกณฑ์แนะนำ แต่ยังไม่เกินเพดานสูงสุด',
      actions: [
        'พิจารณาเสนอ Unit ราคาต่ำลง 10-20% เพื่อลดภาระ',
        'แนะนำลูกค้าขอ Pre-approval ก่อนตัดสินใจจอง',
        'หากต้องการ Unit นี้ ควรเพิ่มเงินดาวน์เพื่อลด LTV',
      ],
    },
    high: {
      label: 'ความเสี่ยงสูง',
      tone: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      reason: 'มี Ratio เกินเพดานที่ธนาคารยอมรับ — โอกาสกู้ไม่ผ่านสูง',
      actions: [
        'แนะนำเปลี่ยน Unit ที่ราคาต่ำกว่า 20-30%',
        'หรือเพิ่มเงินดาวน์อย่างมีนัยสำคัญ',
        'ห้ามรับจองจนกว่าจะได้ Pre-approval Letter จริง',
      ],
    },
  };
  const risk = RISK_META[riskTier];

  return (
    <div className="space-y-4">
      {/* Main Loan Amount Card */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Home className="w-5 h-5 text-green-600" />
              {estimation.source === 'manual' ? 'วงเงินกู้ที่ธนาคารอนุมัติ' : 'วงเงินกู้ที่ประเมิน'}
            </span>
            <Badge className={`${risk.bg} ${risk.tone} border ${risk.border}`}>
              {risk.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Maximum Loan Amount */}
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              วงเงินกู้สูงสุด
              {estimation.source === 'manual' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  ธนาคารอนุมัติแล้ว
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                  ระบบประเมิน
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(estimation.max_loan_amount)}
            </div>
          </div>

          {/* Recommended vs Max */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-xs text-muted-foreground mb-1">แนะนำ</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatCurrency(estimation.recommended_loan_amount)}
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-xs text-muted-foreground mb-1">ค่างวด/เดือน</div>
              <div className="text-lg font-semibold text-chateau">
                {formatCurrency(estimation.monthly_payment)}
              </div>
            </div>
          </div>

          {/* Interest Rate & Term */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">อัตราดอกเบี้ย (ประเมิน)</div>
                <div className="font-semibold">~{estimation.interest_rate}% ต่อปี</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">ระยะเวลา</div>
                <div className="font-semibold">{estimation.loan_term_years} ปี</div>
              </div>
            </div>
          </div>

          {/* Approval probability — hybrid view: % + tier color + 1 next action.
              Cap at 85% because banks check NCB which we don't have — perfect 100%
              over-promises and burns Sales when bank actually rejects. */}
          {(() => {
            const cappedProb = Math.min(0.85, estimation.affordability.approval_probability);
            const pct = cappedProb * 100;
            const barColor = riskTier === 'low' ? 'bg-green-500' : riskTier === 'medium' ? 'bg-orange-500' : 'bg-red-500';
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    โอกาสอนุมัติ
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${risk.bg} ${risk.tone} ${risk.border} font-normal`}>
                      {risk.label}
                    </span>
                  </span>
                  <span className={`font-bold ${risk.tone}`}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-600 flex items-start gap-1.5 pt-1">
                  <span className={risk.tone}>→</span>
                  <span>{risk.actions[0]}</span>
                </p>
              </div>
            );
          })()}

          {/* Disclaimer — text depends on whether the number came from a real bank
              approval or the system's estimate. Manual = trust the bank, no caveat;
              Estimate = remind Sales that NCB isn't in the math. */}
          <div className="flex items-start gap-2 text-[11px] text-gray-500 border-t border-gray-100 pt-3">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {estimation.source === 'manual' ? (
              <p>
                ตัวเลขนี้มาจาก <span className="font-medium">Pre-approval Letter ของธนาคาร</span> ที่ Sales ระบุไว้ —
                {' '}ค่างวด / DTI / LTV คำนวณใหม่ตามวงเงินที่ธนาคารอนุมัติ
              </p>
            ) : (
              <p>
                เป็นการประเมินจาก DTI / LTV — <span className="font-medium">ไม่รวม NCB และประวัติเครดิตจริง</span>
                {' '}ผลอนุมัติจริงต้องเช็คกับธนาคาร
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Affordability Metrics — 2-column comparison: ถ้ากู้สูงสุด vs ถ้ากู้แนะนำ.
          The default ratios shown by the engine are calculated against the
          "actual" loan amount (which may = max). Sales saw "DTI 43%" and thought
          customer was tight, when actually that's the max scenario; the recommended
          ฿18.2M gives much healthier numbers (DTI ~35%). Showing both side-by-side
          eliminates that misreading. */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-chateau" />
            ความสามารถในการชำระ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // Proportionally scale the current (max-scenario) ratios down to the
            // recommended scenario. Math: rate/term are the same, so payment scales
            // linearly with loan; LTV/Housing scale linearly; DTI shifts by the
            // delta in housing payment.
            const currentLoan = estimation.breakdown.loan_amount || estimation.max_loan_amount;
            const recommendedLoan = estimation.recommended_loan_amount;
            const factor = currentLoan > 0 ? recommendedLoan / currentLoan : 0.8;
            const maxDTI = estimation.affordability.dti_ratio;
            const maxLTV = estimation.affordability.ltv_ratio;
            const maxHousing = estimation.affordability.housing_expense_ratio;
            const recDTI = Math.max(0, maxDTI - maxHousing * (1 - factor));
            const recLTV = maxLTV * factor;
            const recHousing = maxHousing * factor;

            // Tier helpers — same thresholds as before
            const dtiTone = (v: number) => v > 43 ? 'text-red-600' : v > 36 ? 'text-orange-600' : 'text-green-600';
            const dtiLabel = (v: number) => v > 43 ? 'เกินมาตรฐาน' : v > 36 ? 'พอใช้' : 'ดี';
            const ltvTone = (v: number) => v > 90 ? 'text-red-600' : v > 80 ? 'text-orange-600' : 'text-green-600';
            const ltvLabel = (v: number) => v > 90 ? 'เกินมาตรฐาน' : v > 80 ? 'พอใช้' : 'ดี';
            const housingTone = (v: number) => v > 35 ? 'text-red-600' : v > 28 ? 'text-orange-600' : 'text-green-600';
            const housingLabel = (v: number) => v > 35 ? 'เกินมาตรฐาน' : v > 28 ? 'พอใช้' : 'ดี';

            const rows: Array<{ name: string; tooltip?: string; max: number; rec: number; tone: (v: number) => string; status: (v: number) => string }> = [
              { name: 'อัตราส่วนหนี้ต่อรายได้ (DTI)', max: maxDTI, rec: recDTI, tone: dtiTone, status: dtiLabel },
              { name: 'อัตราส่วนเงินกู้ต่อมูลค่า (LTV)', max: maxLTV, rec: recLTV, tone: ltvTone, status: ltvLabel },
              { name: 'สัดส่วนค่าที่อยู่อาศัย', max: maxHousing, rec: recHousing, tone: housingTone, status: housingLabel },
            ];

            return (
              <div className="space-y-4">
                {/* Column headers — explain both scenarios */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pb-2 border-b border-gray-100">
                  <div></div>
                  <div className="text-[11px] text-gray-500 text-right min-w-[80px]">
                    <div>ถ้ากู้สูงสุด</div>
                    <div className="font-semibold text-gray-700">{formatCurrency(estimation.max_loan_amount)}</div>
                  </div>
                  <div className="text-[11px] text-gray-500 text-right min-w-[80px]">
                    <div>ถ้ากู้แนะนำ</div>
                    <div className="font-semibold text-gray-700">{formatCurrency(estimation.recommended_loan_amount)}</div>
                  </div>
                </div>

                {/* Rows — name + 2 values */}
                {rows.map((row) => (
                  <div key={row.name} className="space-y-1.5">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {row.name}
                        <Info className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className={`text-right min-w-[80px] ${row.tone(row.max)}`}>
                        <div className="font-bold">{row.max.toFixed(1)}%</div>
                        <div className="text-[10px] font-normal">{row.status(row.max)}</div>
                      </div>
                      <div className={`text-right min-w-[80px] ${row.tone(row.rec)}`}>
                        <div className="font-bold">{row.rec.toFixed(1)}%</div>
                        <div className="text-[10px] font-normal">{row.status(row.rec)}</div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                  ⓘ คอลัมน์ <span className="font-medium">"ถ้ากู้แนะนำ"</span> คือสถานะการเงินจริง หากลูกค้ากู้ตามวงเงินที่ระบบแนะนำ (80% ของสูงสุด)
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Loan Breakdown */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-blue-600" />
            รายละเอียดสินเชื่อ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // Cash-gap detection: if loan + down payment can't cover the property price,
            // the customer needs to bring more cash. Sales must see this before talking
            // numbers — otherwise they over-promise and the deal collapses at signing.
            const propertyValue = estimation.breakdown.property_value;
            const downPayment = estimation.breakdown.down_payment;
            const loanAmount = estimation.breakdown.loan_amount;
            const cashGap = Math.max(0, propertyValue - downPayment - loanAmount);
            const downNotSet = !downPayment || downPayment <= 0;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">มูลค่าทรัพย์สิน</span>
                  <span className="font-semibold">{formatCurrency(propertyValue)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">เงินดาวน์</span>
                  {downNotSet ? (
                    <span className="text-xs text-amber-700 italic">
                      โปรดระบุเงินดาวน์ก่อน
                    </span>
                  ) : (
                    <span className="font-semibold text-green-600">{formatCurrency(downPayment)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">วงเงินกู้</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(loanAmount)}</span>
                </div>
                {cashGap > 0 && (
                  <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                    <span className="text-sm text-red-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      ต้องเตรียมเงินสดเพิ่ม
                    </span>
                    <span className="font-semibold text-red-600">{formatCurrency(cashGap)}</span>
                  </div>
                )}
                <div className="h-px bg-border"></div>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">ดอกเบี้ยรวม</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(estimation.breakdown.total_interest)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-primary/5">
                  <span className="text-sm font-semibold">ยอดชำระรวมทั้งหมด</span>
                  <span className="font-bold text-lg">{formatCurrency(estimation.breakdown.total_payment)}</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Warnings */}
      {estimation.warnings && estimation.warnings.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              ข้อควรระวัง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {estimation.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground">{warning}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {estimation.recommendations && estimation.recommendations.length > 0 && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              คำแนะนำ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {estimation.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 mt-0.5">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Assumptions */}
      <Card className="border-l-4 border-l-gray-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="w-4 h-4 text-gray-600" />
            ข้อสมมติฐาน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {estimation.assumptions.map((assumption, index) => (
              <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{assumption}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center">
        คำนวณเมื่อ: {new Date(estimation.calculated_at).toLocaleString('th-TH')}
      </div>
    </div>
  );
}
