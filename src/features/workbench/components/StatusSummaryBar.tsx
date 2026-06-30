import { Layers, Cpu, Box, ShieldCheck, HeartPulse, Activity } from 'lucide-react';

interface StatusSummaryBarProps {
  skillsCount: number;
  agentsCount: number;
  mcpCount: number;
  pendingProposals: number;
  healthIssueCount: number;
  recentEventCount: number;
  onNavigate: (path: string) => void;
}

interface StatCard {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  variant?: 'default' | 'warning' | 'info';
}

export function StatusSummaryBar({
  skillsCount,
  agentsCount,
  mcpCount,
  pendingProposals,
  healthIssueCount,
  recentEventCount,
  onNavigate,
}: StatusSummaryBarProps) {
  const cards: StatCard[] = [
    { label: 'Skills', value: skillsCount, icon: Layers, path: '/skills' },
    { label: 'Agents', value: agentsCount, icon: Cpu, path: '/agents' },
    { label: 'MCP', value: mcpCount, icon: Box, path: '/mcp' },
    {
      label: '待处理 Proposals',
      value: pendingProposals,
      icon: ShieldCheck,
      path: '/proposals',
      variant: pendingProposals > 0 ? 'warning' : 'default',
    },
    {
      label: '健康问题',
      value: healthIssueCount > 0 ? healthIssueCount : '-',
      icon: HeartPulse,
      path: '/health',
      variant: healthIssueCount > 0 ? 'warning' : 'default',
    },
    {
      label: '7 天可观测事件',
      value: recentEventCount,
      icon: Activity,
      path: '/analytics',
      variant: 'info',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isWarning = card.variant === 'warning';
        const isInfo = card.variant === 'info';

        return (
          <button
            key={card.label}
            onClick={() => onNavigate(card.path)}
            className={`flex flex-col items-start rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
              isWarning
                ? 'border-amber-300/50 dark:border-amber-500/30'
                : 'border-border'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon
                className={`w-3.5 h-3.5 ${
                  isWarning
                    ? 'text-amber-600 dark:text-amber-400'
                    : isInfo
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-muted-foreground'
                }`}
              />
              <span className="text-xs text-muted-foreground truncate">{card.label}</span>
            </div>
            <span
              className={`text-xl font-semibold tabular-nums ${
                typeof card.value === 'number' && card.value === 0
                  ? 'text-muted-foreground/40'
                  : isWarning
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-foreground'
              }`}
            >
              {card.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}
