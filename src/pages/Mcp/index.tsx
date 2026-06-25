import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMcpStore } from '@/features/mcp/store';
import { McpServer } from '@/features/mcp/types';
import { MCPToolbar } from '@/features/mcp/components/MCPToolbar';
import { MCPServerList } from '@/features/mcp/components/MCPServerList';
import { MCPDetailInspector } from '@/features/mcp/components/MCPDetailInspector';
import { MCPScanDrawer } from '@/features/mcp/components/MCPScanDrawer';

export default function McpPage() {
  const { t } = useTranslation();
  const { servers, isLoading, isScanning, fetchServers, scanDir, discoverSystem } = useMcpStore();
  
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanDrawerOpen, setIsScanDrawerOpen] = useState(false);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    if (selectedServer) {
      const updated = servers.find(s => s.id === selectedServer.id);
      if (updated) setSelectedServer(updated);
      else setSelectedServer(null);
    }
  }, [servers, selectedServer]);

  const handleScanDir = async (path: string) => {
    await scanDir(path);
  };

  const handleDiscoverSystem = async () => {
    await discoverSystem();
  };

  const filteredServers = servers.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q)
    );
  });

  const activeCount = servers.filter(s => (s.status || '').toLowerCase() === 'active').length;

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Toolbar */}
      <MCPToolbar 
        totalCount={servers.length}
        activeCount={activeCount}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={fetchServers}
        isLoading={isLoading}
        onDiscoverSystem={handleDiscoverSystem}
        onOpenScanDrawer={() => setIsScanDrawerOpen(true)}
      />

      {/* Main Content Area: Split View 55/45 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Server List (55%) */}
        <div className="w-[55%] flex-shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
          <MCPServerList 
            servers={filteredServers}
            selectedId={selectedServer?.id}
            onSelect={setSelectedServer}
            isScanning={isScanning}
            onOpenScanDrawer={() => setIsScanDrawerOpen(true)}
            onDiscoverSystem={handleDiscoverSystem}
          />
        </div>

        {/* Right: Detail Inspector (45%) */}
        <div className="w-[45%] flex-shrink-0 flex flex-col bg-card/30 overflow-hidden">
          <MCPDetailInspector server={selectedServer} />
        </div>
      </div>

      {/* Drawer */}
      <MCPScanDrawer 
        open={isScanDrawerOpen}
        onOpenChange={setIsScanDrawerOpen}
        onScan={handleScanDir}
        isScanning={isScanning}
      />
    </div>
  );
}
