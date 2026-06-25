import { useSkillsStore } from '../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SkillSourcesDrawer } from './SkillSourcesDrawer';

export function SkillsToolbar({ globalFilter, setGlobalFilter }: { globalFilter: string, setGlobalFilter: (s: string) => void }) {
  const { t } = useTranslation();
  const { skills, isScanning, sources, scanSource } = useSkillsStore();

  const handleScanAll = async () => {
    for (const source of sources) {
      await scanSource(source.id);
    }
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

      <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
        <div className="relative w-full min-w-[200px] max-w-sm lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t('skills.search_placeholder')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 bg-card border-border text-foreground"
          />
        </div>

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
