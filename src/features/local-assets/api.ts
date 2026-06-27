import { invoke } from '@tauri-apps/api/core';
import type {
  AnalyticsOverview,
  AssetOverview,
  FileListResult,
  HealthReport,
  ProjectBinding,
} from './types';
import type { ScanStatus } from './types';

export async function listMemorySources(): Promise<AssetOverview[]> {
  return invoke('list_memory_sources');
}

export async function addMemorySource(
  name: string,
  path: string,
  memoryType: string | null,
  projectId: string | null,
): Promise<AssetOverview> {
  return invoke('add_memory_source', { name, path, memoryType, projectId });
}

export async function listMemoryFiles(sourceId: string): Promise<FileListResult> {
  return invoke('list_memory_files', { sourceId });
}

export async function runMemoryHealthCheck(): Promise<HealthReport> {
  return invoke('run_memory_health_check');
}

export async function listKnowledgeBases(): Promise<AssetOverview[]> {
  return invoke('list_knowledge_bases');
}

export async function addKnowledgeBase(
  name: string,
  path: string,
  kbType: string | null,
  scope: string | null,
  projectId: string | null,
): Promise<AssetOverview> {
  return invoke('add_knowledge_base', { name, path, kbType, scope, projectId });
}

export async function listKnowledgeFiles(kbId: string): Promise<FileListResult> {
  return invoke('list_knowledge_files', { kbId });
}

export async function listProjects(): Promise<AssetOverview[]> {
  return invoke('list_projects');
}

export async function addProject(
  name: string,
  path: string | null,
  description: string | null,
): Promise<AssetOverview> {
  return invoke('add_project', { name, path, description });
}

export async function bindProjectResource(
  projectId: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  return invoke('bind_project_resource', { projectId, resourceType, resourceId });
}

export async function listProjectBindings(projectId: string): Promise<ProjectBinding[]> {
  return invoke('list_project_bindings', { projectId });
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return invoke('get_analytics_overview');
}

export async function triggerAgentLogScan(): Promise<ScanStatus> {
  return invoke('trigger_agent_log_scan');
}

export async function runGlobalHealthCheck(): Promise<HealthReport> {
  return invoke('run_global_health_check');
}

export async function openLocalPath(path: string): Promise<void> {
  return invoke('open_local_path', { path });
}
