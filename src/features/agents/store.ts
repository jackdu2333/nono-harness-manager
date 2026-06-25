import { create } from 'zustand';
import { Agent } from './types';
import * as api from './api';
import { arrayMove } from '@dnd-kit/sortable';

const SORT_KEY = 'agents_sort_order';

interface AgentsState {
  agents: Agent[];
  isLoading: boolean;
  isScanning: boolean;
  
  fetchAgents: () => Promise<void>;
  addAgent: (name: string, type: string | null, appPath: string | null, configPath: string | null, defaultWorkspace: string | null) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  scanAgents: (path: string) => Promise<number>;
  scanSystemAgents: () => Promise<number>;
  launchAgent: (id: string) => Promise<void>;
  openConfigDir: (id: string) => Promise<void>;
  reorderAgents: (activeId: string, overId: string) => void;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  isLoading: false,
  isScanning: false,

  fetchAgents: async () => {
    set({ isLoading: true });
    try {
      const rawAgents = await api.listAgents();
     
      // Load custom sort order
      let savedOrder: string[] = [];
      try {
        const stored = localStorage.getItem(SORT_KEY);
        if (stored) savedOrder = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to load sort order', e);
      }

      // Sort logic
      const agents = [...rawAgents].sort((a, b) => {
        const indexA = savedOrder.indexOf(a.id);
        const indexB = savedOrder.indexOf(b.id);
        
        // Both exist in saved order
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // Only A exists (A comes first)
        if (indexA !== -1) return -1;
        // Only B exists (B comes first)
        if (indexB !== -1) return 1;
        // Neither exist, keep original (backend) order
        return 0;
      });

      set({ agents });
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  reorderAgents: (activeId: string, overId: string) => {
    const { agents } = get();
    const oldIndex = agents.findIndex(a => a.id === activeId);
    const newIndex = agents.findIndex(a => a.id === overId);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newAgents = arrayMove(agents, oldIndex, newIndex);
      
      // Save new order
      const newOrder = newAgents.map(a => a.id);
      localStorage.setItem(SORT_KEY, JSON.stringify(newOrder));
      
      set({ agents: newAgents });
    }
  },

  addAgent: async (name, type, appPath, configPath, defaultWorkspace) => {
    await api.addAgent(name, type, appPath, configPath, defaultWorkspace);
    await get().fetchAgents();
  },

  deleteAgent: async (id) => {
    await api.deleteAgent(id);
    await get().fetchAgents();
  },

  scanAgents: async (path) => {
    set({ isScanning: true });
    try {
      const count = await api.scanAgentsInDir(path);
      await get().fetchAgents();
      return count;
    } catch (err) {
      console.error('Failed to scan agents:', err);
      throw err;
    } finally {
      set({ isScanning: false });
    }
  },

  scanSystemAgents: async () => {
    set({ isScanning: true });
    try {
      const count = await api.scanSystemAgents();
      await get().fetchAgents();
      return count;
    } catch (err) {
      console.error('Failed to scan system agents:', err);
      throw err;
    } finally {
      set({ isScanning: false });
    }
  },

  launchAgent: async (id) => {
    try {
      await api.launchAgent(id);
      await get().fetchAgents();
    } catch (err) {
      console.error('Failed to launch agent:', err);
      throw err;
    }
  },

  openConfigDir: async (id) => {
    try {
      await api.openConfigDir(id);
    } catch (err) {
      console.error('Failed to open config dir:', err);
      throw err;
    }
  }
}));
