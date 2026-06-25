import React from 'react';
import { Link2 } from 'lucide-react';

export function AgentResourcesTab() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
      <Link2 className="w-10 h-10 mb-4 opacity-50" />
      <h3 className="text-sm font-medium text-foreground mb-1">资源绑定功能尚未启用</h3>
      <p className="text-xs max-w-sm">
        未来将在此处展示和管理当前 Agent 绑定的 Skills、MCP、Memory 和 Knowledge 库。
      </p>
    </div>
  );
}
