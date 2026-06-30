import { X, AlertCircle, AlertTriangle, Info, ArrowRight, FileText, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AnalysisReport, AnalysisFinding, SuggestionSeverity } from '../types';

interface AnalysisReportPanelProps {
  report: AnalysisReport;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const TASK_LABELS: Record<string, string> = {
  analyze_skills: 'Skills 分析报告',
  check_agents: 'Agents 检查报告',
  check_mcp: 'MCP 检查报告',
  review_proposals: 'Proposals 分析报告',
  daily_governance_plan: '今日治理计划',
};

const severityIcon: Record<SuggestionSeverity, React.ComponentType<{ className?: string }>> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityColor: Record<SuggestionSeverity, string> = {
  critical: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
};

const severityBadge: Record<SuggestionSeverity, string> = {
  critical: 'bg-red-500/10 text-red-700 dark:text-red-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
};

export function AnalysisReportPanel({ report, onClose, onNavigate }: AnalysisReportPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {TASK_LABELS[report.task_type] ?? '分析报告'}
          </h2>
          <span className="text-xs text-muted-foreground/60">
            {new Date(report.generated_at).toLocaleTimeString()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Summary */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
            概述
          </h3>
          <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
        </section>

        {/* Findings */}
        {report.findings.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              发现 ({report.findings.length})
            </h3>
            <div className="space-y-1">
              {report.findings.map((finding) => (
                <FindingRow key={finding.id} finding={finding} />
              ))}
            </div>
          </section>
        )}

        {/* Suggested Actions */}
        {report.suggested_actions.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              建议动作
            </h3>
            <div className="flex flex-wrap gap-2">
              {report.suggested_actions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => onNavigate(action.target_path)}
                >
                  {action.label}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              ))}
            </div>
          </section>
        )}

        {/* Related Resources */}
        {report.related_resources.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              关联资源 ({report.related_resources.length})
            </h3>
            <div className="space-y-0.5">
              {report.related_resources.map((res) => (
                <div
                  key={`${res.type}-${res.id}`}
                  className="flex items-center gap-2 text-xs text-muted-foreground py-1"
                >
                  <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground/70 font-mono">
                    {res.type}
                  </span>
                  <span className="text-foreground font-medium truncate">{res.name}</span>
                  {res.path && (
                    <span className="text-muted-foreground/50 truncate">{res.path}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Next Steps */}
        {report.next_steps.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              <ListChecks className="w-3.5 h-3.5 inline mr-1" />
              下一步
            </h3>
            <ol className="space-y-1">
              {report.next_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-xs text-muted-foreground/50 tabular-nums w-4 pt-0.5">
                    {idx + 1}.
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

function FindingRow({ finding }: { finding: AnalysisFinding }) {
  const Icon = severityIcon[finding.severity];
  const color = severityColor[finding.severity];
  const badge = severityBadge[finding.severity];

  return (
    <div className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors">
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{finding.title}</span>
        {finding.detail && (
          <p className="text-xs text-muted-foreground truncate">{finding.detail}</p>
        )}
      </div>
      {finding.count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge}`}>
          {finding.count}
        </span>
      )}
    </div>
  );
}
