import { Inbox, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import type { WorkQueueItem, WorkQueuePriority } from '../types';

interface WorkQueueProps {
  items: WorkQueueItem[];
  onNavigate: (path: string) => void;
}

const priorityConfig: Record<WorkQueuePriority, { color: string; bg: string }> = {
  high: { color: 'text-destructive', bg: 'bg-destructive/10' },
  medium: { color: 'text-warning', bg: 'bg-warning/10' },
  low: { color: 'text-info', bg: 'bg-info/10' },
};

export function WorkQueue({ items, onNavigate }: WorkQueueProps) {
  const { t } = useTranslation();
  const priorityLabel: Record<WorkQueuePriority, string> = {
    high: t('workbench.priority_high'),
    medium: t('workbench.priority_medium'),
    low: t('workbench.priority_low'),
  };
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Inbox className="w-4 h-4 text-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('workbench.work_queue')}</h2>
        {items.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <Inbox className="w-6 h-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('workbench.queue_empty')}</p>
        </div>
      ) : (
        <div>
          {items.map((item) => {
            const pConfig = priorityConfig[item.priority];
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0"
              >
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pConfig.bg} ${pConfig.color}`}
                >
                  {priorityLabel[item.priority]}
                </span>

                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{item.title}</span>
                  {item.resource_count > 0 && (
                    <span className="ml-2 text-xs font-semibold text-foreground tabular-nums">
                      {item.resource_count}
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onNavigate(item.target_path)}
                >
                  {t('workbench.process')}
                  <ChevronRight className="w-3 h-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 opacity-40 cursor-not-allowed"
                  disabled
                  title={t('workbench.ai_analyze_soon')}
                >
                  <Sparkles className="w-3 h-3" />
                  {t('workbench.ai_analyze')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
