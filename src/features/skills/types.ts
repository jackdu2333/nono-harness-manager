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
}
