export interface Agent {
  id: string;
  name: string;
  description?: string | null;
  type: string | null;
  app_path: string | null;
  launch_command: string | null;
  config_path: string | null;
  default_workspace: string | null;
  status: string | null;
  launch_count: number;
  last_launched_at: string | null;
  created_at: string;
  updated_at: string;
}
