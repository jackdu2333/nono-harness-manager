import React, { useEffect, useState } from 'react';
import { useAgentsStore } from '@/features/agents/store';
import { Agent } from '@/features/agents/types';
import { AgentsToolbar } from '@/features/agents/components/AgentsToolbar';
import { PinnedAgentsBar } from '@/features/agents/components/PinnedAgentsBar';
import { AgentList } from '@/features/agents/components/AgentList';
import { AgentDetailInspector } from '@/features/agents/components/AgentDetailInspector';
import { AgentScanDrawer } from '@/features/agents/components/AgentScanDrawer';

export default function AgentsPage() {
  const { agents, isLoading, isScanning, fetchAgents, scanAgents, scanSystemAgents } = useAgentsStore();
  
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanDrawerOpen, setIsScanDrawerOpen] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find(s => s.id === selectedAgent.id);
      if (updated) setSelectedAgent(updated);
      else setSelectedAgent(null);
    }
  }, [agents, selectedAgent]);

  const handleScanDir = async (path: string) => {
    await scanAgents(path);
  };

  const handleDiscoverSystem = async () => {
    await scanSystemAgents();
  };

  const filteredAgents = agents.filter(a => {
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.type || '').toLowerCase().includes(q) ||
      (a.app_path || '').toLowerCase().includes(q) ||
      (a.config_path || '').toLowerCase().includes(q)
    );
  });

  const activeCount = agents.filter(a => (a.status || '').toLowerCase() === 'active').length;
  const cliCount = agents.filter(a => (a.type || '').toLowerCase().includes('cli')).length;
  const appCount = agents.filter(a => (a.type || '').toLowerCase().includes('app')).length;
  
  // Pinned agents: first 4 active agents, or just the first 4 if none are active
  const pinnedAgents = [...agents]
    .sort((a, b) => (b.launch_count || 0) - (a.launch_count || 0))
    .slice(0, 4);

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Toolbar */}
      <AgentsToolbar 
        totalCount={agents.length}
        activeCount={activeCount}
        cliCount={cliCount}
        appCount={appCount}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={fetchAgents}
        isLoading={isLoading}
        onDiscoverSystem={handleDiscoverSystem}
        onOpenScanDrawer={() => setIsScanDrawerOpen(true)}
      />

      {/* Pinned Launch Bar */}
      <PinnedAgentsBar agents={pinnedAgents} />

      {/* Main Content Area: Split View 55/45 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent List (55%) */}
        <div className="w-[55%] flex-shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
          <AgentList 
            agents={filteredAgents}
            selectedId={selectedAgent?.id}
            onSelect={setSelectedAgent}
            isScanning={isScanning}
            onOpenScanDrawer={() => setIsScanDrawerOpen(true)}
            onDiscoverSystem={handleDiscoverSystem}
          />
        </div>

        {/* Right: Detail Inspector (45%) */}
        <div className="w-[45%] flex-shrink-0 flex flex-col bg-card/30 overflow-hidden">
          <AgentDetailInspector agent={selectedAgent} />
        </div>
      </div>

      {/* Drawer */}
      <AgentScanDrawer 
        open={isScanDrawerOpen}
        onOpenChange={setIsScanDrawerOpen}
        onScan={handleScanDir}
        isScanning={isScanning}
      />
    </div>
  );
}
