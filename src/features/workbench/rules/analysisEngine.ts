import type { HealthIssue, AnalyticsOverview } from '@/features/local-assets/types';
import type { DuplicateResult } from '@/features/skills/utils/duplicateDetector';
import type {
  AnalysisReport,
  AnalysisFinding,
  SuggestedAction,
  RelatedResource,
  DashboardData,
  GovernanceSuggestion,
} from '../types';
import { analyzeSkillRules } from './skillRules';
import { analyzeAgentRules } from './agentRules';
import { analyzeMcpRules } from './mcpRules';
import { analyzeProposalRules } from './proposalRules';

function suggestionsToFindings(suggestions: GovernanceSuggestion[]): AnalysisFinding[] {
  return suggestions.map((s) => ({
    id: s.id,
    title: s.title,
    detail: s.reason,
    severity: s.severity,
    resource_type: s.resource_type,
    resource_ids: s.resource_id ? [s.resource_id] : [],
    count: s.resource_count,
  }));
}

function suggestionsToActions(suggestions: GovernanceSuggestion[]): SuggestedAction[] {
  const seen = new Set<string>();
  return suggestions
    .filter((s) => {
      if (seen.has(s.action_target)) return false;
      seen.add(s.action_target);
      return true;
    })
    .map((s) => ({
      label: s.action_label,
      target_path: s.action_target,
      description: s.reason,
      priority: s.severity === 'critical' ? 'high' : s.severity === 'warning' ? 'medium' : 'low',
    }));
}

// ── 1. Analyze Skills ──

export function analyzeSkills(
  data: DashboardData,
  dupResult: DuplicateResult | null,
  analytics: AnalyticsOverview | null,
): AnalysisReport {
  const suggestions = analyzeSkillRules(data.skills, dupResult, analytics);
  const active = data.skills.filter((s) => s.is_archived === 0);
  const archived = data.skills.filter((s) => s.is_archived === 1);

  const summary = `共 ${data.skills.length} 个 Skills（${active.length} 活跃，${archived.length} 已归档）。` +
    `发现 ${suggestions.length} 项治理建议。`;

  // Related resources: top 5 by usage
  const topSkills = [...active]
    .sort((a, b) => b.total_usage_count - a.total_usage_count)
    .slice(0, 5);
  const related: RelatedResource[] = topSkills.map((s) => ({
    type: 'skill' as const,
    id: s.id,
    name: s.name,
    path: s.path,
  }));

  const nextSteps = [
    '优先补全高使用 Skills 的描述和分类',
    '处理待整理和待进化的 Skills',
    '检查并合并疑似重复的 Skills',
    '考虑归档长期未使用的 Skills',
  ];

  return {
    task_type: 'analyze_skills',
    generated_at: new Date().toISOString(),
    summary,
    findings: suggestionsToFindings(suggestions),
    suggested_actions: suggestionsToActions(suggestions),
    related_resources: related,
    next_steps: nextSteps,
  };
}

// ── 2. Check Agents ──

export function checkAgents(data: DashboardData): AnalysisReport {
  const suggestions = analyzeAgentRules(data.agents);

  const confirmed = data.agents.filter((a) => a.is_user_confirmed).length;
  const ignored = data.agents.filter((a) => a.is_ignored).length;
  const candidate = data.agents.length - confirmed - ignored;

  const summary = `共 ${data.agents.length} 个 Agents（${confirmed} 已确认，${candidate} 候选，${ignored} 已忽略）。` +
    `发现 ${suggestions.length} 项问题。`;

  const related: RelatedResource[] = data.agents
    .filter((a) => a.status === 'broken' || a.confidence === 'candidate')
    .slice(0, 10)
    .map((a) => ({
      type: 'agent' as const,
      id: a.id,
      name: a.name,
      path: a.app_path ?? a.cli_path ?? a.config_path,
    }));

  const nextSteps = [
    '确认或忽略候选 Agents',
    '修复状态为 broken 的 Agents',
    '补全缺失的路径信息',
    '检查日志路径以启用使用量分析',
  ];

  return {
    task_type: 'check_agents',
    generated_at: new Date().toISOString(),
    summary,
    findings: suggestionsToFindings(suggestions),
    suggested_actions: suggestionsToActions(suggestions),
    related_resources: related,
    next_steps: nextSteps,
  };
}

// ── 3. Check MCP ──

export function checkMcp(data: DashboardData): AnalysisReport {
  const suggestions = analyzeMcpRules(data.mcpServers);

  const summary = `共 ${data.mcpServers.length} 个 MCP Servers。发现 ${suggestions.length} 项问题。`;

  const related: RelatedResource[] = data.mcpServers
    .filter((m) => !m.description || !m.command || m.status === 'broken')
    .slice(0, 10)
    .map((m) => ({
      type: 'mcp_server' as const,
      id: m.id,
      name: m.name,
      path: m.source_path,
    }));

  const nextSteps = [
    '修复命令为空或状态异常的 MCP Server',
    '补全缺失的描述和分类信息',
    '确认来源路径以便追溯配置文件',
  ];

  return {
    task_type: 'check_mcp',
    generated_at: new Date().toISOString(),
    summary,
    findings: suggestionsToFindings(suggestions),
    suggested_actions: suggestionsToActions(suggestions),
    related_resources: related,
    next_steps: nextSteps,
  };
}

// ── 4. Analyze Proposals ──

export function analyzeProposals(data: DashboardData): AnalysisReport {
  const suggestions = analyzeProposalRules(data.proposals);

  const statusCounts: Record<string, number> = {};
  for (const p of data.proposals) {
    const s = p.status ?? 'unknown';
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }
  const statusStr = Object.entries(statusCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join('，');

  const summary = `共 ${data.proposals.length} 个 Proposals（${statusStr || '无'}）。` +
    `发现 ${suggestions.length} 项需关注。`;

  const related: RelatedResource[] = data.proposals
    .filter((p) =>
      p.status === 'pending_review' ||
      p.status === 'pending_manual_review' ||
      p.status === 'blocked',
    )
    .slice(0, 10)
    .map((p) => ({
      type: 'proposal' as const,
      id: p.id,
      name: p.resource_name ?? `${p.resource_type}:${p.resource_id}`,
    }));

  const nextSteps = [
    '优先处理被阻塞的 Proposals',
    '审核待审核和待人工审核的 Proposals',
    '检查超过 7 天未处理的 Proposals 是否已过时',
  ];

  return {
    task_type: 'review_proposals',
    generated_at: new Date().toISOString(),
    summary,
    findings: suggestionsToFindings(suggestions),
    suggested_actions: suggestionsToActions(suggestions),
    related_resources: related,
    next_steps: nextSteps,
  };
}

// ── 5. Generate Daily Governance Plan ──

export function generateDailyPlan(
  data: DashboardData,
  healthIssues: HealthIssue[],
  dupResult: DuplicateResult | null,
  analytics: AnalyticsOverview | null,
): AnalysisReport {
  const skillReport = analyzeSkills(data, dupResult, analytics);
  const agentReport = checkAgents(data);
  const mcpReport = checkMcp(data);
  const proposalReport = analyzeProposals(data);

  // Aggregate all findings
  const allFindings = [
    ...skillReport.findings,
    ...agentReport.findings,
    ...mcpReport.findings,
    ...proposalReport.findings,
  ];

  // Sort by severity: critical first
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  allFindings.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;
  const warningCount = allFindings.filter((f) => f.severity === 'warning').length;
  const infoCount = allFindings.filter((f) => f.severity === 'info').length;

  const totalItems =
    skillReport.findings.length +
    agentReport.findings.length +
    mcpReport.findings.length +
    proposalReport.findings.length;

  const summary = `今日 Harness 治理概览：共发现 ${totalItems} 项治理建议` +
    `（${criticalCount} 严重，${warningCount} 警告，${infoCount} 信息）。` +
    `Skills ${skillReport.findings.length} 项，` +
    `Agents ${agentReport.findings.length} 项，` +
    `MCP ${mcpReport.findings.length} 项，` +
    `Proposals ${proposalReport.findings.length} 项。`;

  // Top 3 suggested actions from all reports
  const allActions = [
    ...skillReport.suggested_actions,
    ...agentReport.suggested_actions,
    ...mcpReport.suggested_actions,
    ...proposalReport.suggested_actions,
  ];
  const actionPriorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  allActions.sort((a, b) => (actionPriorityOrder[a.priority] ?? 2) - (actionPriorityOrder[b.priority] ?? 2));
  const topActions = allActions.slice(0, 3);

  // Top related resources
  const allRelated = [
    ...skillReport.related_resources,
    ...agentReport.related_resources,
    ...mcpReport.related_resources,
    ...proposalReport.related_resources,
  ].slice(0, 10);

  const nextSteps = [
    criticalCount > 0 ? `立即处理 ${criticalCount} 个严重问题` : '',
    warningCount > 0 ? `处理 ${warningCount} 个警告级问题` : '',
    '优先处理高使用但元数据不完整的 Skills',
    '确认候选 Agents 以启用完整分析',
    '审核待处理的 Proposals',
    infoCount > 0 ? `有余力时处理 ${infoCount} 个信息级建议` : '',
  ].filter(Boolean);

  return {
    task_type: 'daily_governance_plan',
    generated_at: new Date().toISOString(),
    summary,
    findings: allFindings.slice(0, 15), // Limit to top 15
    suggested_actions: topActions,
    related_resources: allRelated,
    next_steps: nextSteps,
  };
}
