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

// ===== Curation & lifecycle API (migration 0007) =====

export async function setSkillCategory(skillId: string, category: string | null): Promise<void> {
  return invoke('set_skill_category', { skillId, category });
}

export async function setSkillStatus(skillId: string, status: string): Promise<void> {
  return invoke('set_skill_status', { skillId, status });
}

export async function toggleFavorite(skillId: string, value: boolean): Promise<void> {
  return invoke('toggle_favorite', { skillId, value });
}

export async function toggleNeedsReview(skillId: string, value: boolean): Promise<void> {
  return invoke('toggle_needs_review', { skillId, value });
}

export async function toggleNeedsImprovement(skillId: string, value: boolean): Promise<void> {
  return invoke('toggle_needs_improvement', { skillId, value });
}

export async function archiveSkill(skillId: string, archived: boolean): Promise<void> {
  return invoke('archive_skill', { skillId, archived });
}

/** Remove from Harness index only — never deletes the local file. §五 / 验收7 */
export async function deleteSkillIndex(skillId: string): Promise<void> {
  return invoke('delete_skill_index', { skillId });
}

export async function updateImprovementNote(
  skillId: string,
  note: string | null,
  status: string | null,
): Promise<void> {
  return invoke('update_improvement_note', { skillId, note, status });
}

export async function updateReviewNote(skillId: string, note: string | null): Promise<void> {
  return invoke('update_review_note', { skillId, note });
}

export async function markDuplicate(skillId: string, groupId: string | null): Promise<void> {
  return invoke('mark_duplicate', { skillId, groupId });
}

/** Log a Harness panel action (NOT a Codex invocation). §八 */
export async function recordSkillUsage(skillId: string, action: string): Promise<void> {
  return invoke('record_skill_usage', { skillId, action });
}
