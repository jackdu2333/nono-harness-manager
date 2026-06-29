import React from 'react';
import { RefreshCw, ScanLine, Search, Plus, Bot, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  totalCount: number;
  availableCount: number;
  pendingCount: number;
  launchableCount: number;
  logAvailableCount: number;
  errorCount: number;
  
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  
  typeFilter: string;
  setTypeFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  confidenceFilter: string;
  setConfidenceFilter: (val: string) => void;
  launchableFilter: string;
  setLaunchableFilter: (val: string) => void;
  
  onRefresh: () => void;
  isLoading: boolean;
  onDiscoverSystem: () => void;
  onOpenScanDrawer: () => void;
}

export function AgentsToolbar({ 
  totalCount, availableCount, pendingCount, launchableCount, logAvailableCount, errorCount,
  searchQuery, setSearchQuery, 
  typeFilter, setTypeFilter,
  statusFilter, setStatusFilter,
  confidenceFilter, setConfidenceFilter,
  launchableFilter, setLaunchableFilter,
  onRefresh, isLoading, onDiscoverSystem, onOpenScanDrawer 
}: Props) {
  
  return (
    <div className="flex-shrink-0 border-b border-[#E6E7EB] bg-white z-10 px-6 py-4 flex flex-col gap-4 shadow-sm">
      {/* Row 1: Title, Subtitle & Primary Actions / Stats */}
      <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
        
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg shrink-0 border border-blue-100">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-[#1F2328] tracking-tight">智能体客户端</h1>
            <span className="text-xs text-[#8B8E98]">管理本机 Agent 客户端、CLI、桌面应用和日志适配状态</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
          {/* Stats Chips */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <StatChip label="全部" count={totalCount} />
            <StatChip label="可用" count={availableCount} color="green" />
            <StatChip label="待确认" count={pendingCount} color="yellow" />
            <StatChip label="可启动" count={launchableCount} color="blue" />
            <StatChip label="日志可用" count={logAvailableCount} />
            <StatChip label="异常" count={errorCount} color="red" />
          </div>
          
          <div className="w-px h-6 bg-[#E6E7EB] hidden lg:block mx-1"></div>
          
          <Button onClick={onDiscoverSystem} disabled={isLoading} size="sm" className="h-8 gap-2 bg-[#1F2328] text-white hover:bg-[#323842] shadow-sm transition-all">
            <ScanLine className="w-3.5 h-3.5" /> 自动发现
          </Button>
          <Button onClick={onOpenScanDrawer} variant="outline" size="sm" className="h-8 gap-2 shadow-sm border-[#E6E7EB] text-[#1F2328] hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> 扫描目录
          </Button>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading} className="h-8 w-8 shadow-sm border-[#E6E7EB] text-[#1F2328] hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Row 2: Search & Advanced Filters */}
      <div className="flex items-center gap-3">
        <div className="relative w-[280px] shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8E98]" />
          <Input
            placeholder="搜索 Agent 名称、路径或 Bundle ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 bg-gray-50 border-[#E6E7EB] text-xs focus-visible:ring-1 focus-visible:ring-blue-500 rounded-md"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
          <div className="flex items-center gap-1.5 px-2 text-[#8B8E98]">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">筛选</span>
          </div>
          
          <FilterSelect 
            value={typeFilter} 
            onChange={setTypeFilter} 
            options={[
              { value: 'all', label: '类型: 全部' },
              { value: 'App', label: 'App (桌面客户端)' },
              { value: 'CLI', label: 'CLI (命令行)' },
              { value: 'ConfigOnly', label: '配置/日志' },
            ]} 
          />
          <FilterSelect 
            value={statusFilter} 
            onChange={setStatusFilter} 
            options={[
              { value: 'all', label: '状态: 全部' },
              { value: 'active', label: '正常 (Active)' },
              { value: 'pending', label: '待确认 (Pending)' },
              { value: 'ignored', label: '已忽略 (Ignored)' },
              { value: 'broken', label: '异常 (Broken)' },
            ]} 
          />
          <FilterSelect 
            value={confidenceFilter} 
            onChange={setConfidenceFilter} 
            options={[
              { value: 'all', label: '置信度: 全部' },
              { value: 'verified', label: '已验证 (Verified)' },
              { value: 'probable', label: '推断 (Probable)' },
              { value: 'candidate', label: '候选 (Candidate)' },
            ]} 
          />
          <FilterSelect 
            value={launchableFilter} 
            onChange={setLaunchableFilter} 
            options={[
              { value: 'all', label: '启动: 全部' },
              { value: 'launchable', label: '可直接启动' },
              { value: 'unlaunchable', label: '不可启动' },
            ]} 
          />
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, count, color = 'gray' }: { label: string, count: number, color?: 'gray' | 'green' | 'yellow' | 'red' | 'blue' }) {
  const colorStyles = {
    gray: 'bg-gray-100 text-[#8B8E98] border-gray-200',
    green: 'bg-green-50 text-[#22C55E] border-green-200',
    yellow: 'bg-amber-50 text-[#F59E0B] border-amber-200',
    red: 'bg-red-50 text-[#EF4444] border-red-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
  };
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] border shadow-sm ${colorStyles[color]}`}>
      <span className="font-medium">{label}</span>
      <span className="font-bold opacity-80">{count}</span>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string, onChange: (val: string) => void, options: {value: string, label: string}[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs bg-white border-[#E6E7EB] hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 w-auto min-w-[120px]">
        <SelectValue placeholder={options[0].label} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
