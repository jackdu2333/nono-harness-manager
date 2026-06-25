import React from 'react';
import { Agent } from '@/features/agents/types';
import { Folder, Copy, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentsStore } from '@/features/agents/store';

export function AgentOverviewTab({ agent }: { agent: Agent }) {
  const openConfigDir = useAgentsStore(s => s.openConfigDir);
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const PathRow = ({ label, path, canOpen }: { label: string, path: string | null, canOpen?: boolean }) => (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/50 last:border-0 group">
      <div className="flex items-center gap-2 shrink-0 w-28">
        <Folder className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-foreground truncate" title={path || '未配置'}>
          {path || <span className="text-muted-foreground italic">未配置</span>}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {path && (
          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handleCopy(path)} title="复制路径">
            <Copy className="w-3 h-3 text-muted-foreground" />
          </Button>
        )}
        {path && canOpen && (
          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => openConfigDir(agent.id)} title="在访达中打开">
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          功能描述
        </h3>
        <div className="flex gap-3 text-sm text-foreground/90 leading-relaxed bg-primary/5 p-4 rounded-lg border border-primary/10">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            {agent.description || `这是一个 ${agent.type || '未分类'} 类型的智能体客户端。它支持与核心服务进行交互并可以被配置来执行特定的本地自动化任务。`}
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          目录与工作区
        </h3>
        <div className="bg-card rounded-lg border border-border px-4 py-1">
          <PathRow label="App Path" path={agent.app_path} />
          <PathRow label="Config Path" path={agent.config_path} canOpen={true} />
          <PathRow label="Workspace" path={agent.default_workspace} />
        </div>
      </section>
    </div>
  );
}
