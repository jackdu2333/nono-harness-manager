import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, HeartPulse, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runGlobalHealthCheck } from '@/features/local-assets/api';
import type { HealthIssue, HealthReport } from '@/features/local-assets/types';

const severityClass: Record<string, string> = {
  critical: 'text-red-600 bg-red-500/10 border-red-500/30',
  error: 'text-orange-600 bg-orange-500/10 border-orange-500/30',
  warning: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
  info: 'text-sky-600 bg-sky-500/10 border-sky-500/30',
};

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function countSeverity(issues: HealthIssue[], severity: string) {
  return issues.filter(issue => issue.severity === severity).length;
}

export default function HealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIssue = useMemo(
    () => report?.issues[selectedIndex] ?? null,
    [report, selectedIndex],
  );

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextReport = await runGlobalHealthCheck();
      setReport(nextReport);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Health Check</h1>
          <p className="mt-1 text-sm text-muted-foreground">本地资源路径、状态和索引一致性的全局体检。</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          运行体检
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="mb-5 grid grid-cols-[220px_repeat(4,1fr)] gap-3">
        <div className="border border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartPulse className="h-4 w-4" />
            Health Score
          </div>
          <div className="mt-3 text-4xl font-semibold text-foreground">{report?.score ?? '-'}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {report ? formatTime(report.generated_at) : '尚未生成'}
          </div>
        </div>
        {['critical', 'error', 'warning', 'info'].map(severity => (
          <div key={severity} className="border border-border bg-card px-4 py-4">
            <div className="text-sm text-muted-foreground">{severity}</div>
            <div className="mt-3 text-3xl font-semibold text-foreground">
              {report ? countSeverity(report.issues, severity) : 0}
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-[420px_1fr] gap-5">
        <section className="min-h-[520px] border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">问题列表</h2>
          </div>
          {!report || report.issues.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">未发现需要处理的问题。</div>
          ) : (
            report.issues.map((issue, index) => (
              <button
                key={`${issue.source}-${issue.title}-${index}`}
                onClick={() => setSelectedIndex(index)}
                className={`block w-full border-b border-border px-4 py-3 text-left last:border-b-0 ${
                  selectedIndex === index ? 'bg-accent' : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs ${severityClass[issue.severity] ?? severityClass.info}`}>
                    {issue.severity}
                  </span>
                  <span className="text-xs text-muted-foreground">{issue.source}</span>
                </div>
                <div className="mt-2 truncate text-sm font-medium text-foreground">{issue.title}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {issue.resource_name ?? issue.resource_path ?? '全局'}
                </div>
              </button>
            ))
          )}
        </section>

        <section className="min-h-[520px] border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">问题详情</div>
          {!selectedIssue ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">选择问题查看证据和建议。</div>
          ) : (
            <div className="space-y-5 p-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Overview</div>
                <div className="mt-1 text-base font-medium text-foreground">{selectedIssue.title}</div>
                <p className="mt-2 text-muted-foreground">{selectedIssue.description}</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Evidence</div>
                <div className="mt-1 rounded border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
                  {selectedIssue.resource_path ?? selectedIssue.resource_name ?? selectedIssue.source}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fix Suggestion</div>
                <p className="mt-1 text-foreground">{selectedIssue.suggestion}</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <p className="mt-1 text-foreground">{selectedIssue.status}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
