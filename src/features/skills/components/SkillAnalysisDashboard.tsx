import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Boxes, Brain, CheckCircle2, Layers3, ListFilter, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSkillsStore } from '../store';
import {
  SkillAnalysisFilters,
  SkillAnalysisItem,
  SkillAnalysisOverview,
  SkillDuplicateGroup,
  SkillQuadrantItem,
  SkillRecommendationItem,
  SkillUsageRankItem,
} from '../types';

interface SkillAnalysisDashboardProps {
  onSelectSkill: (skillId: string) => void;
}

type RankingTab = '7d' | '30d' | 'all';
type SkillAnalysisProposalType =
  | 'skill_metadata_improvement'
  | 'skill_example_improvement'
  | 'skill_boundary_improvement'
  | 'skill_archive_recommendation'
  | 'skill_merge_recommendation'
  | 'skill_agent_binding_recommendation';

const aiReadyStatuses = [
  'AI Ready',
  'Needs Metadata',
  'Needs Example',
  'Needs Boundary',
  'Not Recommended',
  'Broken',
] as const;

export function SkillAnalysisDashboard({ onSelectSkill }: SkillAnalysisDashboardProps) {
  const {
    analysisOverview,
    analysisFilters,
    fetchAnalysis,
    isLoadingAnalysis,
    sources,
    setAnalysisFilters,
    toggleNeedsReview,
    toggleNeedsImprovement,
    createAnalysisProposal,
  } = useSkillsStore();
  const [rankingTab, setRankingTab] = useState<RankingTab>('30d');
  const [message, setMessage] = useState<string | null>(null);
  const [focusedSkillIds, setFocusedSkillIds] = useState<string[] | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    analysisOverview?.skills.forEach((skill) => {
      if (skill.category) values.add(skill.category);
    });
    return Array.from(values).sort();
  }, [analysisOverview]);

  const applyFilter = (patch: SkillAnalysisFilters) => {
    const next = { ...analysisFilters, ...patch };
    setAnalysisFilters(next);
    fetchAnalysis(next);
  };

  const resetFilters = () => {
    setAnalysisFilters({});
    fetchAnalysis({});
  };

  const createProposal = async (
    skillId: string,
    proposalType: Parameters<typeof createAnalysisProposal>[1],
    reason: string,
    extra: Record<string, unknown> = {},
  ) => {
    await createAnalysisProposal(skillId, proposalType, {
      source: 'skills_analysis',
      reason,
      ...extra,
    });
    setMessage('已创建治理 proposal，等待 Harness 审核。');
  };

  if (!analysisOverview) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        {isLoadingAnalysis ? '正在生成 Skill 分析...' : '暂无分析数据'}
      </div>
    );
  }

  const rankings =
    rankingTab === '7d'
      ? analysisOverview.usage_rankings.last_7_days
      : rankingTab === '30d'
        ? analysisOverview.usage_rankings.last_30_days
        : analysisOverview.usage_rankings.all_time;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-4 lg:px-6 py-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Skill 资产经营分析</h2>
            <p className="text-xs text-muted-foreground mt-1">
              使用口径：可观测使用次数（日志推断），不包含 Harness UI 管理操作。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={analysisFilters.source_ids?.[0] ?? 'all'} onValueChange={(value) => applyFilter({ source_ids: value === 'all' ? [] : [value] })}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="来源：全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">来源：全部</SelectItem>
              {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Select value={analysisFilters.agent_clients?.[0] ?? 'all'} onValueChange={(value) => applyFilter({ agent_clients: value === 'all' ? [] : [value] })}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Agent：全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Agent：全部</SelectItem>
              {analysisOverview.agent_fit_matrix.agents.map((agent) => (
                  <SelectItem key={agent} value={agent}>{agent}</SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Select value={analysisFilters.categories?.[0] ?? 'all'} onValueChange={(value) => applyFilter({ categories: value === 'all' ? [] : [value] })}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="分类：全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">分类：全部</SelectItem>
              {categories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Select value={analysisFilters.ai_ready_statuses?.[0] ?? 'all'} onValueChange={(value) => applyFilter({ ai_ready_statuses: value === 'all' ? [] : [value as NonNullable<SkillAnalysisFilters['ai_ready_statuses']>[number]] })}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="AI Ready：全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">AI Ready：全部</SelectItem>
              {aiReadyStatuses.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-9 gap-2" onClick={resetFilters}>
              <ListFilter className="w-4 h-4" />
              重置
            </Button>
            <Button variant="secondary" className="h-9 gap-2" onClick={() => fetchAnalysis()} disabled={isLoadingAnalysis}>
              <RefreshCw className={`w-4 h-4 ${isLoadingAnalysis ? 'animate-spin' : ''}`} />
              刷新分析
            </Button>
          </div>
        </div>

        {message && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {message}
          </div>
        )}

        <SummaryCards
          summary={analysisOverview.summary}
          skills={analysisOverview.skills}
          duplicateSkillIds={new Set(analysisOverview.duplicate_groups.flatMap((group) => group.skills.map((skill) => skill.skill_id)))}
          onFocus={setFocusedSkillIds}
        />

        <Section title="价值四象限" icon={<Boxes className="w-4 h-4" />}>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
            <Quadrant title="核心资产" items={analysisOverview.quadrants.core_assets} tone="emerald" onSelectSkill={onSelectSkill} />
            <Quadrant title="优先打磨" items={analysisOverview.quadrants.priority_improvements} tone="amber" onSelectSkill={onSelectSkill} />
            <Quadrant title="潜力资产" items={analysisOverview.quadrants.potential_assets} tone="blue" onSelectSkill={onSelectSkill} />
            <Quadrant title="清理候选" items={analysisOverview.quadrants.cleanup_candidates} tone="slate" onSelectSkill={onSelectSkill} />
          </div>
        </Section>

        <Section title="使用排行" icon={<Activity className="w-4 h-4" />}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs text-muted-foreground">可观测使用次数（日志推断）</p>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {[
                ['7d', '最近 7 天'],
                ['30d', '最近 30 天'],
                ['all', '历史以来'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setRankingTab(value as RankingTab)}
                  className={`px-3 py-1.5 text-xs transition-colors ${rankingTab === value ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <RankingList items={rankings} onSelectSkill={onSelectSkill} />
        </Section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Section title="质量问题清单" icon={<AlertTriangle className="w-4 h-4" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analysisOverview.quality_issues.map((issue) => (
                <button
                  key={issue.issue_key}
                  onClick={() => {
                    setFocusedSkillIds(issue.skill_ids);
                  }}
                  className="text-left rounded-md border border-border bg-card px-3 py-2 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{issue.label}</span>
                    <span className="text-xs text-muted-foreground">{issue.count}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">点击定位第一项</p>
                </button>
              ))}
              {analysisOverview.quality_issues.length === 0 && <EmptyState text="当前筛选下没有明显质量问题。" />}
            </div>
          </Section>

          <Section title="任务场景覆盖" icon={<Layers3 className="w-4 h-4" />}>
            <div className="space-y-2">
              {analysisOverview.scenario_coverage.map((scenario) => (
                <div key={scenario.scenario} className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{scenario.scenario}</span>
                    <span className="text-xs text-muted-foreground">
                      {scenario.skill_count} 个 · 30 天 {scenario.usage_30d} 次
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill>AI Ready {scenario.ai_ready_count}</Pill>
                    <Pill>Broken {scenario.broken_count}</Pill>
                    <Pill>均分 {scenario.average_health_score}</Pill>
                    {scenario.signals.map((signal) => <Pill key={signal} warn>{signal}</Pill>)}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="重复 / 重叠分析" icon={<Layers3 className="w-4 h-4" />}>
          <DuplicateGroups groups={analysisOverview.duplicate_groups} onSelectSkill={onSelectSkill} onCreateProposal={createProposal} />
        </Section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Section title="Agent × Skill 适配" icon={<Brain className="w-4 h-4" />}>
            <AgentFitSummary skills={analysisOverview.skills} />
          </Section>

          <Section title="AI 治理建议" icon={<Sparkles className="w-4 h-4" />}>
            <Recommendations
              recommendations={analysisOverview.recommendations}
              onSelectSkill={onSelectSkill}
              onMarkReview={async (skillId) => {
                await toggleNeedsReview(skillId, true);
                setMessage('已标记为待整理。');
              }}
              onMarkImprove={async (skillId) => {
                await toggleNeedsImprovement(skillId, true);
                setMessage('已标记为待进化。');
              }}
              onCreateProposal={createProposal}
            />
          </Section>
        </div>

        <Section title="分析结果列表" icon={<ListFilter className="w-4 h-4" />}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs text-muted-foreground">
              {focusedSkillIds ? `已过滤 ${focusedSkillIds.length} 个 Skill` : `当前筛选下 ${analysisOverview.skills.length} 个 Skill`}
            </p>
            {focusedSkillIds && (
              <Button variant="outline" size="sm" onClick={() => setFocusedSkillIds(null)}>清除组内过滤</Button>
            )}
          </div>
          <SkillResultList
            skills={(focusedSkillIds
              ? analysisOverview.skills.filter((skill) => focusedSkillIds.includes(skill.skill_id))
              : analysisOverview.skills
            ).slice(0, 80)}
            onSelectSkill={onSelectSkill}
          />
        </Section>
      </div>
    </div>
  );
}

function SummaryCards({
  summary,
  skills,
  duplicateSkillIds,
  onFocus,
}: {
  summary: SkillAnalysisOverview['summary'];
  skills: SkillAnalysisItem[];
  duplicateSkillIds: Set<string>;
  onFocus: (skillIds: string[] | null) => void;
}) {
  const cards: {
    label: string;
    value: number;
    predicate: ((skill: SkillAnalysisItem) => boolean) | null;
  }[] = [
    { label: '总 Skills', value: summary.total_skills, predicate: null },
    { label: 'AI Ready', value: summary.ai_ready, predicate: (skill) => skill.ai_ready_status === 'AI Ready' },
    { label: '待整理', value: summary.needs_review, predicate: (skill) => skill.quality_flags.some((flag) => flag.includes('missing')) },
    { label: '待进化', value: summary.needs_improvement, predicate: (skill) => skill.value_group === '优先打磨' },
    { label: '疑似重复', value: summary.suspected_duplicates, predicate: (skill) => duplicateSkillIds.has(skill.skill_id) },
    { label: '长期未使用', value: summary.dormant, predicate: (skill) => skill.usage_all_time > 0 && skill.usage_30d === 0 },
    { label: 'Broken', value: summary.broken, predicate: (skill) => skill.ai_ready_status === 'Broken' },
    { label: '平均 Health', value: summary.average_health_score, predicate: null },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
      {cards.map(({ label, value, predicate }) => (
        <button
          key={label}
          onClick={() => {
            if (!predicate) {
              onFocus(null);
              return;
            }
            const matches = skills.filter((skill) => predicate(skill)).map((skill) => skill.skill_id);
            onFocus(matches.length > 0 ? matches : null);
          }}
          className="text-left rounded-md border border-border bg-card px-3 py-3 hover:bg-muted transition-colors"
        >
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-foreground mt-1">{value}</div>
        </button>
      ))}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Quadrant({ title, items, tone, onSelectSkill }: { title: string; items: SkillQuadrantItem[]; tone: string; onSelectSkill: (skillId: string) => void }) {
  const toneClass: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
    blue: 'border-blue-200 bg-blue-50/40',
    slate: 'border-slate-200 bg-slate-50/40',
  };
  return (
    <div className={`rounded-md border ${toneClass[tone] ?? 'border-border bg-card'} p-3 min-h-[220px]`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">Top {items.length}</span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <button key={item.skill_id} onClick={() => onSelectSkill(item.skill_id)} className="w-full text-left rounded-md bg-background/80 border border-border/60 px-2.5 py-2 hover:bg-background">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{item.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">H {item.health_score}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              30 天 {item.usage_30d} · 历史 {item.usage_all_time}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {item.reasons.slice(0, 2).map((reason) => <Pill key={reason}>{reason}</Pill>)}
            </div>
          </button>
        ))}
        {items.length === 0 && <EmptyState text="暂无匹配 Skill。" />}
      </div>
    </div>
  );
}

function RankingList({ items, onSelectSkill }: { items: SkillUsageRankItem[]; onSelectSkill: (skillId: string) => void }) {
  if (items.length === 0) return <EmptyState text="当前筛选下暂无可观测使用记录。" />;
  return (
    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
      {items.map((item, index) => (
        <button key={item.skill_id} onClick={() => onSelectSkill(item.skill_id)} className="w-full px-3 py-2 text-left bg-card hover:bg-muted transition-colors">
          <div className="grid grid-cols-[40px_1fr_90px_90px_120px] items-center gap-3 text-sm">
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <span className="font-medium truncate">{item.name}</span>
            <span className="text-xs text-muted-foreground">{item.count} 次</span>
            <span className="text-xs text-muted-foreground">H {item.health_score}</span>
            <span className="text-xs text-muted-foreground truncate">{item.primary_agent_client ?? 'Unknown'}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function SkillResultList({ skills, onSelectSkill }: { skills: SkillAnalysisItem[]; onSelectSkill: (skillId: string) => void }) {
  if (skills.length === 0) return <EmptyState text="没有匹配的 Skill。" />;
  return (
    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
      {skills.map((skill) => (
        <button key={skill.skill_id} onClick={() => onSelectSkill(skill.skill_id)} className="w-full text-left px-3 py-2 bg-card hover:bg-muted transition-colors">
          <div className="grid grid-cols-[1fr_96px_110px_110px_120px] items-center gap-3 text-sm">
            <span className="font-medium truncate">{skill.name}</span>
            <span className="text-xs text-muted-foreground">H {skill.health_score}</span>
            <span className="text-xs text-muted-foreground truncate">{skill.ai_ready_status}</span>
            <span className="text-xs text-muted-foreground">30 天 {skill.usage_30d}</span>
            <span className="text-xs text-muted-foreground truncate">{skill.primary_agent_client ?? 'Unknown'}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function DuplicateGroups({ groups, onSelectSkill, onCreateProposal }: { groups: SkillDuplicateGroup[]; onSelectSkill: (skillId: string) => void; onCreateProposal: (skillId: string, proposalType: SkillAnalysisProposalType, reason: string, extra?: Record<string, unknown>) => Promise<void> }) {
  if (groups.length === 0) return <EmptyState text="当前筛选下没有疑似重复或重叠组。" />;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {groups.slice(0, 12).map((group) => {
        const primary = group.primary_candidate_id ?? group.skills[0]?.skill_id;
        return (
          <div key={group.group_id} className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill warn={group.confidence !== 'high'}>{group.group_type}</Pill>
                <Pill>{group.confidence}</Pill>
              </div>
              {primary && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateProposal(primary, 'skill_merge_recommendation', '疑似重复或功能重叠，建议人工确认合并或归档旧版本。', {
                    group_id: group.group_id,
                    candidate_skill_ids: group.skills.map((skill) => skill.skill_id),
                    suggested_action: group.suggested_action,
                  })}
                >
                  生成 proposal
                </Button>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              {group.skills.map((skill) => (
                <button key={skill.skill_id} onClick={() => onSelectSkill(skill.skill_id)} className="w-full text-left rounded-md border border-border/70 bg-background px-2 py-1.5 hover:bg-muted">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{skill.name}</span>
                    <span className="text-xs text-muted-foreground">H {skill.health_score}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{skill.path}</div>
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {group.reasons.map((reason) => <Pill key={reason}>{reason}</Pill>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgentFitSummary({ skills }: { skills: SkillAnalysisItem[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { strong: number; possible: number; observed: number }>();
    skills.forEach((skill) => {
      skill.compatible_agents.forEach((agent) => {
        const current = map.get(agent) ?? { strong: 0, possible: 0, observed: 0 };
        const observed = skill.agent_usage_distribution.find((entry) => entry.agent_client === agent)?.count ?? 0;
        current.strong += skill.primary_agent_client === agent || observed > 0 ? 1 : 0;
        current.possible += 1;
        current.observed += observed;
        map.set(agent, current);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].observed - a[1].observed);
  }, [skills]);
  if (rows.length === 0) return <EmptyState text="暂无 Agent 适配线索。" />;
  return (
    <div className="space-y-2">
      {rows.map(([agent, value]) => (
        <div key={agent} className="rounded-md border border-border bg-card px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{agent}</span>
            <span className="text-xs text-muted-foreground">可观测 {value.observed} 次</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <Pill>适配 {value.possible}</Pill>
            <Pill>强证据 {value.strong}</Pill>
          </div>
        </div>
      ))}
    </div>
  );
}

function Recommendations({
  recommendations,
  onSelectSkill,
  onMarkReview,
  onMarkImprove,
  onCreateProposal,
}: {
  recommendations: SkillAnalysisOverview['recommendations'];
  onSelectSkill: (skillId: string) => void;
  onMarkReview: (skillId: string) => Promise<void>;
  onMarkImprove: (skillId: string) => Promise<void>;
  onCreateProposal: (skillId: string, proposalType: SkillAnalysisProposalType, reason: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const groups: { title: string; proposalType: SkillAnalysisProposalType; items: SkillRecommendationItem[]; icon: ReactNode }[] = [
    { title: '最值得优化', proposalType: 'skill_metadata_improvement', items: recommendations.optimize_top, icon: <Wand2 className="w-4 h-4" /> },
    { title: '最值得归档评估', proposalType: 'skill_archive_recommendation', items: recommendations.archive_top, icon: <AlertTriangle className="w-4 h-4" /> },
    { title: '最值得补描述', proposalType: 'skill_metadata_improvement', items: recommendations.missing_description_top, icon: <CheckCircle2 className="w-4 h-4" /> },
    { title: '最值得补示例', proposalType: 'skill_example_improvement', items: recommendations.missing_example_top, icon: <CheckCircle2 className="w-4 h-4" /> },
    { title: '最值得补边界', proposalType: 'skill_boundary_improvement', items: recommendations.missing_boundary_top, icon: <CheckCircle2 className="w-4 h-4" /> },
    { title: '让 Codex 分析', proposalType: 'skill_metadata_improvement', items: recommendations.codex_analysis_top, icon: <Sparkles className="w-4 h-4" /> },
  ];
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.title} className="rounded-md border border-border bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm font-medium">
            {group.icon}
            {group.title}
          </div>
          <div className="divide-y divide-border">
            {group.items.slice(0, 5).map((item) => (
              <div key={`${group.title}-${item.skill_id}`} className="px-3 py-2">
                <button onClick={() => onSelectSkill(item.skill_id)} className="text-left text-sm font-medium hover:underline">
                  {item.name}
                </button>
                <div className="text-[11px] text-muted-foreground mt-1">{item.reason}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => onMarkReview(item.skill_id)}>标记待整理</Button>
                  <Button variant="outline" size="sm" onClick={() => onMarkImprove(item.skill_id)}>标记待进化</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onCreateProposal(item.skill_id, group.proposalType, item.reason, {
                      usage_30d: item.usage_30d,
                      health_score: item.health_score,
                    })}
                  >
                    生成 proposal
                  </Button>
                </div>
              </div>
            ))}
            {group.items.length === 0 && <div className="px-3 py-2"><EmptyState text="暂无建议。" /></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${warn ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}`}>
      {children}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground py-3">{text}</div>;
}
