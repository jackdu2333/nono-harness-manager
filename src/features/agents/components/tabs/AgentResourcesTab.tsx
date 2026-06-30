import { Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AgentResourcesTab() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
      <Link2 className="w-10 h-10 mb-4 opacity-50" />
      <h3 className="text-sm font-medium text-foreground mb-1">{t('agents.resources_not_enabled')}</h3>
      <p className="text-xs max-w-sm">
        {t('agents.resources_not_enabled_desc')}
      </p>
    </div>
  );
}
