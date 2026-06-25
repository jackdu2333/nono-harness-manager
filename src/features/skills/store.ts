import { create } from 'zustand';
import { Skill, SkillSource } from './types';
import * as api from './api';

interface SkillsState {
  sources: SkillSource[];
  skills: Skill[];
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
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  sources: [],
  skills: [],
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
      await get().scanSource(source.id);
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
    } finally {
      set({ isScanning: false });
    }
  },

  fetchSkills: async () => {
    set({ isLoadingSkills: true });
    try {
      const skills = await api.listSkills();
      set({ skills });
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
  }
}));
