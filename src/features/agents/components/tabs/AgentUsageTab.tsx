import React from 'react';
import { Agent } from '@/features/agents/types';
import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AgentUsageTab({ agent }: { agent: Agent }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 bg-card rounded-xl border border-border shadow-sm flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-foreground mb-1">{agent.launch_count}</div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Launches</div>
        </div>
        <div className="p-5 bg-card rounded-xl border border-border shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-sm font-medium text-foreground mb-1">
            {agent.last_launched_at ? new Date(agent.last_launched_at).toLocaleString() : 'Never'}
          </div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Launched</div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
        <BarChart3 className="w-10 h-10 mb-4 opacity-50" />
        <h3 className="text-sm font-medium text-foreground mb-1">{t('agents.usage_coming')}</h3>
        <p className="text-xs max-w-sm">
          {t('agents.usage_coming_desc')}
        </p>
      </div>
    </div>
  );
}
