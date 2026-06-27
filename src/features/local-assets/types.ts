export interface AssetOverview {
  id: string;
  name: string;
  path?: string | null;
  asset_type?: string | null;
  scope?: string | null;
  project_id?: string | null;
  status?: string | null;
  description?: string | null;
  file_count: number;
  total_size_bytes: number;
  last_modified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalFileEntry {
  name: string;
  path: string;
  relative_path: string;
  extension?: string | null;
  size_bytes: number;
  modified_at?: string | null;
  category: string;
}

export interface ScanStats {
  file_count: number;
  total_size_bytes: number;
  last_modified_at?: string | null;
}

export interface FileListResult {
  source_id: string;
  files: LocalFileEntry[];
  stats: ScanStats;
  truncated: boolean;
}

export interface HealthIssue {
  severity: 'critical' | 'error' | 'warning' | 'info' | string;
  source: string;
  title: string;
  resource_name?: string | null;
  resource_path?: string | null;
  description: string;
  suggestion: string;
  status: string;
}

export interface HealthReport {
  score: number;
  issues: HealthIssue[];
  generated_at: string;
}

export interface ProjectBinding {
  id: string;
  project_id: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string | null;
  created_at: string;
}

export interface UsageMetric {
  key: string;
  count: number;
}

export interface UsageEvent {
  resource_type: string;
  resource_id: string;
  action: string;
  source?: string | null;
  created_at: string;
}

export interface MatrixCell {
  agent: string;
  resource: string;
  count: number;
}

export interface UsageTrends {
  week: UsageMetric[];
  month: UsageMetric[];
  year: UsageMetric[];
}

export interface AnalyticsOverview {
  resource_counts: Record<string, number>;
  usage_by_resource_type: UsageMetric[];
  usage_by_action: UsageMetric[];
  usage_by_agent_client: UsageMetric[];
  usage_by_skill: UsageMetric[];
  usage_by_mcp_server: UsageMetric[];
  usage_by_mcp_tool: UsageMetric[];
  skill_by_agent_matrix: MatrixCell[];
  mcp_by_agent_matrix: MatrixCell[];
  recent_events: UsageEvent[];
  trends: UsageTrends;
  scan_status: ScanStatus;
}

export interface ScanStatus {
  status: 'idle' | 'running' | 'failed';
  last_started_at?: string | null;
  last_finished_at?: string | null;
}
