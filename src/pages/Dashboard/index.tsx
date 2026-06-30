import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { createAiTask, getAiSettings, listAiTasks, type AiTask } from '@/features/ai/api';
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
  view_detail: 'common.view',
  copy_path: 'common.copy_path',
  copy_ref: 'common.copy_ref',
  open_dir: 'common.open',
  edit_description: 'common.edit',
  set_category: 'common.category',
  set_status: 'common.status',
  archive: 'skills.tag_archived',
  delete_index: 'common.remove',
  remove_index: 'common.remove',
  delete_source_file: 'common.delete',
  move_source_to_trash: 'common.delete',
  toggle_favorite: 'skills.tag_frequent',
  toggle_needs_review: 'skills.tag_organize',
  toggle_needs_improvement: 'skills.tag_evolve',
  update_improvement_note: 'skills.evolution_notes',
  update_review_note: 'skills.organize_notes',
};

function formatTime(value: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return t('common.just_now');
  if (diff < 3600000) return t('common.minutes_ago', { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return t('common.hours_ago', { n: Math.floor(diff / 3600000) });
  return date.toLocaleString();
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<DashboardState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dupResult, setDupResult] = useState<DuplicateResult | null>(null);
  const [currentReport, setCurrentReport] = useState<AnalysisReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [recentTasks, setRecentTasks] = useState<AiTask[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await listAiTasks(5);
      setRecentTasks(tasks);
    } catch (err) {
      console.warn('Failed to load recent tasks:', err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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
        }).then(() => {
          loadTasks();
        }).catch((err) => {
          console.warn('Failed to persist AI task:', err);
        });
      }, 50);
    },
    [data, state, dupResult, loadTasks],
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
        ? JSON.stringify({ description: t('dashboard.ai_suggest_desc') })
        : JSON.stringify({ category: t('dashboard.ai_suggest_cat') });

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

      alert(
        affectedSkills.length > 10
          ? t('dashboard.proposals_created_partial', { created, total: affectedSkills.length })
          : t('dashboard.proposals_created', { count: created }),
      );
    },
    [state],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const handleAskAI = useCallback((prompt: string) => {
    const event = new CustomEvent('trigger-ai-chat-prompt', { detail: { prompt } });
    window.dispatchEvent(event);
  }, []);

  const recentEvents = state?.analytics?.recent_events ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top Header Section */}
      <div className="shrink-0 border-b border-border bg-card/30 px-8 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t('workbench.title')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('workbench.subtitle')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={isLoading}
            className="gap-1.5 h-8 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </div>

        {state && !isLoading && (
          <div className="mt-3">
            <StatusSummaryBar
              skillsCount={activeSkillsCount}
              agentsCount={state.agents.length}
              mcpCount={state.mcpServers.length}
              pendingProposals={pendingProposalsCount}
              healthIssueCount={healthIssueCount}
              recentEventCount={recentEventCount}
              onNavigate={handleNavigate}
            />
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-8 py-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            {t('common.loading')}
          </div>
        ) : (
          <>
            {/* Left Column: Rules suggestions, tasks, task history, work queue and events */}
            <div className="w-[420px] xl:w-[480px] shrink-0 overflow-y-auto pr-1 space-y-4 select-none">
              {/* Today Suggestions */}
              <TodaySuggestions
                skills={state?.skills ?? []}
                agents={state?.agents ?? []}
                mcpServers={state?.mcpServers ?? []}
                proposals={state?.proposals ?? []}
                onNavigate={handleNavigate}
                onAskAI={handleAskAI}
                aiEnabled={aiEnabled}
              />

              {/* Quick Tasks */}
              <QuickTasks onRunTask={handleRunTask} isRunning={isRunning} />

              {/* Analysis Tasks History */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2.5">
                  {t('workbench.analysis_history')}
                </h3>
                {recentTasks.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/50 py-2">{t('workbench.no_history')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentTasks.map((task) => {
                      const taskLabels: Record<string, string> = {
                        analyze_skills: t('workbench.quick_tasks.analyze_skills'),
                        check_agents: t('workbench.quick_tasks.check_agents'),
                        check_mcp: t('workbench.quick_tasks.check_mcp'),
                        review_proposals: t('workbench.quick_tasks.review_proposals'),
                        daily_governance_plan: t('workbench.quick_tasks.daily_plan'),
                      };
                      const label = taskLabels[task.task_type] || task.task_type;
                      return (
                        <div key={task.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-muted/30 transition-colors border border-transparent hover:border-border/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-foreground truncate">{label}</span>
                            <span className="text-[10px] text-muted-foreground/50">{formatTime(task.created_at, t)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] px-1 bg-success/10 text-success rounded font-bold uppercase">
                              {t('dashboard.completed')}
                            </span>
                            {task.result_json && (
                              <button
                                onClick={() => {
                                  try {
                                    const report = JSON.parse(task.result_json!);
                                    setCurrentReport(report);
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="text-primary hover:underline font-semibold"
                              >
                                {t('common.view')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Work Queue */}
              <WorkQueue items={workQueue} onNavigate={handleNavigate} />

              {/* Recent Activity */}
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{t('workbench.recent_activity')}</h2>
                </div>
                {recentEvents.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t('workbench.no_recent_activity')}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentEvents.slice(0, 5).map((event, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-4 py-2 text-xs"
                      >
                        <span className="text-foreground">
                          <span className="text-muted-foreground font-medium">
                            {(actionLabels[event.action] ? t(actionLabels[event.action]) : '') || event.action}
                          </span>{' '}
                          <span className="text-muted-foreground/50 font-mono text-[10px]">{event.resource_type}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">
                          {formatTime(event.created_at, t)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI Chat or Active Report */}
            <div className="min-w-[520px] flex-1 overflow-hidden h-full flex flex-col">
              {currentReport ? (
                <div className="h-full overflow-y-auto">
                  <AnalysisReportPanel
                    report={currentReport}
                    onClose={handleCloseReport}
                    onNavigate={handleNavigate}
                  />
                </div>
              ) : aiEnabled ? (
                <ChatBox onNavigate={handleNavigate} />
              ) : (
                <div className="rounded-lg border border-border border-dashed bg-card/30 p-8 flex flex-col items-center justify-center text-center h-full">
                  <Zap className="w-8 h-8 text-muted-foreground/30 mb-3 animate-pulse-slow" />
                  <h3 className="text-sm font-semibold text-foreground">{t('workbench.ai_placeholder_title')}</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm leading-relaxed">
                    {t('workbench.ai_placeholder_desc')}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
