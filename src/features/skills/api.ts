import { invoke } from '@tauri-apps/api/core';
import { Skill, SkillSource } from './types';

export async function listSkillSources(): Promise<SkillSource[]> {
  return invoke('list_skill_sources');
}

export async function addSkillSource(name: string, path: string, source_type: string | null, scan_depth: number): Promise<SkillSource> {
  return invoke('add_skill_source', { name, path, sourceType: source_type, scanDepth: scan_depth });
}

export async function deleteSkillSource(id: string): Promise<void> {
  return invoke('delete_skill_source', { id });
}

export async function scanSkillSource(id: string): Promise<number> {
  return invoke('scan_skill_source', { id });
}

export async function listSkills(): Promise<Skill[]> {
  return invoke('list_skills');
}

export async function generateSkillDescription(skillId: string): Promise<string> {
  return invoke('generate_skill_description', { skillId });
}

export async function updateSkillDescription(skillId: string, description: string): Promise<void> {
  return invoke('update_skill_description', { skillId, description });
}
