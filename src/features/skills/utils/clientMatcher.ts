import { Skill } from '../types';

/**
 * Determine which client/agent a skill is compatible with based on its source name or path.
 * Heuristics matching:
 * - name/path contains 'codex' -> Codex
 * - name/path contains 'claude' -> Claude Code
 * - name/path contains 'workbuddy' -> WorkBuddy
 * - otherwise -> 通用 (Generic)
 */
export function getCompatibleClient(skill: Skill, sourceName: string): string {
  const name = (sourceName || '').toLowerCase();
  const path = (skill.path || '').toLowerCase();
  if (name.includes('codex') || path.includes('.codex')) return 'Codex';
  if (name.includes('claude') || path.includes('.claude')) return 'Claude Code';
  if (name.includes('workbuddy') || path.includes('workbuddy')) return 'WorkBuddy';
  return '通用';
}

/**
 * Map skill source names to English friendly display names: Codex, Claude Code, Generic, WorkBuddy.
 */
export function getFriendlySourceName(name: string): string {
  const lowercaseName = name.toLowerCase();
  if (lowercaseName.includes('codex')) return 'Codex';
  if (lowercaseName.includes('claude')) return 'Claude Code';
  if (lowercaseName.includes('workbuddy')) return 'WorkBuddy';
  if (lowercaseName.includes('default') || lowercaseName.includes('newmax')) return 'Generic';
  return name; // fallback
}
