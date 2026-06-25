export interface McpServer {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  command: string;
  args: string | null; // JSON array string
  env: string | null; // JSON object string
  source_path: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}
