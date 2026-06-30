import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, HeartPulse, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addMemorySource,
  listMemoryFiles,
  listMemorySources,
  openLocalPath,
  runMemoryHealthCheck,
} from '@/features/local-assets/api';
import type { AssetOverview, FileListResult, HealthReport } from '@/features/local-assets/types';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function MemoryPage() {
  const { t } = useTranslation();
  const formatTime = (value?: string | null) => {
    return value ? new Date(value).toLocaleString() : t('common.not_recorded');
  };
  const [sources, setSources] = useState<AssetOverview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileListResult | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [name, setName] = useState('');
  const [path, setPath] = useState('/Users/jackdu/memorydu');
  const [memoryType, setMemoryType] = useState('long_term');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => sources.find(source => source.id === selectedId) ?? null,
    [sources, selectedId],
  );

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextSources = await listMemorySources();
      setSources(nextSources);
      const nextSelected = selectedId ?? nextSources[0]?.id ?? null;
      setSelectedId(nextSelected);
      if (nextSelected) {
        setFiles(await listMemoryFiles(nextSelected));
      } else {
        setFiles(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const addSource = async () => {
    if (!path.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const finalName = name.trim() || path.split('/').filter(Boolean).pop() || 'Memory Source';
      const created = await addMemorySource(finalName, path.trim(), memoryType || null, null);
      setName('');
      const nextSources = await listMemorySources();
      setSources(nextSources);
      setSelectedId(created.id);
      setFiles(await listMemoryFiles(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const selectSource = async (id: string) => {
    setSelectedId(id);
    setError(null);
    try {
      setFiles(await listMemoryFiles(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const runHealth = async () => {
    setError(null);
    try {
      setHealth(await runMemoryHealthCheck());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Memory</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('memory.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.refresh')}
          </Button>
          <Button variant="outline" onClick={runHealth}>
            <HeartPulse className="mr-2 h-4 w-4" />
            {t('memory.health_check')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="mb-5 grid grid-cols-[1fr_1.4fr] gap-3">
        <Input value={name} onChange={event => setName(event.target.value)} placeholder={t('memory.name_placeholder')} />
        <div className="flex gap-2">
          <Input value={path} onChange={event => setPath(event.target.value)} placeholder={t('memory.path_placeholder')} />
          <select
            value={memoryType}
            onChange={event => setMemoryType(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="long_term">{t('memory.type_long_term')}</option>
            <option value="project">{t('memory.type_project')}</option>
            <option value="temporary">{t('memory.type_temp')}</option>
            <option value="archive">{t('memory.type_archive')}</option>
          </select>
          <Button onClick={addSource} disabled={isLoading || !path.trim()}>{t('common.add')}</Button>
        </div>
      </section>

      <div className="grid grid-cols-[360px_1fr] gap-5">
        <section className="min-h-[520px] border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t('memory.root_dir')}</div>
          {sources.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{t('memory.no_dirs')}</div>
          ) : (
            sources.map(source => (
              <button
                key={source.id}
                onClick={() => selectSource(source.id)}
                className={`block w-full border-b border-border px-4 py-3 text-left last:border-b-0 ${
                  selectedId === source.id ? 'bg-accent' : 'hover:bg-muted/60'
                }`}
              >
                <div className="truncate text-sm font-medium text-foreground">{source.name}</div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{source.path}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {source.file_count} {t('common.files_unit')} · {formatBytes(source.total_size_bytes)}
                </div>
              </button>
            ))
          )}
        </section>

        <section className="min-h-[520px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-foreground">{selected?.name ?? t('memory.file_list')}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t('memory.last_modified', { time: formatTime(selected?.last_modified_at) })}
              </div>
            </div>
            {selected?.path && (
              <Button variant="outline" size="sm" onClick={() => openLocalPath(selected.path!)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Finder
              </Button>
            )}
          </div>

          {health && (
            <div className="border-b border-border px-4 py-3 text-sm">
              <span className="font-medium">Memory Health Score：{health.score}</span>
              <span className="ml-3 text-muted-foreground">{t('memory.issues_count', { count: health.issues.length })}</span>
            </div>
          )}

          {!files ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{t('memory.select_hint')}</div>
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
