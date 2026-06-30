import { invoke } from '@tauri-apps/api/core';
import { Skill, SkillAnalysisFilters, SkillAnalysisOverview, SkillSource } from './types';

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

export interface DeleteSourceResult {
  deleted_path: string;
  deleted_type: string;
  mode: string;
  index_removed: boolean;
}

/** Delete the local source file/directory and remove the Harness index. 子需求 §四 */
export async function deleteSkillSourceFile(
  skillId: string,
  mode: 'trash' | 'permanent',
): Promise<DeleteSourceResult> {
  return invoke('delete_skill_source_file', { skillId, mode });
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

/**
 * Log a Harness panel action (NOT a Codex invocation). §八
 *
 * §六 标准 action 命名（保持稳定，为 Analytics 统计打基础）：
 *   核心: view_detail | copy_path | open_dir | copy_ref | edit_description |
 *         set_category | set_status | archive | delete_index
 *   标记: toggle_favorite | toggle_needs_review | toggle_needs_improvement |
 *         update_improvement_note | update_review_note
 */
export async function recordSkillUsage(skillId: string, action: string): Promise<void> {
  return invoke('record_skill_usage', { skillId, action });
}

export async function getSkillAnalysisOverview(
  filters?: SkillAnalysisFilters,
): Promise<SkillAnalysisOverview> {
  return invoke('get_skill_analysis_overview', { filters: filters ?? null });
}

export async function createSkillAnalysisProposal(
  skillId: string,
  proposalType:
    | 'skill_metadata_improvement'
    | 'skill_example_improvement'
    | 'skill_boundary_improvement'
    | 'skill_archive_recommendation'
    | 'skill_merge_recommendation'
    | 'skill_agent_binding_recommendation',
  proposedChanges: Record<string, unknown>,
): Promise<unknown> {
  return invoke('create_intelligence_proposal', {
    resourceType: 'skill',
    resourceId: skillId,
    proposalType,
    proposedChanges: JSON.stringify(proposedChanges),
    evidenceFiles: null,
    confidence: 'medium',
    createdBy: 'skills-analysis',
  });
}
