import { useSkillsStore } from '../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, X, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SkillSourcesDrawer } from './SkillSourcesDrawer';
import { useMemo, useState, useEffect } from 'react';
import { getCompatibleClient } from '../utils/clientMatcher';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

export function SkillsToolbar({ globalFilter, setGlobalFilter }: { globalFilter: string, setGlobalFilter: (s: string) => void }) {
  const { t } = useTranslation();
  const [mainElement, setMainElement] = useState<Element | null>(null);

  useEffect(() => {
    const el = document.querySelector('main');
    if (el) {
      setMainElement(el);
    }
  }, []);
  const {
    skills,
    isScanning,
    sources,
    scanSource,
    sourceFilter,
    clientFilter,
    categoryFilter,
    statusFilter,
    setSourceFilter,
    setClientFilter,
    setCategoryFilter,
    setStatusFilter
  } = useSkillsStore();

  const categories = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => { if (s.category) set.add(s.category); });
    return Array.from(set).sort();
  }, [skills]);

  const handleScanAll = async () => {
    for (const source of sources) {
      await scanSource(source.id);
    }
  };

  const hasActiveFilters = sourceFilter.length > 0 || clientFilter.length > 0 || categoryFilter.length > 0 || statusFilter.length > 0;

  const clearFilters = () => {
    setSourceFilter([]);
    setClientFilter([]);
    setCategoryFilter([]);
    setStatusFilter([]);
  };

  const activeSkillsCount = useMemo(() => {
    return skills.filter((s) => s.is_archived === 0).length;
  }, [skills]);

  const filteredSkills = useMemo(() => {
    const activeSkills = skills.filter((s) => s.is_archived === 0);
    let result = activeSkills;
    if (sourceFilter.length > 0) {
      result = result.filter((s) => s.source_id && sourceFilter.includes(s.source_id));
    }
    if (clientFilter.length > 0) {
      result = result.filter((s) => {
        const src = sources.find((x) => x.id === s.source_id);
        const clientName = getCompatibleClient(s, src ? src.name : '');
        return clientFilter.includes(clientName);
      });
    }
    if (categoryFilter.length > 0) {
      result = result.filter((s) => s.category && categoryFilter.includes(s.category));
    }
    if (statusFilter.length > 0) {
      result = result.filter((s) => statusFilter.includes(s.status));
    }
    return result;
  }, [skills, sourceFilter, clientFilter, categoryFilter, statusFilter, sources]);

  const getSourceLabel = () => {
    if (sourceFilter.length === 0) return '来源：全部';
    if (sourceFilter.length === 1) {
      const src = sources.find(s => s.id === sourceFilter[0]);
      return `来源：${src ? src.name : sourceFilter[0]}`;
    }
    return `来源：已选 ${sourceFilter.length} 项`;
  };

  const getClientLabel = () => {
    if (clientFilter.length === 0) return '适用：全部';
    if (clientFilter.length === 1) return `适用：${clientFilter[0]}`;
    return `适用：已选 ${clientFilter.length} 项`;
  };

  const getCategoryLabel = () => {
    if (categoryFilter.length === 0) return '分类：全部';
    if (categoryFilter.length === 1) return `分类：${categoryFilter[0]}`;
    return `分类：已选 ${categoryFilter.length} 项`;
  };

  const getStatusLabel = () => {
    if (statusFilter.length === 0) return '状态：全部';
    if (statusFilter.length === 1) {
      const mapping: Record<string, string> = {
        active: '使用中',
        draft: '草稿',
        deprecated: '已弃用',
        broken: '已失效',
      };
      return `状态：${mapping[statusFilter[0]] || statusFilter[0]}`;
    }
    return `状态：已选 ${statusFilter.length} 项`;
  };

  return (
    <div className="shrink-0 flex flex-col border-b border-border bg-background px-4 lg:px-6 py-3 gap-3">
      {/* First Row: Title + Stats on Left, Search + Actions on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 shrink-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight">技能管理</h1>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            共 {activeSkillsCount} 个技能 · {sources.length} 个资源库
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative w-full sm:w-[240px] md:w-[270px] lg:w-[285px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('skills.search_placeholder')}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 bg-card border-border text-foreground w-full"
            />
          </div>

          <Button
            variant="secondary"
            onClick={handleScanAll}
            disabled={isScanning || sources.length === 0}
            className="gap-2 shrink-0 bg-muted text-foreground hover:bg-muted/80 h-9"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            扫描全部
          </Button>

          <SkillSourcesDrawer />
        </div>
      </div>

      {/* Second Row: Filter Selects (DropdownMenus supporting Checkboxes for Multi-Select) */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Source Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 border-border bg-card text-sm text-foreground gap-2 px-3 hover:bg-muted shrink-0 transition-all font-normal">
              <span>{getSourceLabel()}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            collisionBoundary={mainElement || undefined}
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] max-h-[280px] overflow-y-auto overflow-x-hidden bg-popover text-popover-foreground border border-border/40 shadow-lg"
          >
            {sources.map((src) => {
              const isChecked = sourceFilter.includes(src.id);
              return (
                <DropdownMenuCheckboxItem
                  key={src.id}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSourceFilter([...sourceFilter, src.id]);
                    } else {
                      setSourceFilter(sourceFilter.filter(id => id !== src.id));
                    }
                  }}
                >
                  {src.name}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Client Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 border-border bg-card text-sm text-foreground gap-2 px-3 hover:bg-muted shrink-0 transition-all font-normal">
              <span>{getClientLabel()}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            collisionBoundary={mainElement || undefined}
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] max-h-[280px] overflow-y-auto overflow-x-hidden bg-popover text-popover-foreground border border-border/40 shadow-lg"
          >
            {['Codex', 'Claude Code', 'WorkBuddy', '通用'].map((client) => {
              const isChecked = clientFilter.includes(client);
              return (
                <DropdownMenuCheckboxItem
                  key={client}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setClientFilter([...clientFilter, client]);
                    } else {
                      setClientFilter(clientFilter.filter(c => c !== client));
                    }
                  }}
                >
                  {client}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Category Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 border-border bg-card text-sm text-foreground gap-2 px-3 hover:bg-muted shrink-0 transition-all font-normal">
              <span>{getCategoryLabel()}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            collisionBoundary={mainElement || undefined}
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] max-h-[280px] overflow-y-auto overflow-x-hidden bg-popover text-popover-foreground border border-border/40 shadow-lg"
          >
            {categories.map((cat) => {
              const isChecked = categoryFilter.includes(cat);
              return (
                <DropdownMenuCheckboxItem
                  key={cat}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setCategoryFilter([...categoryFilter, cat]);
                    } else {
                      setCategoryFilter(categoryFilter.filter(c => c !== cat));
                    }
                  }}
                >
                  {cat}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 border-border bg-card text-sm text-foreground gap-2 px-3 hover:bg-muted shrink-0 transition-all font-normal">
              <span>{getStatusLabel()}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            collisionBoundary={mainElement || undefined}
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] max-h-[280px] overflow-y-auto overflow-x-hidden bg-popover text-popover-foreground border border-border/40 shadow-lg"
          >
            {[
              { value: 'active', label: '使用中' },
              { value: 'draft', label: '草稿' },
              { value: 'deprecated', label: '已弃用' },
              { value: 'broken', label: '已失效' },
            ].map((st) => {
              const isChecked = statusFilter.includes(st.value);
              return (
                <DropdownMenuCheckboxItem
                  key={st.value}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setStatusFilter([...statusFilter, st.value]);
                    } else {
                      setStatusFilter(statusFilter.filter(v => v !== st.value));
                    }
                  }}
                >
                  {st.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground shrink-0 h-9" onClick={clearFilters}>
            清除筛选
          </Button>
        )}
      </div>

      {/* Third Row: Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/40">
          <span className="text-xs text-muted-foreground mr-1">当前筛选：</span>
          
          {sourceFilter.map((srcId) => {
            const name = sources.find(s => s.id === srcId)?.name || srcId;
            return (
              <span key={`src-${srcId}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground border border-border">
                <span>来源：{name}</span>
                <button
                  onClick={() => setSourceFilter(sourceFilter.filter(id => id !== srcId))}
                  className="hover:text-destructive p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            );
          })}

          {clientFilter.map((client) => (
            <span key={`client-${client}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground border border-border">
              <span>适用：{client}</span>
              <button
                onClick={() => setClientFilter(clientFilter.filter(c => c !== client))}
                className="hover:text-destructive p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          ))}

          {categoryFilter.map((cat) => (
            <span key={`cat-${cat}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground border border-border">
              <span>分类：{cat}</span>
              <button
                onClick={() => setCategoryFilter(categoryFilter.filter(c => c !== cat))}
                className="hover:text-destructive p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          ))}

          {statusFilter.map((stVal) => {
            const labelMapping: Record<string, string> = {
              active: '使用中',
              draft: '草稿',
              deprecated: '已弃用',
              broken: '已失效',
            };
            return (
              <span key={`status-${stVal}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground border border-border">
                <span>状态：{labelMapping[stVal] || stVal}</span>
                <button
                  onClick={() => setStatusFilter(statusFilter.filter(v => v !== stVal))}
                  className="hover:text-destructive p-0.5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-destructive shrink-0 font-medium"
            onClick={clearFilters}
          >
            清除全部
          </Button>
        </div>
      )}
    </div>
  );
}
