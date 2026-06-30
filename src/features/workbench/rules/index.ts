import type { HealthIssue, AnalyticsOverview } from '@/features/local-assets/types';
import type { DuplicateResult } from '@/features/skills/utils/duplicateDetector';
import type {
  GovernanceSuggestion,
  WorkQueueItem,
  WorkQueueType,
  WorkQueuePriority,
  DashboardData,
} from '../types';
import { analyzeSkillRules } from './skillRules';
import { analyzeAgentRules } from './agentRules';
import { analyzeMcpRules } from './mcpRules';
import { analyzeProposalRules } from './proposalRules';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Aggregate all rule engines into a sorted list of suggestions.
 */
export function generateAllSuggestions(
  data: DashboardData,
  healthIssues: HealthIssue[],
  dupResult: DuplicateResult | null,
): GovernanceSuggestion[] {
  const all: GovernanceSuggestion[] = [];

  // Skill rules
  all.push(...analyzeSkillRules(data.skills, dupResult, data.analytics));

  // Agent rules
  all.push(...analyzeAgentRules(data.agents));

  // MCP rules
  all.push(...analyzeMcpRules(data.mcpServers));

  // Proposal rules
  all.push(...analyzeProposalRules(data.proposals));

  // Health issue rule
  const criticalHealth = healthIssues.filter(
    (i) => i.severity === 'critical' || i.severity === 'error',
  );
  if (criticalHealth.length > 0) {
    all.push({
      id: 'health.critical_issues',
      title: `有 ${criticalHealth.length} 个健康检查问题需要关注`,
      reason: '存在严重或错误级别的健康问题，可能影响资源可用性。',
      severity: 'critical',
      resource_type: 'health',
      resource_id: null,
      resource_count: criticalHealth.length,
      action_label: '去查看',
      action_target: '/health',
      can_create_proposal: false,
      rule_id: 'health.critical_issues',
    });
  }

  // Sort: critical > warning > info, then by resource_count descending
  all.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 2;
    const sb = SEVERITY_ORDER[b.severity] ?? 2;
    if (sa !== sb) return sa - sb;
    return b.resource_count - a.resource_count;
  });

  return all;
}

// ── WorkQueue Generation ──

interface QueueMapping {
  type: WorkQueueType;
  title: string;
  ruleIds: string[];
  priority: WorkQueuePriority;
  targetPath: string;
}

const QUEUE_MAPPINGS: QueueMapping[] = [
  {
    type: 'skill_missing_metadata',
    title: 'Skills 元数据不完整',
    ruleIds: ['skill.missing_description', 'skill.missing_category', 'skill.high_usage_low_quality'],
    priority: 'medium',
    targetPath: '/skills',
  },
  {
    type: 'skill_needs_review',
    title: 'Skills 待整理',
    ruleIds: ['skill.needs_review'],
    priority: 'medium',
    targetPath: '/skills',
  },
  {
    type: 'skill_needs_improvement',
    title: 'Skills 待进化',
    ruleIds: ['skill.needs_improvement'],
    priority: 'low',
    targetPath: '/skills',
  },
  {
    type: 'skill_duplicate',
    title: '疑似重复 Skills',
    ruleIds: ['skill.duplicate'],
    priority: 'medium',
    targetPath: '/skills',
  },
  {
    type: 'agent_candidate',
    title: 'Agents 待确认',
    ruleIds: ['agent.candidate', 'agent.unconfirmed_probable'],
    priority: 'medium',
    targetPath: '/agents',
  },
  {
    type: 'agent_broken',
    title: 'Agents 状态异常',
    ruleIds: ['agent.broken', 'agent.app_not_launchable', 'agent.path_missing'],
    priority: 'high',
    targetPath: '/agents',
  },
  {
    type: 'mcp_missing_metadata',
    title: 'MCP 元数据不完整',
    ruleIds: ['mcp.missing_description', 'mcp.missing_category', 'mcp.source_path_missing', 'mcp.command_empty', 'mcp.status_abnormal'],
    priority: 'medium',
    targetPath: '/mcp',
  },
  {
    type: 'proposal_pending',
    title: 'Proposals 待处理',
    ruleIds: ['proposal.pending_review', 'proposal.pending_manual', 'proposal.blocked', 'proposal.stale'],
    priority: 'high',
    targetPath: '/proposals',
  },
  {
    type: 'health_issue',
    title: '健康检查问题',
    ruleIds: ['health.critical_issues'],
    priority: 'high',
    targetPath: '/health',
  },
];

const PRIORITY_ORDER: Record<WorkQueuePriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Aggregate suggestions into a work queue.
 */
export function generateWorkQueue(
  suggestions: GovernanceSuggestion[],
  healthIssues: HealthIssue[],
  analytics: AnalyticsOverview | null,
): WorkQueueItem[] {
  const items: WorkQueueItem[] = [];

  for (const mapping of QUEUE_MAPPINGS) {
    const matched = suggestions.filter((s) => mapping.ruleIds.includes(s.rule_id));
    const totalCount = matched.reduce((sum, s) => sum + s.resource_count, 0);
    if (totalCount === 0) continue;

    // Upgrade priority if any matched suggestion is critical
    let priority = mapping.priority;
    if (matched.some((s) => s.severity === 'critical')) {
      priority = 'high';
    }

    items.push({
      id: `queue-${mapping.type}`,
      type: mapping.type,
      title: mapping.title,
      resource_count: totalCount,
      priority,
      target_path: mapping.targetPath,
      suggestion_ids: matched.map((s) => s.id),
    });
  }

  // Analytics low confidence check
  if (analytics) {
    const weekTotal = analytics.trends.week.reduce((sum, item) => sum + item.count, 0);
    if (weekTotal === 0 && analytics.recent_events.length === 0) {
      items.push({
        id: 'queue-analytics_low_confidence',
        type: 'analytics_low_confidence',
        title: '暂无可观测使用事件',
        resource_count: 0,
        priority: 'low',
        target_path: '/analytics',
        suggestion_ids: [],
      });
    }
  }

  // Sort by priority
  items.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    return b.resource_count - a.resource_count;
  });

  return items;
}
