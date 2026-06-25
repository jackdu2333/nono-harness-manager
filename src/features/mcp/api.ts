import { invoke } from '@tauri-apps/api/core';
import { McpServer } from './types';

export async function listMcpServers(): Promise<McpServer[]> {
  return invoke('list_mcp_servers');
}

export async function addMcpServer(server: McpServer): Promise<void> {
  return invoke('add_mcp_server', { server });
}

export async function deleteMcpServer(id: string): Promise<void> {
  return invoke('delete_mcp_server', { id });
}

export async function scanMcpDir(path: string): Promise<number> {
  return invoke('scan_mcp_dir', { path });
}

export async function discoverSystemMcp(): Promise<number> {
  return invoke('discover_system_mcp');
}
