export interface SkillSource {
  id: string;
  name: string;
  path: string;
  source_type: string | null;
  enabled: number;
  scan_depth: number;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  source_id: string | null;
  name: string;
  path: string;
  skill_type: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  description_source: string | null;
  description_confidence: string | null;
  description_updated_at: string | null;
  description_is_manual: number | null;
  summary: string | null;
  tags: string | null;
  confidence: string | null;
  evidence_files: string | null;
  manual_override: number | null;
  last_analyzed_at: string | null;
  status: string;
  entry_file: string | null;
  metadata_path: string | null;
  has_metadata: number;
  is_executable: number;
  total_usage_count: number;
  last_used_at: string | null;
  last_modified_at: string | null;
  created_at: string;
  updated_at: string;
  // Curation lifecycle flags (migration 0007) — orthogonal tags
  is_favorite: number;
  needs_review: number;
  needs_improvement: number;
  is_archived: number;
  duplicate_group_id: string | null;
  // Evolution tracking (§六)
  improvement_note: string | null;
  improvement_status: string | null;
  last_improved_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
}

/** Secondary views on the Skills page — each is a filtered list, not a dashboard. §三 */
export type SkillView =
  | 'all'
  | 'favorites'
  | 'needs_review'
  | 'needs_improvement'
  | 'uncategorized'
  | 'missing_description'
  | 'duplicates'
  | 'archived';

export type SkillAiReadyStatus =
  | 'AI Ready'
  | 'Needs Metadata'
  | 'Needs Example'
  | 'Needs Boundary'
  | 'Not Recommended'
  | 'Broken';

export interface SkillAnalysisFilters {
  source_ids?: string[];
  agent_clients?: string[];
  categories?: string[];
  statuses?: string[];
  ai_ready_statuses?: SkillAiReadyStatus[];
  time_range?: '7d' | '30d' | 'all';
}

export interface SkillAnalysisOverview {
  generated_at: string;
  summary: SkillAnalysisSummary;
  skills: SkillAnalysisItem[];
  usage_rankings: SkillUsageRankings;
  quadrants: SkillQuadrants;
  quality_issues: SkillQualityIssueGroup[];
  duplicate_groups: SkillDuplicateGroup[];
  agent_fit_matrix: AgentSkillFitMatrix;
  scenario_coverage: ScenarioCoverageGroup[];
  recommendations: SkillAnalysisRecommendations;
}

export interface SkillAnalysisSummary {
  total_skills: number;
  ai_ready: number;
  needs_review: number;
  needs_improvement: number;
  suspected_duplicates: number;
  dormant: number;
  broken: number;
  average_health_score: number;
}

export interface SkillAnalysisItem {
  skill_id: string;
  name: string;
  path: string;
  source_id: string | null;
  source_name: string | null;
  category: string | null;
  status: string;
  health_score: number;
  health_status: string;
  ai_ready_status: SkillAiReadyStatus;
  usage_7d: number;
  usage_30d: number;
  usage_all_time: number;
  last_observed_used_at: string | null;
  agent_client_count: number;
  primary_agent_client: string | null;
  agent_usage_distribution: AgentUsageCount[];
  usage_kind_distribution: UsageKindCount[];
  value_group: string;
  scenario: string;
  quality_flags: string[];
  compatible_agents: string[];
  content_excerpt_chars: number;
  template_residue: boolean;
}

export interface UsageKindCount {
  usage_kind: string;
  count: number;
}

export interface AgentUsageCount {
  agent_client: string;
  count: number;
}

export interface SkillUsageRankings {
  last_7_days: SkillUsageRankItem[];
  last_30_days: SkillUsageRankItem[];
  all_time: SkillUsageRankItem[];
}

export interface SkillUsageRankItem {
  skill_id: string;
  name: string;
  count: number;
  health_score: number;
  ai_ready_status: SkillAiReadyStatus;
  primary_agent_client: string | null;
}

export interface SkillQuadrants {
  core_assets: SkillQuadrantItem[];
  priority_improvements: SkillQuadrantItem[];
  potential_assets: SkillQuadrantItem[];
  cleanup_candidates: SkillQuadrantItem[];
}

export interface SkillQuadrantItem {
  skill_id: string;
  name: string;
  health_score: number;
  usage_30d: number;
  usage_all_time: number;
  reasons: string[];
}

export interface SkillQualityIssueGroup {
  issue_key: string;
  label: string;
  count: number;
  skill_ids: string[];
}

export interface SkillDuplicateGroup {
  group_id: string;
  group_type: 'duplicate' | 'overlap';
  confidence: 'high' | 'medium' | 'low';
  primary_candidate_id: string | null;
  archive_candidate_ids: string[];
  skills: SkillDuplicateMember[];
  reasons: string[];
  suggested_action: 'merge' | 'archive_old_versions' | 'keep_separate' | 'needs_review';
}

export interface SkillDuplicateMember {
  skill_id: string;
  name: string;
  health_score: number;
  usage_30d: number;
  usage_all_time: number;
  path: string;
}

export interface AgentSkillFitMatrix {
  agents: string[];
  fits: AgentSkillFit[];
}

export interface AgentSkillFit {
  skill_id: string;
  agent_client: string;
  fit_level: 'strong' | 'possible' | 'weak' | 'unknown';
  reasons: string[];
  observed_usage_count: number;
}

export interface ScenarioCoverageGroup {
  scenario: string;
  skill_count: number;
  ai_ready_count: number;
  broken_count: number;
  usage_30d: number;
  average_health_score: number;
  signals: string[];
}

export interface SkillAnalysisRecommendations {
  optimize_top: SkillRecommendationItem[];
  archive_top: SkillRecommendationItem[];
  missing_description_top: SkillRecommendationItem[];
  missing_example_top: SkillRecommendationItem[];
  missing_boundary_top: SkillRecommendationItem[];
  codex_analysis_top: SkillRecommendationItem[];
  merge_groups: SkillDuplicateGroup[];
  agent_binding_top: AgentBindingRecommendation[];
}

export interface SkillRecommendationItem {
  skill_id: string;
  name: string;
  reason: string;
  health_score: number;
  usage_30d: number;
  usage_all_time: number;
}

export interface AgentBindingRecommendation {
  skill_id: string;
  name: string;
  agent_client: string;
  reason: string;
}
