import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle, XCircle, Loader2, Trash2, Zap, Eye, EyeOff } from 'lucide-react';
import {
  NAV_ITEM_KEYS,
  DEFAULT_VISIBLE,
  PRESETS,
  SETTING_KEY,
  SIDEBAR_NAV_UPDATED_EVENT,
  type NavItemKey,
} from "@/features/nav/config";
import {
  getAiSettings,
  setAiSettings as saveAiSettings,
  clearAiApiKey,
  testAiProviderConnection,
  type AiSettingsResponse,
  type TestConnectionResult,
} from '@/features/ai/api';

// nav key -> i18n key（dashboard 走 i18n，其余保持英文品牌名）
const NAV_LABEL_KEYS: Record<NavItemKey, string> = {
  dashboard: 'nav.dashboard',
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
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<Set<NavItemKey>>(new Set(DEFAULT_VISIBLE));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AiSettingsResponse | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai_compatible');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiShowKey, setAiShowKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<TestConnectionResult | null>(null);
  const [aiTesting, setAiTesting] = useState(false);

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
    // Load AI settings
    getAiSettings().then((s) => {
      setAiSettings(s);
      setAiEnabled(s.enabled);
      setAiProvider(s.provider);
      setAiBaseUrl(s.base_url ?? '');
      setAiModel(s.model ?? '');
    }).catch(() => {});
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
      // 通知 AppShell 立即刷新 sidebar
      window.dispatchEvent(new Event(SIDEBAR_NAV_UPDATED_EVENT));
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefault = async () => {
    setSelected(new Set(DEFAULT_VISIBLE));
    setSaving(true);
    try {
      await invoke('set_setting', {
        key: SETTING_KEY,
        value: JSON.stringify([...DEFAULT_VISIBLE]),
      });
      window.dispatchEvent(new Event(SIDEBAR_NAV_UPDATED_EVENT));
    } finally {
      setSaving(false);
    }
  };

  const canSave = selected.size > 0 && !saving;

  // AI Settings handlers
  const handleAiSave = async () => {
    setAiSaving(true);
    try {
      const result = await saveAiSettings({
        enabled: aiEnabled,
        provider: aiProvider,
        base_url: aiBaseUrl || null,
        model: aiModel || null,
        api_key: aiApiKey || null,
      });
      setAiSettings(result);
      setAiApiKey(''); // Clear input after save
      setAiTestResult(null);
    } catch (err) {
      console.error('Failed to save AI settings:', err);
    } finally {
      setAiSaving(false);
    }
  };

  const handleAiTestConnection = async () => {
    if (!aiBaseUrl || !aiApiKey) return;
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const result = await testAiProviderConnection(aiProvider, aiBaseUrl, aiModel, aiApiKey);
      setAiTestResult(result);
    } catch (err) {
      setAiTestResult({ success: false, message: String(err), model_info: null });
    } finally {
      setAiTesting(false);
    }
  };

  const handleClearApiKey = async () => {
    try {
      await clearAiApiKey();
      setAiSettings(prev => prev ? { ...prev, has_api_key: false } : null);
      setAiApiKey('');
    } catch (err) {
      console.error('Failed to clear API key:', err);
    }
  };

  const defaultBaseUrl = aiProvider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com';

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>

          {/* Language */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-foreground">{t('settings.language')}</h3>
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
              <h3 className="text-base font-medium text-foreground">{t('settings.nav_visibility')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.nav_visibility_desc')}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {t('settings.nav_count', { shown: selected.size, total: NAV_ITEM_KEYS.length })}
              </p>
            </div>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2 mb-5">
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.all)}>
                {t('settings.show_all')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.skills_only)}>
                {t('settings.show_skills_only')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.core)}>
                {t('settings.core_mode')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(PRESETS.advanced)}>
                {t('settings.advanced_mode')}
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
                        <span className="text-sm text-foreground">{NAV_LABEL_KEYS[key].includes('.') ? t(NAV_LABEL_KEYS[key]) : NAV_LABEL_KEYS[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Validation message */}
            {selected.size === 0 && (
              <p className="text-sm text-destructive mt-3">{t('settings.keep_one')}</p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={!canSave}>
                {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRestoreDefault} disabled={saving}>
                {t('settings.restore_default')}
              </Button>
            </div>
          </div>

          {/* AI Provider Settings */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="text-base font-medium text-foreground">{t('settings.ai_title')}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">
                  Experimental
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {t('settings.ai_desc')}
              </p>
            </div>

            <div className="space-y-4">
              {/* Enable toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm text-foreground">{t('settings.enable_ai')}</span>
              </label>

              {/* Provider */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('settings.provider')}</label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    setAiProvider(e.target.value);
                    setAiBaseUrl(e.target.value === 'ollama' ? 'http://localhost:11434' : '');
                    setAiTestResult(null);
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="openai_compatible">OpenAI Compatible</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>

              {/* Base URL */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Base URL</label>
                <Input
                  value={aiBaseUrl}
                  onChange={(e) => { setAiBaseUrl(e.target.value); setAiTestResult(null); }}
                  placeholder={defaultBaseUrl}
                  className="text-sm"
                />
              </div>

              {/* Model */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('settings.model')}</label>
                <Input
                  value={aiModel}
                  onChange={(e) => { setAiModel(e.target.value); setAiTestResult(null); }}
                  placeholder={aiProvider === 'ollama' ? 'llama3' : 'gpt-4o-mini'}
                  className="text-sm"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  API Key
                  {aiSettings?.has_api_key && (
                    <span className="ml-2 text-success">{t('settings.api_key_set')}</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={aiShowKey ? 'text' : 'password'}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={aiSettings?.has_api_key ? t('settings.api_key_placeholder_set') : t('settings.api_key_placeholder_unset')}
                      className="text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setAiShowKey(!aiShowKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                    >
                      {aiShowKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {aiSettings?.has_api_key && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearApiKey}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('settings.clear')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Test connection */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiTestConnection}
                  disabled={aiTesting || !aiBaseUrl || !aiApiKey}
                  className="gap-1.5"
                >
                  {aiTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {t('settings.test_connection')}
                </Button>
                {aiTestResult && (
                  <span className={`flex items-center gap-1 text-xs ${aiTestResult.success ? 'text-success' : 'text-destructive'}`}>
                    {aiTestResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {aiTestResult.message}
                  </span>
                )}
              </div>

              {/* Save */}
              <div className="pt-3 border-t border-border">
                <Button onClick={handleAiSave} disabled={aiSaving}>
                  {aiSaving ? t('common.saving') : t('settings.save_ai')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
