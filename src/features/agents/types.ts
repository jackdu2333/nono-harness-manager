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
  // Discovery V2 fields
  agent_key?: string | null;
  cli_path?: string | null;
  log_path?: string | null;
  bundle_id?: string | null;
  detection_source?: string | null;
  confidence?: string | null;
  evidence_json?: string | null;
  is_user_confirmed?: boolean;
  is_ignored?: boolean;
  last_detected_at?: string | null;
}

// 便捷分组
export type AgentGroup = 'confirmed' | 'candidate' | 'ignored';

export function getAgentGroup(agent: Agent): AgentGroup {
  if (agent.is_ignored || agent.status === 'ignored') return 'ignored';
  if (agent.confidence === 'candidate' || agent.status === 'pending') return 'candidate';
  return 'confirmed';
}
