import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listSkills, listSkillSources } from '@/features/skills/api';
import { listAgents } from '@/features/agents/api';
import { listMcpServers } from '@/features/mcp/api';
import { listIntelligenceProposals } from '@/features/proposals/api';
import { getAnalyticsOverview, runGlobalHealthCheck } from '@/features/local-assets/api';
import { detectDuplicates } from '@/features/skills/utils/duplicateDetector';
import type { SkillSource } from '@/features/skills/types';
import type { Agent } from '@/features/agents/types';
import type { McpServer } from '@/features/mcp/types';
import type { IntelligenceProposal } from '@/features/proposals/types';
import type { AnalyticsOverview, HealthIssue } from '@/features/local-assets/types';
import type { Skill } from '@/features/skills/types';
import type { DuplicateResult } from '@/features/skills/utils/duplicateDetector';
import type {
  DashboardData,
  AnalysisReport,
  QuickTaskType,
  GovernanceSuggestion,
  WorkQueueItem,
} from '@/features/workbench/types';
import { generateAllSuggestions, generateWorkQueue } from '@/features/workbench/rules';
import {
  analyzeSkills,
  checkAgents,
  checkMcp,
  analyzeProposals,
  generateDailyPlan,
} from '@/features/workbench/rules/analysisEngine';
import { StatusSummaryBar } from '@/features/workbench/components/StatusSummaryBar';
import { QuickTasks } from '@/features/workbench/components/QuickTasks';
import { TodaySuggestions } from '@/features/workbench/components/TodaySuggestions';
import { WorkQueue } from '@/features/workbench/components/WorkQueue';
import { AnalysisReportPanel } from '@/features/workbench/components/AnalysisReportPanel';
import { ChatBox } from '@/features/workbench/components/ChatBox';
import { createAiTask } from '@/features/ai/api';
import { getAiSettings } from '@/features/ai/api';
import { invoke } from '@tauri-apps/api/core';
import type { GovernanceSuggestion as GSuggestion } from '@/features/workbench/types';

interface DashboardState {
  skills: Skill[];
  sources: SkillSource[];
  agents: Agent[];
  mcpServers: McpServer[];
  proposals: IntelligenceProposal[];
  analytics: AnalyticsOverview | null;
  healthIssues: HealthIssue[];
}

const actionLabels: Record<string, string> = {
  view_detail: '查看',
  copy_path: '复制路径',
  copy_ref: '复制引用',
  open_dir: '打开目录',
  edit_description: '编辑描述',
  set_category: '设置分类',
  set_status: '设置状态',
  archive: '归档',
  delete_index: '移除索引',
  remove_index: '移除索引',
  delete_source_file: '删除源文件',
  move_source_to_trash: '移到废纸篓',
  toggle_favorite: '切换常用',
  toggle_needs_review: '切换待整理',
  toggle_needs_improvement: '切换待进化',
  update_improvement_note: '更新进化备注',
  update_review_note: '更新整理备注',
};

function formatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return date.toLocaleString();
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<DashboardState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dupResult, setDupResult] = useState<DuplicateResult | null>(null);
  const [currentReport, setCurrentReport] = useState<AnalysisReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [skills, sources, agents, mcpServers, proposals, analytics, healthReport] =
        await Promise.all([
          listSkills(),
          listSkillSources(),
          listAgents(),
          listMcpServers(),
          listIntelligenceProposals(),
          getAnalyticsOverview().catch(() => null),
          runGlobalHealthCheck().catch(() => null),
        ]);

      const dup = detectDuplicates(skills);
      setDupResult(dup);

      setState({
        skills,
        sources,
        agents,
        mcpServers,
        proposals,
        analytics,
        healthIssues: healthReport?.issues ?? [],
      });

      // Check if AI is enabled for chat box
      getAiSettings().then((s) => setAiEnabled(s.enabled)).catch(() => {});
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Rule Engine computations ──

  const data: DashboardData | null = useMemo(() => {
    if (!state) return null;
    return {
      skills: state.skills,
      sources: state.sources,
      agents: state.agents,
      mcpServers: state.mcpServers,
      proposals: state.proposals,
      analytics: state.analytics,
    };
  }, [state]);

  const suggestions: GovernanceSuggestion[] = useMemo(() => {
    if (!data) return [];
    return generateAllSuggestions(data, state?.healthIssues ?? [], dupResult);
  }, [data, state?.healthIssues, dupResult]);

  const workQueue: WorkQueueItem[] = useMemo(() => {
    if (!data) return [];
    return generateWorkQueue(suggestions, state?.healthIssues ?? [], data.analytics);
  }, [suggestions, state?.healthIssues, data]);

  // ── Computed metrics ──

  const activeSkillsCount = state ? state.skills.filter((s) => s.is_archived === 0).length : 0;
  const pendingProposalsCount = state
    ? state.proposals.filter(
        (p) => p.status === 'pending_review' || p.status === 'pending_manual_review',
      ).length
    : 0;
  const healthIssueCount = state
    ? state.healthIssues.filter((i) => i.severity === 'critical' || i.severity === 'error').length
    : 0;
  // 7-day observable events: sum of trends.week counts (log-inferred, not raw event count)
  const recentEventCount = state?.analytics
    ? state.analytics.trends.week.reduce((sum, item) => sum + item.count, 0)
    : 0;

  // ── Quick task handler ──

  const handleRunTask = useCallback(
    (taskType: QuickTaskType) => {
      if (!data || !state) return;
      setIsRunning(true);
      // Use setTimeout to allow UI to show loading state
      setTimeout(() => {
        let report: AnalysisReport;
        switch (taskType) {
          case 'analyze_skills':
            report = analyzeSkills(data, dupResult, data.analytics);
            break;
          case 'check_agents':
            report = checkAgents(data);
            break;
          case 'check_mcp':
            report = checkMcp(data);
            break;
          case 'review_proposals':
            report = analyzeProposals(data);
            break;
          case 'daily_governance_plan':
            report = generateDailyPlan(data, state.healthIssues, dupResult, data.analytics);
            break;
        }
        setCurrentReport(report);
        setIsRunning(false);

        // Phase 3: Persist analysis result to ai_tasks table
        createAiTask({
          task_type: taskType,
          result_json: JSON.stringify(report),
          created_by: 'rule_engine',
        }).catch((err) => {
          console.warn('Failed to persist AI task:', err);
        });
      }, 50);
    },
    [data, state, dupResult],
  );

  const handleCloseReport = useCallback(() => {
    setCurrentReport(null);
  }, []);

  // ── Phase 4: Create proposals from AI suggestions ──
  const handleCreateProposal = useCallback(
    async (suggestion: GSuggestion) => {
      if (!state) return;

      // Determine affected resources based on rule_id
      const affectedSkills = state.skills.filter((s) => {
        if (s.is_archived === 1) return false;
        switch (suggestion.rule_id) {
          case 'skill.missing_description':
            return !s.description;
          case 'skill.missing_category':
            return !s.category;
          default:
            return false;
        }
      });

      if (affectedSkills.length === 0) return;

      const proposalType = suggestion.rule_id === 'skill.missing_description'
        ? 'improve_description'
        : 'update_metadata';

      const proposedChanges = suggestion.rule_id === 'skill.missing_description'
        ? JSON.stringify({ description: '[AI 建议补全描述]' })
        : JSON.stringify({ category: '[AI 建议设置分类]' });

      let created = 0;
      // Create proposals for up to 10 skills at a time
      const batch = affectedSkills.slice(0, 10);
      for (const skill of batch) {
        try {
          await invoke('create_intelligence_proposal', {
            resourceType: 'skill',
            resourceId: skill.id,
            proposalType,
            proposedChanges: proposedChanges,
            evidenceFiles: null,
            confidence: 'medium',
            createdBy: 'built_in_ai',
          });
          created++;
        } catch (err) {
          console.warn(`Failed to create proposal for skill ${skill.name}:`, err);
        }
      }

      // Refresh proposals data
      if (created > 0) {
        try {
          const proposals = await listIntelligenceProposals();
          setState((prev) => prev ? { ...prev, proposals } : null);
        } catch {}
      }

      alert(`已创建 ${created} 个 Proposal${affectedSkills.length > 10 ? `（共 ${affectedSkills.length} 个，本次最多处理 10 个）` : ''}`);
    },
    [state],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const recentEvents = state?.analytics?.recent_events ?? [];

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              AI 工作台
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              让 Harness 分析本机 AI 资产状态，并给出下一步治理建议。
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            加载中...
          </div>
        ) : (
          <div className="space-y-5">
            {/* Status Summary Bar */}
            <StatusSummaryBar
              skillsCount={activeSkillsCount}
              agentsCount={state?.agents.length ?? 0}
              mcpCount={state?.mcpServers.length ?? 0}
              pendingProposals={pendingProposalsCount}
              healthIssueCount={healthIssueCount}
              recentEventCount={recentEventCount}
              onNavigate={handleNavigate}
            />

            {/* Middle section: Quick Tasks + AI placeholder */}
            <div className="grid grid-cols-[1fr_1fr] gap-5">
              <QuickTasks onRunTask={handleRunTask} isRunning={isRunning} />

              {aiEnabled ? (
                <ChatBox onNavigate={handleNavigate} />
              ) : (
                /* AI Placeholder - will be enabled when AI settings are configured */
                <div className="rounded-lg border border-border border-dashed bg-card/50 p-4 flex flex-col items-center justify-center text-center">
                  <Zap className="w-5 h-5 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">AI 助手即将启用</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    当前基于本地规则引擎分析。在 Settings 中配置 AI 提供商后可使用智能聊天。
                  </p>
                </div>
              )}
            </div>

            {/* Analysis Report Panel (conditional) */}
            {currentReport && (
              <AnalysisReportPanel
                report={currentReport}
                onClose={handleCloseReport}
                onNavigate={handleNavigate}
              />
            )}

            {/* Today Suggestions */}
            <TodaySuggestions
              suggestions={suggestions}
              onNavigate={handleNavigate}
              onCreateProposal={handleCreateProposal}
            />

            {/* Work Queue */}
            <WorkQueue items={workQueue} onNavigate={handleNavigate} />

            {/* Recent Activity */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">最近活动</h2>
              </div>
              {recentEvents.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  暂无最近活动。开始整理 Skills 后，这里会显示你的操作记录。
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentEvents.slice(0, 8).map((event, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-5 py-2.5 text-sm"
                    >
                      <span className="text-foreground">
                        <span className="text-muted-foreground">
                          {actionLabels[event.action] ?? event.action}
                        </span>{' '}
                        <span className="text-muted-foreground/70">{event.resource_type}</span>
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        {formatTime(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
