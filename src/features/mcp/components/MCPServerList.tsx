import React from 'react';
import { McpServer } from '../types';
import { MCPServerListItem } from './MCPServerListItem';
import { Box, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface Props {
  servers: McpServer[];
  selectedId?: string;
  onSelect: (server: McpServer) => void;
  onOpenScanDrawer: () => void;
  onDiscoverSystem: () => void;
  isScanning: boolean;
}

export function MCPServerList({ servers, selectedId, onSelect, onOpenScanDrawer, onDiscoverSystem, isScanning }: Props) {
  const { t } = useTranslation();

  if (servers.length === 0 && !isScanning) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Box className="w-16 h-16 mb-4 opacity-50 text-muted-foreground/50" />
        <h3 className="text-xl font-medium text-foreground mb-2">{t('mcp.no_servers_title')}</h3>
        <p className="text-sm max-w-sm mb-6">
          {t('mcp.no_servers_hint')}
        </p>
        <div className="flex gap-3">
          <Button onClick={onOpenScanDrawer}>{t('mcp.scan_dir')}</Button>
          <Button variant="secondary" onClick={onDiscoverSystem}>{t('mcp.auto_discover')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative bg-card">
      {/* Loading Overlay for Scanning */}
      {isScanning && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="bg-card p-4 rounded-xl shadow-lg border border-border flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-medium">Scanning for MCP servers...</span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col">
          {servers.map(server => (
            <MCPServerListItem
              key={server.id}
              server={server}
              isSelected={server.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
