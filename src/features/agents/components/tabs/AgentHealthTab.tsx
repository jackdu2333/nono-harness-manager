import React from 'react';
import { Agent } from '@/features/agents/types';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

export function AgentHealthTab({ agent }: { agent: Agent }) {
  const hasAppPath = !!agent.app_path;
  const hasConfigPath = !!agent.config_path;
  const isLaunchable = !!agent.app_path || !!agent.launch_command;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/10">
        {hasAppPath ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> : <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />}
        <div>
          <h4 className="text-sm font-medium text-foreground">应用路径检查</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{hasAppPath ? '应用路径已配置' : '应用路径未配置'}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/10">
        {hasConfigPath ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> : <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />}
        <div>
          <h4 className="text-sm font-medium text-foreground">配置目录检查</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{hasConfigPath ? '配置目录已配置' : '配置目录未发现'}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/10">
        {isLaunchable ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
        <div>
          <h4 className="text-sm font-medium text-foreground">启动能力评估</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{isLaunchable ? '具备基础启动条件' : '缺失启动条件，不可启动'}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-8 mt-4 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
        <Activity className="w-8 h-8 mb-3 opacity-50" />
        <h3 className="text-sm font-medium text-foreground mb-1">高级健康检查</h3>
        <p className="text-xs max-w-sm">
          真实的本机文件存在性验证和依赖检测将在未来版本提供。
        </p>
      </div>
    </div>
  );
}
