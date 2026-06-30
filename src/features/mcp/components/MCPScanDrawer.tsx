import React, { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderSearch, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (path: string) => Promise<void>;
  isScanning: boolean;
}

export function MCPScanDrawer({ open, onOpenChange, onScan, isScanning }: Props) {
  const { t } = useTranslation();
  const [scanPath, setScanPath] = useState('');

  const handleScan = async () => {
    if (!scanPath.trim()) return;
    await onScan(scanPath);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderSearch className="w-5 h-5 text-primary" />
            {t('mcp.scan_title')}
          </SheetTitle>
          <SheetDescription>
            {t('mcp.scan_desc')}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('common.dir_path')}</label>
            <Input
              value={scanPath}
              onChange={(e) => setScanPath(e.target.value)}
              placeholder={t('mcp.scan_example')}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              autoFocus
            />
          </div>
          {/* Placeholder for Scan Depth or Directory Picker if added in future */}
        </div>

        <SheetFooter className="sm:justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isScanning}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleScan} disabled={!scanPath.trim() || isScanning}>
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('common.scanning')}
              </>
            ) : (
              t('common.start_scan')
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
