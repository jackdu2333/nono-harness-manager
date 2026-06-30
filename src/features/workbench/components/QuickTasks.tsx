import { Layers, Cpu, Box, ShieldCheck, CalendarCheck, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import type { QuickTaskType } from '../types';

interface QuickTasksProps {
  onRunTask: (task: QuickTaskType) => void;
  isRunning: boolean;
}

const TASKS: { 
  type: QuickTaskType; 
  label: string; 
  desc: string; 
  icon: React.ComponentType<{ className?: string }> 
}[] = [
  { 
    type: 'analyze_skills', 
    label: '分析 Skills', 
    desc: '找出高使用低质量、缺描述、疑似重复的 Skills。', 
    icon: Layers 
  },
  { 
    type: 'check_agents', 
    label: '检查 Agents', 
    desc: '检查候选客户端、异常路径、日志适配状态。', 
    icon: Cpu 
  },
  { 
    type: 'check_mcp', 
    label: '检查 MCP', 
    desc: '检查 MCP 配置、工具 schema 和健康状态。', 
    icon: Box 
  },
  { 
    type: 'daily_governance_plan', 
    label: '今日治理计划', 
    desc: '生成今天最值得处理的 3 个事项。', 
    icon: CalendarCheck 
  },
  { 
    type: 'review_proposals', 
    label: '待处理 Proposals', 
    desc: '查看等待确认和已拦截 the 治理建议。', 
    icon: ShieldCheck 
  },
];

export function QuickTasks({ onRunTask, isRunning }: QuickTasksProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
        快捷任务
      </h3>
      <div className="space-y-2">
        {TASKS.map((task) => {
          const Icon = task.icon;
          return (
            <div 
              key={task.type} 
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-muted/25 hover:border-border transition-all"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-2 rounded bg-muted/80 text-muted-foreground shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground truncate">{task.label}</h4>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-1">{task.desc}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1 px-2.5 bg-background font-semibold shrink-0"
                disabled={isRunning}
                onClick={() => onRunTask(task.type)}
              >
                <Play className="w-2.5 h-2.5 fill-current animate-pulse-slow" />
                运行
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
