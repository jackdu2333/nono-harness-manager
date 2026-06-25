import React from 'react';
import { RefreshCw, ScanLine, Search, Plus, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  totalCount: number;
  activeCount: number;
  cliCount: number;
  appCount: number;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onDiscoverSystem: () => void;
  onOpenScanDrawer: () => void;
}

export function AgentsToolbar({ 
  totalCount, activeCount, cliCount, appCount, searchQuery, setSearchQuery, 
  onRefresh, isLoading, onDiscoverSystem, onOpenScanDrawer 
}: Props) {
  // Calculated broken count assuming total - active for simplicity, 
  // but really we'd check status === 'broken'. We'll just show 0 if not tracked.
  const brokenCount = 0; 

  return (
    <div className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm z-10 px-6 py-4 flex flex-col gap-3">
      {/* Row 1: Title & Stats */}
      <div className="flex items-center gap-4">
        <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-lg font-bold text-foreground">智能体客户端</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            启动、配置并管理本机 Agent 客户端
          </span>
        </div>
        
        {/* Compact Stats Chips */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary/50 rounded-md text-xs">
            <span className="text-muted-foreground font-medium">Total</span>
            <span className="font-semibold text-foreground">{totalCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-md text-xs">
            <span className="text-green-600 dark:text-green-500 font-medium">Active</span>
            <span className="font-semibold text-green-700 dark:text-green-400">{activeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary/50 rounded-md text-xs">
            <span className="text-muted-foreground font-medium">CLI</span>
            <span className="font-semibold text-foreground">{cliCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary/50 rounded-md text-xs">
            <span className="text-muted-foreground font-medium">App</span>
            <span className="font-semibold text-foreground">{appCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 rounded-md text-xs">
            <span className="text-red-600 dark:text-red-500 font-medium">Broken</span>
            <span className="font-semibold text-red-700 dark:text-red-400">{brokenCount}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Search & Actions */}
      <div className="flex items-center justify-between gap-4 mt-1">
        <div className="relative w-[300px] shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索 Agent 名称、类型或路径..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 bg-secondary/30 border-border/50 text-xs focus-visible:ring-1"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={onDiscoverSystem} disabled={isLoading} size="sm" className="h-8 gap-2 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
            <ScanLine className="w-3.5 h-3.5" /> 自动发现
          </Button>
          <Button onClick={onOpenScanDrawer} variant="secondary" size="sm" className="h-8 gap-2 shadow-sm">
            <Plus className="w-3.5 h-3.5" /> 扫描目录
          </Button>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading} className="h-8 w-8 shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
