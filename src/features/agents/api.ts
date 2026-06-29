import { invoke } from '@tauri-apps/api/core';
import { Agent } from './types';

export async function listAgents(): Promise<Agent[]> {
  return invoke('list_agents');
}

export async function addAgent(
  name: string,
  agent_type: string | null,
  app_path: string | null,
  config_path: string | null,
  default_workspace: string | null
): Promise<Agent> {
  return invoke('add_agent', {
    name,
    agentType: agent_type,
    appPath: app_path,
    configPath: config_path,
    defaultWorkspace: default_workspace
  });
}

export async function deleteAgent(id: string): Promise<void> {
  return invoke('delete_agent', { id });
}

export async function scanAgentsInDir(path: string): Promise<number> {
  return invoke('scan_agents_in_dir', { path });
}

export async function scanSystemAgents(): Promise<number> {
  return invoke('scan_system_agents');
}

export async function launchAgent(id: string): Promise<void> {
  return invoke('launch_agent', { id });
}

export async function openConfigDir(id: string): Promise<void> {
  return invoke('open_config_dir', { id });
}

export async function confirmAgentCandidate(id: string): Promise<void> {
  return invoke('confirm_agent_candidate', { id });
}

export async function ignoreAgentCandidate(id: string): Promise<void> {
  return invoke('ignore_agent_candidate', { id });
}
