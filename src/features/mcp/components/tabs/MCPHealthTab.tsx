import React from 'react';
import { Activity } from 'lucide-react';

export function MCPHealthTab() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/50">
      <Activity className="w-10 h-10 mb-4 opacity-50" />
      <h3 className="text-sm font-medium text-foreground mb-1">健康检查尚未启用</h3>
      <p className="text-xs max-w-sm">
        未来的版本将支持检测命令存在性、依赖是否安装以及连接稳定性。
      </p>
    </div>
  );
}
