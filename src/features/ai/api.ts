import { invoke } from '@tauri-apps/api/core';

export interface AiSettingsResponse {
  enabled: boolean;
  provider: string;
  base_url: string | null;
  model: string | null;
  has_api_key: boolean;
  updated_at: string;
}

export interface AiSettingsInput {
  enabled?: boolean;
  provider?: string;
  base_url?: string | null;
  model?: string | null;
  api_key?: string | null;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  model_info: string | null;
}

export async function getAiSettings(): Promise<AiSettingsResponse> {
  return invoke('get_ai_settings');
}

export async function setAiSettings(input: AiSettingsInput): Promise<AiSettingsResponse> {
  return invoke('set_ai_settings', { input });
}

export async function clearAiApiKey(): Promise<void> {
  return invoke('clear_ai_api_key');
}

export async function testAiProviderConnection(
  provider: string,
  baseUrl: string,
  model: string,
  apiKey: string,
): Promise<TestConnectionResult> {
  return invoke('test_ai_provider_connection', { provider, baseUrl, model, apiKey });
}

// ── AI Tasks (Phase 3) ──

export interface AiTask {
  id: string;
  task_type: string;
  status: string;
  input_json: string | null;
  result_json: string | null;
  error: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface CreateAiTaskInput {
  task_type: string;
  result_json: string;
  created_by?: string;
}

export async function createAiTask(input: CreateAiTaskInput): Promise<AiTask> {
  return invoke('create_ai_task', { input });
}

export async function listAiTasks(limit?: number): Promise<AiTask[]> {
  return invoke('list_ai_tasks', { limit: limit ?? 20 });
}

// ── AI Chat (Phase 5) ──

export interface ChatSession {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls_json: string | null;
  created_at: string;
}

export interface ChatResponse {
  message: ChatMessage;
  evidence: string[];
  suggested_actions: string[];
}

export async function createChatSession(): Promise<ChatSession> {
  return invoke('create_chat_session');
}

export async function listChatSessions(): Promise<ChatSession[]> {
  return invoke('list_chat_sessions');
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return invoke('get_chat_messages', { sessionId });
}

export async function sendChatMessage(
  content: string,
  sessionId?: string,
): Promise<ChatResponse> {
  return invoke('send_chat_message', {
    input: { session_id: sessionId ?? null, content },
  });
}
