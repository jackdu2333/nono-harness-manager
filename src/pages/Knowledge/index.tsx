import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addKnowledgeBase,
  listKnowledgeBases,
  listKnowledgeFiles,
  openLocalPath,
} from '@/features/local-assets/api';
import type { AssetOverview, FileListResult } from '@/features/local-assets/types';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function KnowledgePage() {
  const { t } = useTranslation();
  const formatTime = (value?: string | null) => {
    return value ? new Date(value).toLocaleString() : t('common.not_recorded');
  };
  const [bases, setBases] = useState<AssetOverview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileListResult | null>(null);
  const [name, setName] = useState('');
  const [path, setPath] = useState('/Users/jackdu/流程运营/个人知识库');
  const [kbType, setKbType] = useState('obsidian');
  const [scope, setScope] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => bases.find(base => base.id === selectedId) ?? null,
    [bases, selectedId],
  );

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextBases = await listKnowledgeBases();
      setBases(nextBases);
      const nextSelected = selectedId ?? nextBases[0]?.id ?? null;
      setSelectedId(nextSelected);
      setFiles(nextSelected ? await listKnowledgeFiles(nextSelected) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const addBase = async () => {
    if (!path.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const finalName = name.trim() || path.split('/').filter(Boolean).pop() || 'Knowledge Base';
      const created = await addKnowledgeBase(finalName, path.trim(), kbType || null, scope || null, null);
      setName('');
      const nextBases = await listKnowledgeBases();
      setBases(nextBases);
      setSelectedId(created.id);
      setFiles(await listKnowledgeFiles(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const selectBase = async (id: string) => {
    setSelectedId(id);
    setError(null);
    try {
      setFiles(await listKnowledgeFiles(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Knowledge</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('knowledge.description')}</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="mb-5 grid grid-cols-[1fr_1.4fr] gap-3">
        <Input value={name} onChange={event => setName(event.target.value)} placeholder={t('knowledge.name_placeholder')} />
        <div className="flex gap-2">
          <Input value={path} onChange={event => setPath(event.target.value)} placeholder={t('knowledge.path_placeholder')} />
          <select
            value={kbType}
            onChange={event => setKbType(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="obsidian">Obsidian</option>
            <option value="vk">VK</option>
            <option value="ima_index">{t('knowledge.type_ima')}</option>
            <option value="project_docs">{t('knowledge.type_project_doc')}</option>
          </select>
          <select
            value={scope}
            onChange={event => setScope(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="general">{t('knowledge.cat_general')}</option>
            <option value="project">{t('knowledge.cat_project')}</option>
          </select>
          <Button onClick={addBase} disabled={isLoading || !path.trim()}>{t('common.add')}</Button>
        </div>
      </section>

      <div className="grid grid-cols-[360px_1fr] gap-5">
        <section className="min-h-[520px] border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t('knowledge.list_title')}</div>
          {bases.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{t('knowledge.no_dirs')}</div>
          ) : (
            bases.map(base => (
              <button
                key={base.id}
                onClick={() => selectBase(base.id)}
                className={`block w-full border-b border-border px-4 py-3 text-left last:border-b-0 ${
                  selectedId === base.id ? 'bg-accent' : 'hover:bg-muted/60'
                }`}
              >
                <div className="truncate text-sm font-medium text-foreground">{base.name}</div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{base.path}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {base.asset_type ?? t('common.uncategorized')} · {base.scope ?? '未标记'} · {base.file_count} {t('knowledge.doc_unit')}
                </div>
              </button>
            ))
          )}
        </section>

        <section className="min-h-[520px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-foreground">{selected?.name ?? t('knowledge.doc_list')}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selected ? t('knowledge.summary', { count: selected.file_count, size: formatBytes(selected.total_size_bytes), time: formatTime(selected.last_modified_at) }) : t('knowledge.select_hint')}
              </div>
            </div>
            {selected?.path && (
              <Button variant="outline" size="sm" onClick={() => openLocalPath(selected.path!)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Finder
              </Button>
            )}
          </div>
          {!files ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{t('knowledge.select_hint_desc')}</div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              {files.files.map(file => (
                <div key={file.path} className="grid grid-cols-[1fr_100px_150px] gap-4 border-b border-border px-4 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{file.relative_path}</div>
                    <div className="text-xs text-muted-foreground">{file.category}</div>
                  </div>
                  <div className="text-muted-foreground">{formatBytes(file.size_bytes)}</div>
                  <div className="text-muted-foreground">{formatTime(file.modified_at)}</div>
                </div>
              ))}
              {files.truncated && (
                <div className="px-4 py-3 text-xs text-muted-foreground">{t('common.showing_first_500')}</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
