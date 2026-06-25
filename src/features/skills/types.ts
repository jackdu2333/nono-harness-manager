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
