import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAnalyticsOverview } from '@/features/local-assets/api';
import type { AnalyticsOverview, UsageMetric } from '@/features/local-assets/types';

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function MetricList({ title, items }: { title: string; items: UsageMetric[] }) {
  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">暂无使用记录。</div>
      ) : (
        items.map(item => (
          <div key={item.key} className="flex items-center justify-between border-b border-border px-4 py-2 text-sm last:border-b-0">
            <span className="text-foreground">{item.key}</span>
            <span className="text-muted-foreground">{item.count}</span>
          </div>
        ))
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setOverview(await getAnalyticsOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const counts = overview?.resource_counts ?? {};

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">基于本地 usage events 的资源使用统计。</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="mb-5 grid grid-cols-6 gap-3">
        {['agents', 'skills', 'mcp_servers', 'memory_sources', 'knowledge_bases', 'projects'].map(key => (
          <div key={key} className="border border-border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">{key}</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{counts[key] ?? 0}</div>
          </div>
        ))}
      </section>

      <div className="mb-5 grid grid-cols-2 gap-5">
        <MetricList title="按资源类型" items={overview?.usage_by_resource_type ?? []} />
        <MetricList title="按操作类型" items={overview?.usage_by_action ?? []} />
      </div>

      <section className="border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">最近事件</h2>
        </div>
        {!overview || overview.recent_events.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">暂无 usage events。</div>
        ) : (
          overview.recent_events.map((event, index) => (
            <div key={`${event.resource_type}-${event.resource_id}-${event.created_at}-${index}`} className="grid grid-cols-[120px_1fr_180px_180px] gap-4 border-b border-border px-4 py-2 text-sm last:border-b-0">
              <div className="text-muted-foreground">{event.resource_type}</div>
              <div className="truncate text-foreground">{event.action}</div>
              <div className="text-muted-foreground">{event.source ?? 'unknown'}</div>
              <div className="text-muted-foreground">{formatTime(event.created_at)}</div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
