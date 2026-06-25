import { create } from 'zustand';
import { McpServer } from './types';
import * as api from './api';

interface McpState {
  servers: McpServer[];
  isLoading: boolean;
  isScanning: boolean;
  
  fetchServers: () => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  scanDir: (path: string) => Promise<number>;
  discoverSystem: () => Promise<number>;
}

export const useMcpStore = create<McpState>((set, get) => ({
  servers: [],
  isLoading: false,
  isScanning: false,

  fetchServers: async () => {
    set({ isLoading: true });
    try {
      const servers = await api.listMcpServers();
      set({ servers, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch MCP servers:', error);
      set({ isLoading: false });
    }
  },

  deleteServer: async (id: string) => {
    try {
      await api.deleteMcpServer(id);
      await get().fetchServers();
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    }
  },

  scanDir: async (path: string) => {
    set({ isScanning: true });
    try {
      const count = await api.scanMcpDir(path);
      await get().fetchServers();
      return count;
    } catch (error) {
      console.error('Failed to scan MCP dir:', error);
      return 0;
    } finally {
      set({ isScanning: false });
    }
  },

  discoverSystem: async () => {
    set({ isScanning: true });
    try {
      const count = await api.discoverSystemMcp();
      await get().fetchServers();
      return count;
    } catch (error) {
      console.error('Failed to discover system MCP:', error);
      return 0;
    } finally {
      set({ isScanning: false });
    }
  }
}));
