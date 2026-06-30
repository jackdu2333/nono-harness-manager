import { Agent } from '@/features/agents/types';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import { isAgentLaunchable } from '@/features/agents/utils/launchability';
import { useTranslation } from 'react-i18next';

export function AgentHealthTab({ agent }: { agent: Agent }) {
  const { t } = useTranslation();
  const hasAppPath = !!agent.app_path;
  const hasConfigPath = !!agent.config_path;
  const isLaunchable = isAgentLaunchable(agent);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/10">
        {hasAppPath ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />}
        <div>
          <h4 className="text-sm font-medium text-foreground">{t('agents.health_app_path')}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{hasAppPath ? t('agents.health_app_ok') : t('agents.health_app_fail')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/10">
        {hasConfigPath ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />}
        <div>
          <h4 className="text-sm font-medium text-foreground">{t('agents.health_config_dir')}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{hasConfigPath ? t('agents.health_config_ok') : t('agents.health_config_fail')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/10">
        {isLaunchable ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <XCircle className="w-5 h-5 text-destructive shrink-0" />}
        <div>
          <h4 className="text-sm font-medium text-foreground">{t('agents.health_launch')}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{isLaunchable ? t('agents.health_launch_ok') : t('agents.health_launch_fail')}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-8 mt-4 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
        <Activity className="w-8 h-8 mb-3 opacity-50" />
        <h3 className="text-sm font-medium text-foreground mb-1">{t('agents.health_advanced')}</h3>
        <p className="text-xs max-w-sm">
          {t('agents.health_advanced_desc')}
        </p>
      </div>
    </div>
  );
}
