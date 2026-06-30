import { Lightbulb, Layers, Cpu, Box, ShieldAlert, Sparkles, UserCheck, ArrowRight, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const list: RuleSuggestion[] = [
    {
      id: 'missing_desc',
      title: 'Skills 缺少描述',
      count: skills.filter(s => s.is_archived === 0 && !s.description).length,
      severity: 'info' as const,
      path: '/skills',
      icon: Layers,
      prompt: '分析一下当前缺少描述的 Skills，并给出补全建议。',
    },
    {
      id: 'needs_imp',
      title: 'Skills 待进化',
      count: skills.filter(s => s.is_archived === 0 && s.needs_improvement === 1).length,
      severity: 'info' as const,
      path: '/skills',
      icon: Sparkles,
      prompt: '分析一下当前待进化的 Skills，帮我规划治理方向。',
    },
    {
      id: 'agent_confirm',
      title: 'Agents 待确认',
      count: agents.filter(a => a.status === 'candidate').length,
      severity: 'warning' as const,
      path: '/agents',
      icon: Cpu,
      prompt: '检查一下待确认的 Agents，看是否安全且建议启用。',
    },
    {
      id: 'mcp_error',
      title: 'MCP 配置异常',
      count: mcpServers.filter(m => m.status === 'abnormal').length,
      severity: 'critical' as const,
      path: '/mcp',
      icon: Box,
      prompt: '分析一下当前异常的 MCP 服务，找出报错原因和排查建议。',
    },
    {
      id: 'proposal_pending',
      title: 'Proposals 待确认',
      count: proposals.filter(p => p.status === 'pending' || p.status === 'pending_review' || p.status === 'pending_manual_review').length,
      severity: 'warning' as const,
      path: '/proposals',
      icon: UserCheck,
      prompt: '审查一下当前的待确认 Proposals 治理提案。',
    },
    {
      id: 'proposal_blocked',
      title: 'Proposals 被拦截',
      count: proposals.filter(p => p.status === 'blocked').length,
      severity: 'critical' as const,
      path: '/proposals',
      icon: ShieldAlert,
      prompt: '分析一下被拦截的 Proposals 安全事件。',
    },
  ].filter(item => item.count > 0);

  const severityColors = {
    info: 'border-l-sky-500 bg-sky-500/[0.01]',
    warning: 'border-l-amber-500 bg-amber-500/[0.01]',
    critical: 'border-l-red-500 bg-red-500/[0.01]',
  };

  const badgeColors = {
    info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    critical: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-primary animate-pulse-slow" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          今日建议
        </h3>
      </div>

      {list.length === 0 ? (
        <div className="py-6 text-center bg-muted/10 rounded border border-dashed border-border flex flex-col items-center justify-center">
          <p className="text-xs text-muted-foreground/60">🎉 本机 AI 资产状态良好，暂无优化建议。</p>
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
                    去查看
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Button>
                  {aiEnabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-muted text-primary"
                      onClick={() => onAskAI(item.prompt)}
                      title="让 AI 分析"
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
