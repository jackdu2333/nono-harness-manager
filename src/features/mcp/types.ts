export interface McpServer {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  command: string;
  args: string | null; // JSON array string
  env: string | null; // JSON object string
  source_path: string | null;
  summary: string | null;
  tags: string | null;
  confidence: string | null;
  evidence_files: string | null;
  manual_override: number | null;
  last_analyzed_at: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}
