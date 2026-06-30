import { Layers, Cpu, Box, ShieldCheck, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuickTaskType } from '../types';

interface QuickTasksProps {
  onRunTask: (task: QuickTaskType) => void;
  isRunning: boolean;
}

const TASKS: { type: QuickTaskType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'analyze_skills', label: '分析 Skills', icon: Layers },
  { type: 'check_agents', label: '检查 Agents', icon: Cpu },
  { type: 'check_mcp', label: '检查 MCP', icon: Box },
  { type: 'daily_governance_plan', label: '今日治理计划', icon: CalendarCheck },
  { type: 'review_proposals', label: '待处理 Proposals', icon: ShieldCheck },
];

export function QuickTasks({ onRunTask, isRunning }: QuickTasksProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
        快捷任务
      </h3>
      <div className="flex flex-wrap gap-2">
        {TASKS.map((task) => {
          const Icon = task.icon;
          return (
            <Button
              key={task.type}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              disabled={isRunning}
              onClick={() => onRunTask(task.type)}
            >
              <Icon className="w-3.5 h-3.5" />
              {task.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
