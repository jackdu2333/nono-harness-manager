import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useState } from 'react';

// 与 AppShell navGroups 一一对应的稳定 key
export const NAV_ITEM_KEYS = [
  'dashboard',
  'analytics',
  'health',
  'skills',
  'agents',
  'mcp',
  'memory',
  'knowledge',
  'projects',
  'proposals',
] as const;

export type NavItemKey = (typeof NAV_ITEM_KEYS)[number];

// key -> 路由 path 映射
export const NAV_KEY_TO_PATH: Record<NavItemKey, string> = {
  dashboard: '/',
  analytics: '/analytics',
  health: '/health',
  skills: '/skills',
  agents: '/agents',
  mcp: '/mcp',
  memory: '/memory',
  knowledge: '/knowledge',
  projects: '/projects',
  proposals: '/proposals',
};

// path -> key 反查
export const NAV_PATH_TO_KEY: Record<string, NavItemKey> = Object.fromEntries(
  Object.entries(NAV_KEY_TO_PATH).map(([k, v]) => [v, k]),
) as Record<string, NavItemKey>;

export const SETTING_KEY = 'sidebar_visible_nav_items';

// 跨组件同步事件：Settings 保存后通知 AppShell 立即刷新
export const SIDEBAR_NAV_UPDATED_EVENT = 'sidebar-nav-updated';

// 默认显示
export const DEFAULT_VISIBLE: NavItemKey[] = [
  'dashboard',
  'skills',
  'agents',
  'mcp',
  'analytics',
  'health',
];

// 预设模式
export const PRESETS: Record<string, NavItemKey[]> = {
  all: [...NAV_ITEM_KEYS],
  skills_only: ['skills'],
  core: ['skills', 'agents', 'mcp'],
  advanced: [...NAV_ITEM_KEYS],
};

// 跳转优先级：当前页面被隐藏时的首选目标
export const FALLBACK_PRIORITY: NavItemKey[] = [
  'skills',
  'dashboard',
  'agents',
  'mcp',
  'analytics',
  'health',
  'projects',
  'proposals',
  'memory',
  'knowledge',
];

async function loadVisibleNavItems(): Promise<Set<NavItemKey>> {
  try {
    const raw = await invoke<string | null>('get_setting', { key: SETTING_KEY });
    if (!raw) return new Set(DEFAULT_VISIBLE);
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((k): k is NavItemKey =>
      (NAV_ITEM_KEYS as readonly string[]).includes(k),
    );
    return new Set(valid.length > 0 ? valid : DEFAULT_VISIBLE);
  } catch {
    return new Set(DEFAULT_VISIBLE);
  }
}

/// React hook：管理 sidebar 可见性配置
export function useSidebarNav() {
  const [visible, setVisible] = useState<Set<NavItemKey>>(new Set(DEFAULT_VISIBLE));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setVisible(await loadVisibleNavItems());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    // 监听 Settings 保存事件，实现跨组件同步
    const handler = () => refresh();
    window.addEventListener(SIDEBAR_NAV_UPDATED_EVENT, handler);
    return () => window.removeEventListener(SIDEBAR_NAV_UPDATED_EVENT, handler);
  }, [refresh]);

  const save = useCallback(async (items: NavItemKey[]) => {
    await invoke('set_setting', {
      key: SETTING_KEY,
      value: JSON.stringify(items),
    });
    setVisible(new Set(items));
  }, []);

  return { visible, loading, save, refresh };
}
