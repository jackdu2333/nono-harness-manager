import React from 'react';
import { RefreshCw, ScanLine, Search, Plus, Bot, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  
  return (
    <div className="flex-shrink-0 w-full min-w-0 border-b border-border bg-card z-10 px-6 py-4 flex flex-col gap-4 shadow-sm overflow-hidden">
      {/* Row 1: Title, Subtitle & Primary Actions / Stats */}
      <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
        
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0 border border-primary/20">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-foreground tracking-tight">{t('agents.toolbar_title')}</h1>
            <span className="text-xs text-muted-foreground">{t('agents.toolbar_desc')}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
          {/* Stats Chips */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <StatChip label={t('agents.filter_all')} count={totalCount} />
            <StatChip label={t('agents.filter_active')} count={availableCount} color="green" />
            <StatChip label={t('agents.filter_pending')} count={pendingCount} color="yellow" />
            <StatChip label={t('agents.filter_launchable')} count={launchableCount} color="blue" />
            <StatChip label={t('agents.filter_log_ok')} count={logAvailableCount} />
            <StatChip label={t('agents.filter_broken')} count={errorCount} color="red" />
          </div>
          
          <div className="w-px h-6 bg-border hidden lg:block mx-1"></div>
          
          <Button onClick={onDiscoverSystem} disabled={isLoading} size="sm" className="h-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all">
            <ScanLine className="w-3.5 h-3.5" /> {t('common.auto_discover')}
          </Button>
          <Button onClick={onOpenScanDrawer} variant="outline" size="sm" className="h-8 gap-2 shadow-sm border-border text-foreground hover:bg-muted/50">
            <Plus className="w-3.5 h-3.5" /> {t('common.scan_dir')}
          </Button>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading} className="h-8 w-8 shadow-sm border-border text-foreground hover:bg-muted/50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Row 2: Search & Advanced Filters */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative w-[280px] shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('agents.search_placeholder_full')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 bg-muted/50 border-border text-xs focus-visible:ring-1 focus-visible:ring-ring rounded-md"
          />
        </div>
        
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-hidden pb-1">
          <div className="flex items-center gap-1.5 px-2 text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">筛选</span>
          </div>
          
          <FilterSelect 
            value={typeFilter} 
            onChange={setTypeFilter} 
            options={[
              { value: 'all', label: t('agents.type_all') },
              { value: 'App', label: t('agents.type_app') },
              { value: 'CLI', label: t('agents.type_cli') },
              { value: 'ConfigOnly', label: t('agents.type_config') },
            ]} 
          />
          <FilterSelect 
            value={statusFilter} 
            onChange={setStatusFilter} 
            options={[
              { value: 'all', label: t('agents.status_all') },
              { value: 'active', label: t('agents.status_active') },
              { value: 'pending', label: t('agents.status_pending') },
              { value: 'ignored', label: t('agents.status_ignored') },
              { value: 'broken', label: t('agents.status_broken') },
            ]} 
          />

        </div>
      </div>
    </div>
  );
}

function StatChip({ label, count, color = 'gray' }: { label: string, count: number, color?: 'gray' | 'green' | 'yellow' | 'red' | 'blue' }) {
  const colorStyles = {
    gray: 'bg-muted text-muted-foreground border-border',
    green: 'bg-success/10 text-success border-success/30',
    yellow: 'bg-warning/10 text-warning border-warning/30',
    red: 'bg-destructive/10 text-destructive border-destructive/30',
    blue: 'bg-primary/10 text-primary border-primary/30',
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
      <SelectTrigger className="h-8 text-xs bg-card border-border hover:bg-muted/50 focus:ring-1 focus:ring-ring w-[132px] min-w-0">
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
