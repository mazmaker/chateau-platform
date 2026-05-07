/**
 * Loan Estimation Card Component
 *
 * Purpose: Display loan estimation with affordability analysis
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { LoanEstimation } from '@/types/leadScoring';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
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

  const getAffordabilityColor = (status: string) => {
    const colors = {
      excellent: 'text-green-600',
      good: 'text-blue-600',
      fair: 'text-orange-600',
      poor: 'text-red-600',
    };
    return colors[status as keyof typeof colors] || 'text-gray-600';
  };

  const getAffordabilityBg = (status: string) => {
    const colors = {
      excellent: 'bg-green-100',
      good: 'bg-blue-100',
      fair: 'bg-orange-100',
      poor: 'bg-red-100',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100';
  };

  const getAffordabilityLabel = (status: string) => {
    const labels = {
      excellent: 'ดีเยี่ยม',
      good: 'ดี',
      fair: 'พอใช้',
      poor: 'ต่ำ',
    };
    return labels[status as keyof typeof labels] || 'ไม่ระบุ';
  };

  const approvalProbabilityPercent = (estimation.affordability.approval_probability * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Main Loan Amount Card */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Home className="w-5 h-5 text-green-600" />
              วงเงินกู้ที่ประเมิน
            </span>
            <Badge className={`${getAffordabilityBg(estimation.affordability.status)} ${getAffordabilityColor(estimation.affordability.status)}`}>
              สถานะ: {getAffordabilityLabel(estimation.affordability.status)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Maximum Loan Amount */}
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">วงเงินกู้สูงสุด</div>
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
                <div className="text-xs text-muted-foreground">อัตราดอกเบี้ย</div>
                <div className="font-semibold">{estimation.interest_rate}% ต่อปี</div>
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

          {/* Approval Probability */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">โอกาสอนุมัติ</span>
              <span className="font-semibold">{approvalProbabilityPercent}%</span>
            </div>
            <Progress value={estimation.affordability.approval_probability * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Affordability Metrics */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-chateau" />
            ความสามารถในการชำระ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* DTI Ratio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">อัตราส่วนหนี้ต่อรายได้ (DTI)</span>
                <Info className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className={`font-bold ${estimation.affordability.dti_ratio > 43 ? 'text-red-600' : estimation.affordability.dti_ratio > 36 ? 'text-orange-600' : 'text-green-600'}`}>
                {estimation.affordability.dti_ratio.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(100, estimation.affordability.dti_ratio)}
              className={`h-2 ${estimation.affordability.dti_ratio > 43 ? 'bg-red-100' : ''}`}
            />
            <div className="text-xs text-muted-foreground">
              {estimation.affordability.dti_ratio <= 36 ? '✓ อยู่ในเกณฑ์ดี' : estimation.affordability.dti_ratio <= 43 ? '⚠ อยู่ในเกณฑ์พอใช้' : '✗ สูงเกินมาตรฐาน'}
            </div>
          </div>

          {/* LTV Ratio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">อัตราส่วนเงินกู้ต่อมูลค่า (LTV)</span>
                <Info className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className={`font-bold ${estimation.affordability.ltv_ratio > 90 ? 'text-red-600' : estimation.affordability.ltv_ratio > 80 ? 'text-orange-600' : 'text-green-600'}`}>
                {estimation.affordability.ltv_ratio.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={estimation.affordability.ltv_ratio}
              className={`h-2 ${estimation.affordability.ltv_ratio > 90 ? 'bg-red-100' : ''}`}
            />
            <div className="text-xs text-muted-foreground">
              {estimation.affordability.ltv_ratio <= 80 ? '✓ อยู่ในเกณฑ์ดี' : estimation.affordability.ltv_ratio <= 90 ? '⚠ อยู่ในเกณฑ์พอใช้' : '✗ สูงเกินมาตรฐาน'}
            </div>
          </div>

          {/* Housing Expense Ratio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">สัดส่วนค่าที่อยู่อาศัย</span>
              <span className="font-bold">{estimation.affordability.housing_expense_ratio.toFixed(1)}%</span>
            </div>
            <Progress value={estimation.affordability.housing_expense_ratio} className="h-2" />
            <div className="text-xs text-muted-foreground">
              ของรายได้รายเดือน
            </div>
          </div>
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
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">มูลค่าทรัพย์สิน</span>
              <span className="font-semibold">{formatCurrency(estimation.breakdown.property_value)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">เงินดาวน์</span>
              <span className="font-semibold text-green-600">{formatCurrency(estimation.breakdown.down_payment)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
              <span className="text-sm text-muted-foreground">วงเงินกู้</span>
              <span className="font-semibold text-blue-600">{formatCurrency(estimation.breakdown.loan_amount)}</span>
            </div>
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
        </CardContent>
      </Card>

      {/* Approval Factors */}
      {estimation.approval_factors && estimation.approval_factors.length > 0 && (
        <Card className="border-l-4 border-l-chateau">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-chateau" />
              ปัจจัยการอนุมัติ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {estimation.approval_factors.map((factor, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="mt-0.5">
                    {factor.impact === 'positive' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : factor.impact === 'negative' ? (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    ) : (
                      <Info className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{factor.factor}</span>
                      <span className="text-xs text-muted-foreground">น้ำหนัก {(factor.weight * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{factor.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <span className="text-red-600 mt-0.5">⚠</span>
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
