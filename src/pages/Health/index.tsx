import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, HeartPulse, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runGlobalHealthCheck } from '@/features/local-assets/api';
import type { HealthIssue, HealthReport } from '@/features/local-assets/types';

const severityClass: Record<string, string> = {
  critical: 'text-destructive bg-destructive/10 border-destructive/30',
  error: 'text-warning bg-warning/10 border-warning/30',
  warning: 'text-warning bg-warning/10 border-warning/30',
  info: 'text-info bg-info/10 border-info/30',
};

const statusClass: Record<string, string> = {
  healthy: 'text-success',
  good: 'text-success',
  needs_attention: 'text-warning',
  degraded: 'text-warning',
  critical: 'text-destructive',
  not_ready: 'text-muted-foreground',
};

const severityFilterOptions = ['all', 'critical', 'error', 'warning', 'info'] as const;
const sourceFilterOptions = ['all', 'Agent', 'Skill', 'MCP', 'Memory', 'Knowledge', 'Project', 'Index', 'Proposal', 'Analytics', 'System'] as const;

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function countSeverity(issues: HealthIssue[], severity: string) {
  return issues.filter(issue => issue.severity === severity).length;
}

export default function HealthPage() {
  const { t } = useTranslation();
  const statusLabel: Record<string, string> = {
    healthy: t('health.status_healthy'),
    good: t('health.status_good'),
    needs_attention: t('health.status_needs_attention'),
    degraded: t('health.status_degraded'),
    critical: t('health.status_critical'),
    not_ready: t('health.status_not_ready'),
  };
  const [report, setReport] = useState<HealthReport | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

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

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    return report.issues.filter(issue => {
      if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
      if (sourceFilter !== 'all' && issue.source !== sourceFilter) return false;
      return true;
    });
  }, [report, severityFilter, sourceFilter]);

  const selectedIssue = useMemo(
    () => filteredIssues[selectedIndex] ?? null,
    [filteredIssues, selectedIndex],
  );

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Health Check</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('health.description')}</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('health.run_check')}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Score + Status + severity counts */}
      <section className="mb-5 grid grid-cols-[220px_180px_repeat(4,1fr)] gap-3">
        <div className="border border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartPulse className="h-4 w-4" />
            Health Score
          </div>
          <div className="mt-3 text-4xl font-semibold text-foreground">{report?.score ?? '-'}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {report ? formatTime(report.generated_at) : t('health.not_generated')}
          </div>
        </div>
        <div className="border border-border bg-card px-4 py-4">
          <div className="text-sm text-muted-foreground">Status</div>
          <div className={`mt-3 text-xl font-medium ${report?.status ? statusClass[report.status] ?? '' : ''}`}>
            {report?.status ? statusLabel[report.status] ?? report.status : '-'}
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

      {/* Module scores */}
      {report?.summary?.module_scores && report.summary.module_scores.length > 0 && (
        <section className="mb-5 border border-border bg-card px-4 py-4">
          <div className="mb-3 text-sm font-medium text-foreground">Module Scores</div>
          <div className="grid grid-cols-6 gap-3">
            {report.summary.module_scores.map(ms => (
              <div key={ms.module} className="border border-border bg-muted/30 px-3 py-2">
                <div className="text-xs text-muted-foreground">{ms.label}</div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  {Math.round(ms.score)}
                  <span className="text-sm text-muted-foreground">/{ms.weight}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  -{ms.penalty.toFixed(1)} penalty
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Checked resources + Score explanation */}
      {report?.summary && (
        <section className="mb-5 grid grid-cols-2 gap-3">
          <div className="border border-border bg-card px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Checked Resources
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {report.summary.checked_resources}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {report.summary.checked_categories.map(cat => (
                <span key={cat} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {cat}
                </span>
              ))}
            </div>
          </div>
          <div className="border border-border bg-card px-4 py-4">
            <div className="text-sm font-medium text-foreground">Score Explanation</div>
            <div className="mt-2 space-y-1">
              {report.summary.score_explanation.map((line, i) => (
                <div key={i} className="font-mono text-xs text-muted-foreground">{line}</div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="mb-3 flex items-center gap-3">
        <select
          value={severityFilter}
          onChange={e => { setSeverityFilter(e.target.value); setSelectedIndex(0); }}
          className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          {severityFilterOptions.map(opt => (
            <option key={opt} value={opt}>{opt === 'all' ? t('health.filter_all_severity') : opt}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value); setSelectedIndex(0); }}
          className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          {sourceFilterOptions.map(opt => (
            <option key={opt} value={opt}>{opt === 'all' ? t('health.filter_all_source') : opt}</option>
          ))}
        </select>
        {filteredIssues.length !== (report?.issues.length ?? 0) && (
          <span className="text-xs text-muted-foreground">
            {filteredIssues.length} / {report?.issues.length ?? 0} {t('common.count_unit')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[420px_1fr] gap-5">
        {/* Issue list */}
        <section className="min-h-[520px] border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('health.issue_list')}</h2>
          </div>
          {!report || filteredIssues.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {report && report.issues.length === 0
                ? t('health.no_issues', { resources: report.summary?.checked_resources ?? 0, categories: report.summary?.checked_categories.join(' / ') ?? 'N/A' })
                : t('health.no_match_issues')}
            </div>
          ) : (
            filteredIssues.map((issue, index) => (
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
                  {issue.category && (
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground">
                      {issue.category}
                    </span>
                  )}
                </div>
                <div className="mt-2 truncate text-sm font-medium text-foreground">{issue.title}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {issue.resource_name ?? issue.resource_path ?? '全局'}
                </div>
              </button>
            ))
          )}
        </section>

        {/* Issue detail */}
        <section className="min-h-[520px] border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{t('health.issue_detail')}</div>
          {!selectedIssue ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{t('health.issue_detail_hint')}</div>
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
                  {selectedIssue.evidence
                    ?? selectedIssue.resource_path
                    ?? selectedIssue.resource_name
                    ?? selectedIssue.source}
                </div>
              </div>
              {selectedIssue.resource_type && selectedIssue.resource_id && (
                <div>
                  <div className="text-xs text-muted-foreground">Resource</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {selectedIssue.resource_type}:{selectedIssue.resource_id}
                  </div>
                </div>
              )}
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
