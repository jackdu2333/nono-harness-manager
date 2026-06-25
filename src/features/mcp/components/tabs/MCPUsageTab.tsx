import React from 'react';
import { BarChart3 } from 'lucide-react';

export function MCPUsageTab() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
      <BarChart3 className="w-10 h-10 mb-4 opacity-50" />
      <h3 className="text-sm font-medium text-foreground mb-1">使用统计尚未启用</h3>
      <p className="text-xs max-w-sm">
        稍后将在此处展示哪些 Agent 正在调用该 MCP 以及调用频率。
      </p>
    </div>
  );
}
