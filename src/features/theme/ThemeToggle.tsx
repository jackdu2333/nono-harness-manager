import { Moon, Sun, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-0">
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
          <span>{t('theme.system')}</span>
          {themeMode === 'system' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeMode('light')} className="gap-2 cursor-pointer">
          <Sun className="h-4 w-4" />
          <span>{t('theme.light')}</span>
          {themeMode === 'light' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeMode('dark')} className="gap-2 cursor-pointer">
          <Moon className="h-4 w-4" />
          <span>{t('theme.dark')}</span>
          {themeMode === 'dark' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
