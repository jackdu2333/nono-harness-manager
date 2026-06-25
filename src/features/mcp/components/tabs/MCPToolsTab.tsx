import React from 'react';
import { TerminalSquare } from 'lucide-react';

export function MCPToolsTab() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
      <TerminalSquare className="w-10 h-10 mb-4 opacity-50" />
      <h3 className="text-sm font-medium text-foreground mb-1">暂未解析 Tools</h3>
      <p className="text-xs max-w-sm">
        MCP Tools 列表将在连接并启动 Server 后在此处显示。
      </p>
    </div>
  );
}
