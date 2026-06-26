import { useSkillsStore } from '../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SkillSourcesDrawer } from './SkillSourcesDrawer';
import { useMemo } from 'react';

export function SkillsToolbar({ globalFilter, setGlobalFilter }: { globalFilter: string, setGlobalFilter: (s: string) => void }) {
  const { t } = useTranslation();
  const { skills, isScanning, sources, scanSource, sourceFilter, categoryFilter, setSourceFilter, setCategoryFilter } = useSkillsStore();

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

  const hasActiveFilters = sourceFilter !== null || categoryFilter !== null;

  const clearFilters = () => {
    setSourceFilter(null);
    setCategoryFilter(null);
  };

  return (
    <div className="shrink-0 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 lg:px-6 border-b border-border bg-background">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">技能管理</h1>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <span>共 {skills.length} 个技能</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
          <span>{sources.length} 个资源库</span>
        </p>
      </div>

      <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm lg:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('skills.search_placeholder')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 bg-card border-border text-foreground"
          />
        </div>

        <select
          value={sourceFilter ?? ''}
          onChange={(e) => setSourceFilter(e.target.value || null)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground shrink-0"
        >
          <option value="">全部来源</option>
          {sources.map((src) => (
            <option key={src.id} value={src.id}>{src.name}</option>
          ))}
        </select>

        <select
          value={categoryFilter ?? ''}
          onChange={(e) => setCategoryFilter(e.target.value || null)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground shrink-0"
        >
          <option value="">全部分类</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground shrink-0" onClick={clearFilters}>
            清除筛选
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={handleScanAll}
          disabled={isScanning || sources.length === 0}
          className="gap-2 shrink-0 bg-muted text-foreground hover:bg-muted/80"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          扫描全部
        </Button>

        <SkillSourcesDrawer />
      </div>
    </div>
  );
}
