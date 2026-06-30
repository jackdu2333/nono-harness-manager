import type { Skill, SkillSource } from '@/features/skills/types';
import type { Agent } from '@/features/agents/types';
import type { McpServer } from '@/features/mcp/types';
import type { IntelligenceProposal } from '@/features/proposals/types';
import type { AnalyticsOverview } from '@/features/local-assets/types';

// ── Severity & Resource ──

export type SuggestionSeverity = 'info' | 'warning' | 'critical';

export type ResourceType =
  | 'skill'
  | 'agent'
  | 'mcp_server'
  | 'proposal'
  | 'health'
  | 'analytics';

// ── Governance Suggestion ──

export interface GovernanceSuggestion {
  id: string;
  title: string;
  reason: string;
  severity: SuggestionSeverity;
  resource_type: ResourceType;
  resource_id: string | null;
  resource_count: number;
  action_label: string;
  action_target: string;
  can_create_proposal: boolean;
  rule_id: string;
}

// ── Work Queue ──

export type WorkQueueType =
  | 'skill_missing_metadata'
  | 'skill_needs_review'
  | 'skill_needs_improvement'
  | 'skill_duplicate'
  | 'agent_candidate'
  | 'agent_broken'
  | 'mcp_missing_metadata'
  | 'proposal_pending'
  | 'analytics_low_confidence'
  | 'health_issue';

export type WorkQueuePriority = 'high' | 'medium' | 'low';

export interface WorkQueueItem {
  id: string;
  type: WorkQueueType;
  title: string;
  resource_count: number;
  priority: WorkQueuePriority;
  target_path: string;
  suggestion_ids: string[];
}

// ── Quick Tasks ──

export type QuickTaskType =
  | 'analyze_skills'
  | 'check_agents'
  | 'check_mcp'
  | 'daily_governance_plan'
  | 'review_proposals';

// ── Analysis Report ──

export interface AnalysisFinding {
  id: string;
  title: string;
  detail: string;
  severity: SuggestionSeverity;
  resource_type: ResourceType;
  resource_ids: string[];
  count: number;
}

export interface SuggestedAction {
  label: string;
  target_path: string;
  description: string;
  priority: WorkQueuePriority;
}

export interface RelatedResource {
  type: ResourceType;
  id: string;
  name: string;
  path?: string | null;
}

export interface AnalysisReport {
  task_type: QuickTaskType;
  generated_at: string;
  summary: string;
  findings: AnalysisFinding[];
  suggested_actions: SuggestedAction[];
  related_resources: RelatedResource[];
  next_steps: string[];
}

// ── Dashboard Data (shared context) ──

export interface DashboardData {
  skills: Skill[];
  sources: SkillSource[];
  agents: Agent[];
  mcpServers: McpServer[];
  proposals: IntelligenceProposal[];
  analytics: AnalyticsOverview | null;
}
