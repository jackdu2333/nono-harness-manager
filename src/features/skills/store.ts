import { create } from 'zustand';
import { Skill, SkillSource, SkillView } from './types';
import * as api from './api';
import { detectDuplicates } from './utils/duplicateDetector';

interface SkillsState {
  sources: SkillSource[];
  skills: Skill[];
  currentView: SkillView;
  /** Suspected-duplicate assignment from rule-based detector (§七). In-memory only. */
  duplicateAssignment: Record<string, string>;
  duplicateReasons: Record<string, string[]>;
  isLoadingSources: boolean;
  isLoadingSkills: boolean;
  isScanning: boolean;

  fetchSources: () => Promise<void>;
  addSource: (name: string, path: string, sourceType: string | null, scanDepth: number) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  scanSource: (id: string) => Promise<number>;
  fetchSkills: () => Promise<void>;
  generateDescription: (skillId: string) => Promise<string>;
  updateDescription: (skillId: string, description: string) => Promise<void>;
  setView: (view: SkillView) => void;
  // Curation actions (§五) — each refreshes the list for consistency
  setCategory: (skillId: string, category: string | null) => Promise<void>;
  setStatus: (skillId: string, status: string) => Promise<void>;
  toggleFavorite: (skillId: string, value: boolean) => Promise<void>;
  toggleNeedsReview: (skillId: string, value: boolean) => Promise<void>;
  toggleNeedsImprovement: (skillId: string, value: boolean) => Promise<void>;
  archive: (skillId: string, archived: boolean) => Promise<void>;
  deleteIndex: (skillId: string) => Promise<void>;
  updateImprovementNote: (skillId: string, note: string | null, status: string | null) => Promise<void>;
  updateReviewNote: (skillId: string, note: string | null) => Promise<void>;
  markDuplicate: (skillId: string, groupId: string | null) => Promise<void>;
  recordUsage: (skillId: string, action: string) => void;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  sources: [],
  skills: [],
  currentView: 'all',
  duplicateAssignment: {},
  duplicateReasons: {},
  isLoadingSources: false,
  isLoadingSkills: false,
  isScanning: false,

  fetchSources: async () => {
    set({ isLoadingSources: true });
    try {
      const sources = await api.listSkillSources();
      set({ sources });
    } finally {
      set({ isLoadingSources: false });
    }
  },

  addSource: async (name, path, sourceType, scanDepth) => {
    const source = await api.addSkillSource(name, path, sourceType, scanDepth);
    await get().fetchSources();
    if (source && source.id) {
      try {
        await get().scanSource(source.id);
      } catch (scanErr) {
        console.error('Source added but scan failed:', scanErr);
      }
    }
  },

  deleteSource: async (id) => {
    await api.deleteSkillSource(id);
    await get().fetchSources();
  },

  scanSource: async (id) => {
    set({ isScanning: true });
    try {
      const count = await api.scanSkillSource(id);
      await get().fetchSkills();
      return count;
    } catch (err) {
      console.error('Failed to scan skill source:', err);
      throw err;
    } finally {
      set({ isScanning: false });
    }
  },

  fetchSkills: async () => {
    set({ isLoadingSkills: true });
    try {
      const skills = await api.listSkills();
      // Run rule-based duplicate detection (§七) — in-memory, never auto-merges.
      const dup = detectDuplicates(skills);
      set({
        skills,
        duplicateAssignment: dup.assignment,
        duplicateReasons: dup.reasons,
      });
    } finally {
      set({ isLoadingSkills: false });
    }
  },

  generateDescription: async (skillId) => {
    return await api.generateSkillDescription(skillId);
  },

  updateDescription: async (skillId, description) => {
    await api.updateSkillDescription(skillId, description);
    await get().fetchSkills();
  },

  setView: (view) => set({ currentView: view }),

  setCategory: async (skillId, category) => {
    await api.setSkillCategory(skillId, category);
    await get().fetchSkills();
  },
  setStatus: async (skillId, status) => {
    await api.setSkillStatus(skillId, status);
    await get().fetchSkills();
  },
  toggleFavorite: async (skillId, value) => {
    await api.toggleFavorite(skillId, value);
    await get().fetchSkills();
  },
  toggleNeedsReview: async (skillId, value) => {
    await api.toggleNeedsReview(skillId, value);
    await get().fetchSkills();
  },
  toggleNeedsImprovement: async (skillId, value) => {
    await api.toggleNeedsImprovement(skillId, value);
    await get().fetchSkills();
  },
  archive: async (skillId, archived) => {
    await api.archiveSkill(skillId, archived);
    await get().fetchSkills();
  },
  deleteIndex: async (skillId) => {
    await api.deleteSkillIndex(skillId);
    await get().fetchSkills();
  },
  updateImprovementNote: async (skillId, note, status) => {
    await api.updateImprovementNote(skillId, note, status);
    await get().fetchSkills();
  },
  updateReviewNote: async (skillId, note) => {
    await api.updateReviewNote(skillId, note);
    await get().fetchSkills();
  },
  markDuplicate: async (skillId, groupId) => {
    await api.markDuplicate(skillId, groupId);
    await get().fetchSkills();
  },
  recordUsage: (skillId, action) => {
    // Fire-and-forget: panel-operation log for Analytics. §八
    // Pinned to source='harness_panel' on the backend — NOT a Codex count.
    api.recordSkillUsage(skillId, action).catch((e) =>
      console.error('Failed to record skill usage:', e),
    );
  },
}));
