import { McpServer } from '@/features/mcp/types';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function MCPOverviewTab({ server }: { server: McpServer }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">{t('mcp.description')}</h3>
        <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/30 p-4 rounded-lg border border-border/50">
          {server.description || t('mcp.no_description_short')}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-secondary/20 rounded-lg border border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Source</h4>
          <p className="text-sm text-foreground truncate" title={server.source_path || 'Unknown'}>{server.source_path || 'Unknown'}</p>
        </div>
        <div className="p-4 bg-secondary/20 rounded-lg border border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Transport</h4>
          <p className="text-sm text-foreground">stdio</p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('mcp.capabilities')}</h3>
        <div className="p-4 bg-secondary/20 rounded-lg border border-dashed border-border/50 text-sm text-muted-foreground">
            {t('mcp.overview_note')}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('mcp.launch_command')}</h3>
        <div className="p-3 bg-secondary/50 rounded-lg border border-border text-sm font-mono text-foreground flex items-center gap-2 overflow-x-auto">
          <Play className="w-4 h-4 text-primary shrink-0" />
          <span className="whitespace-nowrap">{server.command} {server.args ? '...' : ''}</span>
        </div>
      </section>
    </div>
  );
}
