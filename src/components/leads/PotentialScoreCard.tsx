/**
 * Lead Potential Score Card Component
 *
 * Purpose: Display AI-calculated lead potential score with detailed breakdown
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { PotentialScore } from '@/types/leadScoring';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface PotentialScoreCardProps {
  score: PotentialScore;
  loading?: boolean;
}

export function PotentialScoreCard({ score, loading }: PotentialScoreCardProps) {
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

  const getScoreColor = (value: number) => {
    if (value >= 75) return 'text-green-600';
    if (value >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (value: number) => {
    if (value >= 75) return 'bg-green-100';
    if (value >= 50) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getConfidenceBadge = (level: string) => {
    const variants = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-orange-100 text-orange-800',
      low: 'bg-red-100 text-red-800',
    };
    return variants[level as keyof typeof variants] || variants.medium;
  };

  const getImpactIcon = (impact: string) => {
    if (impact === 'positive')
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (impact === 'negative')
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Overall Score Card */}
      <Card className="border-l-4 border-l-chateau">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="w-5 h-5 text-chateau" />
              คะแนนความน่าจะเป็นในการซื้อ
            </span>
            <Badge className={getConfidenceBadge(score.confidence_level)}>
              ความเชื่อมั่น: {score.confidence_level === 'high' ? 'สูง' : score.confidence_level === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Score Display */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div
                className={`w-32 h-32 rounded-full ${getScoreBgColor(
                  score.overall_score
                )} flex items-center justify-center`}
              >
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreColor(score.overall_score)}`}>
                    {score.overall_score}
                  </div>
                  <div className="text-xs text-muted-foreground">/ 100</div>
                </div>
              </div>
            </div>
          </div>

          {/* Conversion Probability */}
          <div className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">โอกาสในการซื้อ</div>
            <div className={`text-3xl font-bold ${getScoreColor(score.overall_score)}`}>
              {(score.conversion_probability * 100).toFixed(1)}%
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">รายละเอียดคะแนน</div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">การเงิน</span>
                <span className="font-semibold">{score.score_breakdown.financial_score}/100</span>
              </div>
              <Progress value={score.score_breakdown.financial_score} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">การมีส่วนร่วม</span>
                <span className="font-semibold">{score.score_breakdown.engagement_score}/100</span>
              </div>
              <Progress value={score.score_breakdown.engagement_score} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ความเร่งด่วน</span>
                <span className="font-semibold">{score.score_breakdown.urgency_score}/100</span>
              </div>
              <Progress value={score.score_breakdown.urgency_score} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ความเหมาะสม</span>
                <span className="font-semibold">{score.score_breakdown.fit_score}/100</span>
              </div>
              <Progress value={score.score_breakdown.fit_score} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Factors Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            ปัจจัยสำคัญ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {score.key_factors.slice(0, 5).map((factor, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="mt-0.5">{getImpactIcon(factor.impact)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{factor.factor}</div>
                    <div className={`text-sm font-semibold ${getScoreColor(factor.score)}`}>
                      {factor.score}/100
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{factor.description}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strengths & Weaknesses */}
      {(score.strengths.length > 0 || score.weaknesses.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Strengths */}
          {score.strengths.length > 0 && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  จุดแข็ง
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {score.strengths.map((strength, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      <span className="text-muted-foreground">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Weaknesses */}
          {score.weaknesses.length > 0 && (
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  จุดอ่อน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {score.weaknesses.map((weakness, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span className="text-muted-foreground">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recommendations Card */}
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            คำแนะนำ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {score.recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm p-2 rounded hover:bg-muted/50 transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Best Actions Card */}
      <Card className="border-l-4 border-l-chateau">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-chateau" />
            แผนการดำเนินการต่อไป
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {score.next_best_actions.map((action, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-chateau-50 hover:bg-chateau-100 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-chateau text-white flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </div>
                <span className="text-sm font-medium">{action}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center">
        คำนวณเมื่อ: {new Date(score.calculated_at).toLocaleString('th-TH')} • Model:{' '}
        {score.model_version}
      </div>
    </div>
  );
}
