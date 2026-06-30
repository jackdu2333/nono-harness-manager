import { Lightbulb, Layers, Cpu, Box, ShieldAlert, Sparkles, UserCheck, ArrowRight, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface RuleSuggestion {
  id: string;
  title: string;
  count: number;
  severity: 'info' | 'warning' | 'critical';
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
}

interface TodaySuggestionsProps {
  skills: any[];
  agents: any[];
  mcpServers: any[];
  proposals: any[];
  onNavigate: (path: string) => void;
  onAskAI: (prompt: string) => void;
  aiEnabled: boolean;
}

export function TodaySuggestions({
  skills,
  agents,
  mcpServers,
  proposals,
  onNavigate,
  onAskAI,
  aiEnabled,
}: TodaySuggestionsProps) {
  const { t } = useTranslation();
  const list: RuleSuggestion[] = [
    {
      id: 'missing_desc',
      title: t('workbench.suggestion_skills_missing_desc'),
      count: skills.filter(s => s.is_archived === 0 && !s.description).length,
      severity: 'info' as const,
      path: '/skills',
      icon: Layers,
      prompt: t('workbench.suggestion_skills_missing_prompt'),
    },
    {
      id: 'needs_imp',
      title: t('workbench.suggestion_skills_evolve'),
      count: skills.filter(s => s.is_archived === 0 && s.needs_improvement === 1).length,
      severity: 'info' as const,
      path: '/skills',
      icon: Sparkles,
      prompt: t('workbench.suggestion_skills_evolve_prompt'),
    },
    {
      id: 'agent_confirm',
      title: t('workbench.suggestion_agents_pending'),
      count: agents.filter(a => a.status === 'candidate').length,
      severity: 'warning' as const,
      path: '/agents',
      icon: Cpu,
      prompt: t('workbench.suggestion_agents_pending_prompt'),
    },
    {
      id: 'mcp_error',
      title: t('workbench.suggestion_mcp_error'),
      count: mcpServers.filter(m => m.status === 'abnormal').length,
      severity: 'critical' as const,
      path: '/mcp',
      icon: Box,
      prompt: t('workbench.suggestion_mcp_error_prompt'),
    },
    {
      id: 'proposal_pending',
      title: t('workbench.suggestion_proposals_pending'),
      count: proposals.filter(p => p.status === 'pending' || p.status === 'pending_review' || p.status === 'pending_manual_review').length,
      severity: 'warning' as const,
      path: '/proposals',
      icon: UserCheck,
      prompt: t('workbench.suggestion_proposals_pending_prompt'),
    },
    {
      id: 'proposal_blocked',
      title: t('workbench.suggestion_proposals_blocked'),
      count: proposals.filter(p => p.status === 'blocked').length,
      severity: 'critical' as const,
      path: '/proposals',
      icon: ShieldAlert,
      prompt: t('workbench.suggestion_proposals_blocked_prompt'),
    },
  ].filter(item => item.count > 0);

  const severityColors = {
    info: 'border-l-sky-500 bg-info/[0.01]',
    warning: 'border-l-amber-500 bg-warning/[0.01]',
    critical: 'border-l-red-500 bg-destructive/[0.01]',
  };

  const badgeColors = {
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    critical: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-primary animate-pulse-slow" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t('workbench.today_suggestions')}
        </h3>
      </div>

      {list.length === 0 ? (
        <div className="py-6 text-center bg-muted/10 rounded border border-dashed border-border flex flex-col items-center justify-center">
          <p className="text-xs text-muted-foreground/60">{t('workbench.all_good')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 p-2 rounded border border-border/50 border-l-2 ${severityColors[item.severity]} hover:bg-muted/10 transition-colors`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">{item.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${badgeColors[item.severity]}`}>
                    {item.count}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-1.5 gap-0.5 hover:bg-muted font-medium"
                    onClick={() => onNavigate(item.path)}
                  >
                    {t('workbench.go_view')}
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Button>
                  {aiEnabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-muted text-primary"
                      onClick={() => onAskAI(item.prompt)}
                      title={t('workbench.let_ai_analyze')}
                    >
                      <BrainCircuit className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
