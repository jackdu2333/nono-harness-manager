import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { invoke } from '@tauri-apps/api/core';
import {
  NAV_ITEM_KEYS,
  DEFAULT_VISIBLE,
  PRESETS,
  SETTING_KEY,
  type NavItemKey,
} from "@/features/nav/config";

// nav key -> 显示标签
const NAV_LABELS: Record<NavItemKey, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  health: 'Health Check',
  skills: 'Skills',
  agents: 'Agents',
  mcp: 'MCP',
  memory: 'Memory',
  knowledge: 'Knowledge',
  projects: 'Projects',
  proposals: 'Proposals',
};

// 分组定义，和 AppShell 一致
const NAV_GROUPS: { label: string; keys: NavItemKey[] }[] = [
  { label: 'Overview', keys: ['dashboard', 'analytics', 'health'] },
  { label: 'Assets', keys: ['skills', 'agents', 'mcp', 'memory', 'knowledge'] },
  { label: 'Work', keys: ['projects', 'proposals'] },
];

export default function SettingsPage() {
  const { i18n } = useTranslation();
  const [selected, setSelected] = useState<Set<NavItemKey>>(new Set(DEFAULT_VISIBLE));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const raw = await invoke<string | null>('get_setting', { key: SETTING_KEY });
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const valid = parsed.filter((k): k is NavItemKey =>
          (NAV_ITEM_KEYS as readonly string[]).includes(k),
        );
        if (valid.length > 0) {
          setSelected(new Set(valid));
        }
      }
    } catch {
      // fallback to default
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('app_language', newLang);
  };

  const toggleItem = (key: NavItemKey) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelected(next);
  };

  const applyPreset = (preset: NavItemKey[]) => {
    setSelected(new Set(preset));
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await invoke('set_setting', {
        key: SETTING_KEY,
        value: JSON.stringify([...selected]),
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave = selected.size > 0 && !saving;

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>

          {/* Language */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-foreground">Language / 语言</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your preferred interface language
                </p>
              </div>
              <Button variant="outline" onClick={toggleLanguage} className="bg-background border-border text-foreground hover:bg-accent">
                {i18n.language === 'en' ? 'English (EN)' : '中文 (ZH)'}
              </Button>
            </div>
          </div>

          {/* Navigation visibility */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-base font-medium text-foreground">侧边栏菜单显示</h3>
              <p className="text-sm text-muted-foreground mt-1">
                选择左侧导航栏中要显示的页面。隐藏页面不会删除数据，也不会禁用功能，只是不在左侧菜单中显示。
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                已显示 {selected.size} / {NAV_ITEM_KEYS.length} 个页面（Settings 永远显示）
              </p>
            </div>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2 mb-5">
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.all)}>
                全部显示
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.skills_only)}>
                只显示 Skills
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.core)}>
                核心资产模式
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.advanced)}>
                高级模式
              </Button>
            </div>

            {/* Grouped checkboxes */}
            <div className="space-y-4">
              {NAV_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.keys.map(key => (
                      <label
                        key={key}
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent/30 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleItem(key)}
                          disabled={loading}
                          className="w-4 h-4 rounded border-border"
                        />
                        <span className="text-sm text-foreground">{NAV_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Validation message */}
            {selected.size === 0 && (
              <p className="text-sm text-destructive mt-3">至少保留一个页面入口。</p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={!canSave}>
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(DEFAULT_VISIBLE))}>
                恢复默认
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}