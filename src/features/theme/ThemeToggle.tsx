import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeStore } from './themeStore';

export function ThemeToggle() {
  const { themeMode, setThemeMode } = useThemeStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-zinc-400 hover:text-foreground hover:bg-zinc-800/50 dark:hover:bg-zinc-800 focus-visible:ring-0">
          {themeMode === 'light' ? (
            <Sun className="h-4 w-4" />
          ) : themeMode === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border-border">
        <DropdownMenuItem onClick={() => setThemeMode('system')} className="gap-2 cursor-pointer">
          <Monitor className="h-4 w-4" />
          <span>跟随系统</span>
          {themeMode === 'system' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeMode('light')} className="gap-2 cursor-pointer">
          <Sun className="h-4 w-4" />
          <span>浅色</span>
          {themeMode === 'light' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeMode('dark')} className="gap-2 cursor-pointer">
          <Moon className="h-4 w-4" />
          <span>深色</span>
          {themeMode === 'dark' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
