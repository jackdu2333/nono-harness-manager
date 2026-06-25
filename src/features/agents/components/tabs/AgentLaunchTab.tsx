import { Agent } from '@/features/agents/types';
import { Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentsStore } from '@/features/agents/store';
import { getAgentLaunchUnavailableReason, isAgentLaunchable } from '@/features/agents/utils/launchability';

export function AgentLaunchTab({ agent }: { agent: Agent }) {
  const launchAgent = useAgentsStore(s => s.launchAgent);
  const isLaunchable = isAgentLaunchable(agent);

  const handleLaunch = async () => {
    if (isLaunchable) {
      await launchAgent(agent.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-secondary/20 rounded-lg border border-border/50 p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> 启动配置 (Launch Config)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              第一阶段仅支持安全启动 macOS App。
            </p>
          </div>
          <Button onClick={handleLaunch} disabled={!isLaunchable} className="shrink-0 gap-2">
            <Play className="w-4 h-4 fill-current" /> 启动
          </Button>
        </div>

        {!isLaunchable && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-center gap-2 text-yellow-600 dark:text-yellow-500 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{getAgentLaunchUnavailableReason(agent)}</span>
          </div>
        )}
      </div>

      <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden text-sm">
        <div className="flex border-b border-border/50">
          <div className="w-32 px-4 py-3 bg-secondary/50 font-medium text-muted-foreground border-r border-border/50">App Path</div>
          <div className="px-4 py-3 font-mono flex-1 text-foreground break-all">{agent.app_path || <span className="text-muted-foreground italic">None</span>}</div>
        </div>
        <div className="flex border-b border-border/50">
          <div className="w-32 px-4 py-3 bg-secondary/50 font-medium text-muted-foreground border-r border-border/50">Command</div>
          <div className="px-4 py-3 font-mono flex-1 text-foreground break-all">{agent.launch_command || <span className="text-muted-foreground italic">None</span>}</div>
        </div>
        <div className="flex">
          <div className="w-32 px-4 py-3 bg-secondary/50 font-medium text-muted-foreground border-r border-border/50">Workspace</div>
          <div className="px-4 py-3 font-mono flex-1 text-foreground break-all">{agent.default_workspace || <span className="text-muted-foreground italic">None</span>}</div>
        </div>
      </div>
    </div>
  );
}
