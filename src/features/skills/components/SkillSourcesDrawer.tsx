import { useState } from 'react';
import { useSkillsStore } from '../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RefreshCw, Plus, Trash2, FolderOpen, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SkillSourcesDrawer() {
  const { sources, addSource, deleteSource, scanSource, isScanning } = useSkillsStore();
  const [newPath, setNewPath] = useState('');
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleAdd = async () => {
    if (!newPath.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
    const finalName = newName.trim() || newPath.split('/').filter(Boolean).pop() || '自定义资源库';
    await addSource(finalName, newPath.trim(), 'local_dir', 3);
    setNewPath('');
    setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleDiscover = async () => {
    setError(null);
    try {
    await addSource('Default Skills', '~/.agents/skills', 'local_dir', 3);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground bg-card gap-2 shrink-0 shadow-sm transition-all hover:shadow">
          <Settings className="w-4 h-4" />
          管理资源库 ({sources.length})
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px] bg-background/95 backdrop-blur-xl border-l border-border/40 text-foreground flex flex-col p-0 shadow-2xl">
        <div className="p-6 border-b border-border/40 shrink-0 bg-muted/20">
          <SheetHeader className="mb-6 text-left">
            <SheetTitle className="text-foreground flex items-center gap-2 text-xl font-semibold tracking-tight">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              {t('skills.sources_title')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              管理技能资源库：添加、扫描或删除目录。
            </SheetDescription>
          </SheetHeader>

          <Button onClick={handleDiscover} variant="outline" disabled={isAdding} className="w-full justify-center gap-2 border-border/50 text-muted-foreground hover:text-foreground mb-6 bg-card/50 shadow-sm hover:bg-card transition-all">
            <Search className="w-4 h-4" /> {t('skills.discover_default')}
          </Button>

          <div className="space-y-4">
            <div className="space-y-2">
              <Input 
                placeholder={t('skills.name_placeholder')} 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                className="bg-card/50 border-border/50 text-foreground w-full shadow-inner transition-colors focus:bg-card"
              />
            </div>
            <div className="flex gap-2">
              <Input 
                placeholder={t('skills.path_placeholder')} 
                value={newPath} 
                onChange={(e) => setNewPath(e.target.value)}
                className="bg-card/50 border-border/50 text-foreground flex-1 min-w-0 shadow-inner transition-colors focus:bg-card"
              />
              <Button onClick={handleAdd} variant="secondary" disabled={isAdding || !newPath.trim()} className="gap-2 shrink-0 shadow-sm">
                <Plus className="w-4 h-4" /> {t('skills.add_source')}
              </Button>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-auto p-6 space-y-3 bg-background/50">
          {sources.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">{t('skills.no_sources')}</div>
          ) : (
            sources.map(source => (
              <div key={source.id} className="flex items-center justify-between bg-card/60 p-3.5 rounded-xl border border-border/40 shadow-sm hover:shadow-md hover:bg-card transition-all group">
                <div className="overflow-hidden pr-2 flex-1">
                  <div className="font-medium text-foreground truncate">{source.name}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={source.path}>{source.path}</div>
                  {source.last_scanned_at && (
                     <div className="text-[10px] text-muted-foreground/50 mt-1.5 font-medium tracking-wide">上次扫描: {new Date(source.last_scanned_at).toLocaleString()}</div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 border-border/50 text-muted-foreground hover:text-foreground bg-background/50 hover:bg-background shadow-sm transition-all"
                    onClick={() => scanSource(source.id)}
                    disabled={isScanning || isAdding}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="destructive"
                    className="h-8 w-8 opacity-90 hover:opacity-100 shadow-sm transition-all"
                    onClick={() => deleteSource(source.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
