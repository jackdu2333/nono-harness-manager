import { Inbox, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkQueueItem, WorkQueuePriority } from '../types';

interface WorkQueueProps {
  items: WorkQueueItem[];
  onNavigate: (path: string) => void;
}

const priorityConfig: Record<WorkQueuePriority, { label: string; color: string; bg: string }> = {
  high: { label: '高', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-500/10' },
  medium: { label: '中', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10' },
  low: { label: '低', color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-500/10' },
};

export function WorkQueue({ items, onNavigate }: WorkQueueProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Inbox className="w-4 h-4 text-foreground" />
        <h2 className="text-sm font-semibold text-foreground">待处理队列</h2>
        {items.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <Inbox className="w-6 h-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">队列已清空</p>
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
                  {pConfig.label}
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
                  处理
                  <ChevronRight className="w-3 h-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 opacity-40 cursor-not-allowed"
                  disabled
                  title="Phase 2 可用"
                >
                  <Sparkles className="w-3 h-3" />
                  AI 分析
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
