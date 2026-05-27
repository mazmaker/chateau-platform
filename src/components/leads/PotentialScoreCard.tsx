/**
 * Lead Potential Score Card Component
 *
 * Purpose: Display AI-calculated lead potential score with detailed breakdown
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { PotentialScore } from '@/types/leadScoring';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

interface PotentialScoreCardProps {
  score: PotentialScore;
  loading?: boolean;
}

export function PotentialScoreCard({ score, loading }: PotentialScoreCardProps) {
  // Track which categories are expanded. Default = all collapsed for cleaner overview;
  // Sales clicks a category header to drill down into individual factors.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

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

          {/* Hierarchical Score Breakdown — categories with their factors nested */}
          <div className="space-y-5">
            <div className="text-sm font-semibold text-foreground">รายละเอียดคะแนน</div>

            {(() => {
              // Static list of all possible factors per category so we can show
              // "missing" entries (with "—") and prompt Sales to fill them in.
              // Names MUST match the `factor` strings emitted by leadScoring.ts.
              const EXPECTED: Record<'financial'|'engagement'|'urgency'|'fit', { name: string; hint: string }[]> = {
                financial: [
                  { name: 'รายได้เทียบกับราคายูนิต', hint: 'โปรดบันทึกรายได้ต่อเดือนของลูกค้าผ่านหน้าแก้ไขข้อมูล' },
                  { name: 'เงินดาวน์พร้อม', hint: 'โปรดบันทึกเงินดาวน์ที่ลูกค้าเตรียมไว้ผ่านหน้าแก้ไขข้อมูล' },
                  { name: 'ความมั่นคงในการทำงาน', hint: 'โปรดบันทึกอาชีพและอายุงานของลูกค้าผ่านหน้าแก้ไขข้อมูล' },
                ],
                engagement: [
                  { name: 'กิจกรรมบนเว็บไซต์', hint: 'ลูกค้ายังไม่เข้าใช้งานเว็บไซต์ลูกค้า' },
                  { name: 'การดาวน์โหลดเอกสาร', hint: 'ส่งลิงก์เว็บไซต์ลูกค้าเพื่อให้ดาวน์โหลดโบรชัวร์โครงการ' },
                  { name: 'การเยี่ยมชมโครงการ', hint: 'หลังลูกค้าเข้าชมโครงการแล้ว โปรดกด "ยืนยันมาแล้ว" ที่ความสนใจของยูนิต' },
                  { name: 'จำนวนการติดต่อ', hint: 'กดปุ่มโทรในหน้านี้ทุกครั้งที่ติดต่อลูกค้า ระบบจะนับให้อัตโนมัติ' },
                ],
                urgency: [
                  { name: 'ระดับความเร่งด่วน', hint: 'โปรดกำหนดระดับความสำคัญ (สูง/กลาง/ต่ำ) ในหน้ารายละเอียด Lead' },
                  { name: 'กรอบเวลาการซื้อ', hint: 'โปรดระบุกรอบเวลาที่ลูกค้าวางแผนจะซื้อผ่านหน้าแก้ไขข้อมูล' },
                ],
                fit: [
                  { name: 'ระดับความสนใจ', hint: 'โปรดกำหนดระดับความสนใจในแต่ละยูนิตที่ลูกค้าสนใจ' },
                  { name: 'ผู้มีอำนาจตัดสินใจ', hint: 'โปรดยืนยันว่าลูกค้าเป็นผู้มีอำนาจตัดสินใจผ่านหน้าแก้ไขข้อมูล' },
                  { name: 'สถานะการอนุมัติสินเชื่อ', hint: 'โปรดบันทึกเมื่อลูกค้าได้รับการอนุมัติสินเชื่อจากธนาคารแล้ว' },
                ],
              };

              const cov = score.score_coverage;
              const factorsBy = (cat: 'financial'|'engagement'|'urgency'|'fit') =>
                score.key_factors.filter((f) => f.category === cat);

              const rows: Array<{ key: keyof typeof score.score_breakdown; label: string; covKey: 'financial'|'engagement'|'urgency'|'fit' }> = [
                { key: 'financial_score', label: 'การเงิน', covKey: 'financial' },
                { key: 'engagement_score', label: 'การมีส่วนร่วม', covKey: 'engagement' },
                { key: 'urgency_score', label: 'ความเร่งด่วน', covKey: 'urgency' },
                { key: 'fit_score', label: 'ความเหมาะสม', covKey: 'fit' },
              ];

              return rows.map((r) => {
                const value = score.score_breakdown[r.key];
                const coverage = cov ? cov[r.covKey] : 1;
                const lowData = coverage < 0.5;
                const presentFactors = factorsBy(r.covKey);
                const expected = EXPECTED[r.covKey];
                const isOpen = expanded.has(r.covKey);
                const missingCount = expected.filter((e) => !presentFactors.find((f) => f.factor === e.name)).length;

                return (
                  <div key={r.key} className="space-y-2 pb-1">
                    {/* Category header — clickable to expand/collapse factors */}
                    <button
                      type="button"
                      onClick={() => toggle(r.covKey)}
                      className="w-full text-left group"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-medium flex items-center gap-1.5 ${lowData ? 'text-gray-400' : 'text-foreground'}`}>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                          />
                          {r.label}
                          {lowData && (
                            <span
                              className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-normal"
                              title={`บันทึกข้อมูลครบ ${Math.round(coverage * 100)}% โปรดบันทึกเพิ่มเติมเพื่อเพิ่มความแม่นยำของคะแนน`}
                            >
                              ข้อมูลไม่พอ
                            </span>
                          )}
                          {!isOpen && missingCount > 0 && !lowData && (
                            <span
                              className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full font-normal"
                              title={`ยังขาดข้อมูล ${missingCount} รายการ — กดเพื่อดู`}
                            >
                              ขาด {missingCount}
                            </span>
                          )}
                        </span>
                        <span className={`font-bold ${lowData ? 'text-gray-400' : getScoreColor(value)}`}>
                          {lowData ? '—' : `${value}/100`}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Progress value={lowData ? 0 : value} className={`h-2 ${lowData ? 'opacity-40' : ''}`} />
                      </div>
                    </button>

                    {/* Nested factors — only when expanded */}
                    {isOpen && (
                      <div className="pl-3 border-l-2 border-gray-100 space-y-1 mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                        {expected.map((exp) => {
                          const factor = presentFactors.find((f) => f.factor === exp.name);
                          if (factor) {
                            return (
                              <div key={exp.name} className="flex items-start justify-between gap-2 py-1 text-xs">
                                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                  <span className="mt-0.5 flex-shrink-0">{getImpactIcon(factor.impact)}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-foreground">{factor.factor}</div>
                                    <div className="text-[11px] text-muted-foreground truncate" title={factor.description}>
                                      {factor.description}
                                    </div>
                                  </div>
                                </div>
                                <div className={`text-xs font-semibold flex-shrink-0 ${getScoreColor(factor.score)}`}>
                                  {Math.round(factor.score)}
                                </div>
                              </div>
                            );
                          }
                          // Missing factor — show with hint
                          return (
                            <div key={exp.name} className="flex items-start justify-between gap-2 py-1 text-xs">
                              <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                <Minus className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-gray-400">{exp.name}</div>
                                  <div className="text-[11px] text-amber-600/80 truncate" title={exp.hint}>
                                    {exp.hint}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-300 flex-shrink-0">—</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
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
