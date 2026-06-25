import React from 'react';
import { Database } from 'lucide-react';

export function MCPResourcesTab() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
      <Database className="w-10 h-10 mb-4 opacity-50" />
      <h3 className="text-sm font-medium text-foreground mb-1">暂未发现 Resources</h3>
      <p className="text-xs max-w-sm">
        如果该 MCP 提供静态资源，它们将显示在此处。
      </p>
    </div>
  );
}
