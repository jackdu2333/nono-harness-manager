import { Box, RefreshCw, ScanLine, Search, Folders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';

interface Props {
  totalCount: number;
  activeCount: number;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onDiscoverSystem: () => void;
  onOpenScanDrawer: () => void;
}

export function MCPToolbar({
  totalCount, activeCount, searchQuery, setSearchQuery,
  onRefresh, isLoading, onDiscoverSystem, onOpenScanDrawer
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm z-10 px-6 py-4 flex flex-col gap-4">
      {/* Top Row: Title, Stats, and Action Buttons */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">

        {/* Title and Stats */}
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Box className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('mcp.title')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('mcp.description')}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-4 ml-6 pl-6 border-l border-border h-8 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">Total</span>
              <span className="font-medium text-foreground leading-none">{totalCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-success text-[10px] uppercase font-semibold">Active</span>
              <span className="font-medium text-foreground leading-none">{activeCount}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={onOpenScanDrawer} className="gap-2 shadow-sm">
            <Folders className="w-4 h-4" /> {t('mcp.scan_dir')}
          </Button>
          <Button onClick={onDiscoverSystem} variant="secondary" disabled={isLoading} className="gap-2 shadow-sm">
            <ScanLine className="w-4 h-4 text-primary" /> {t('mcp.auto_discover')}
          </Button>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading} className="shadow-sm">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Bottom Row: Search and Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-[300px] max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('mcp.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-secondary/30 border-border/50 text-sm focus-visible:ring-1"
          />
        </div>
      </div>
    </div>
  );
}
