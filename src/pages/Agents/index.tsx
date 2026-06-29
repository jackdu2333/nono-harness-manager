import React, { useEffect, useState } from 'react';
import { useAgentsStore } from '@/features/agents/store';
import { Agent, getAgentGroup } from '@/features/agents/types';
import { AgentsToolbar } from '@/features/agents/components/AgentsToolbar';
import { PinnedAgentsBar } from '@/features/agents/components/PinnedAgentsBar';
import { AgentList } from '@/features/agents/components/AgentList';
import { AgentDetailInspector } from '@/features/agents/components/AgentDetailInspector';
import { AgentScanDrawer } from '@/features/agents/components/AgentScanDrawer';
import { Button } from '@/components/ui/button';
import { Check, X, ChevronDown, ChevronRight, ShieldCheck, AlertCircle, EyeOff } from 'lucide-react';

export default function AgentsPage() {
  const { agents, isLoading, isScanning, fetchAgents, scanAgents, scanSystemAgents, confirmCandidate, ignoreCandidate } = useAgentsStore();
  
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanDrawerOpen, setIsScanDrawerOpen] = useState(false);
  const [showCandidates, setShowCandidates] = useState(true);
  const [showIgnored, setShowIgnored] = useState(false);

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

  const q = searchQuery.toLowerCase();
  const matches = (a: Agent) =>
    a.name.toLowerCase().includes(q) ||
    (a.type || '').toLowerCase().includes(q) ||
    (a.app_path || '').toLowerCase().includes(q) ||
    (a.config_path || '').toLowerCase().includes(q);

  // Three groups
  const confirmed = agents.filter(a => getAgentGroup(a) === 'confirmed' && matches(a));
  const candidates = agents.filter(a => getAgentGroup(a) === 'candidate' && matches(a));
  const ignored = agents.filter(a => getAgentGroup(a) === 'ignored' && matches(a));

  const activeCount = confirmed.length;
  const cliCount = confirmed.filter(a => (a.type || '').toLowerCase().includes('cli')).length;
  const appCount = confirmed.filter(a => (a.type || '').toLowerCase().includes('app')).length;
  
  const pinnedAgents = [...confirmed]
    .sort((a, b) => (b.launch_count || 0) - (a.launch_count || 0))
    .slice(0, 4);

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
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

      <PinnedAgentsBar agents={pinnedAgents} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent List with three sections */}
        <div className="w-[55%] flex-shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Confirmed section */}
            {confirmed.length > 0 && (
              <AgentList 
                agents={confirmed}
                selectedId={selectedAgent?.id}
                onSelect={setSelectedAgent}
                isScanning={isScanning}
                onOpenScanDrawer={() => setIsScanDrawerOpen(true)}
                onDiscoverSystem={handleDiscoverSystem}
              />
            )}

            {confirmed.length === 0 && !isScanning && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <ShieldCheck className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm mb-4">尚未确认任何 Agent 客户端</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDiscoverSystem}>自动发现</Button>
                  <Button size="sm" onClick={() => setIsScanDrawerOpen(true)}>扫描目录</Button>
                </div>
              </div>
            )}

            {/* Candidates section */}
            {candidates.length > 0 && (
              <div className="border-t border-border/50">
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary/10"
                  onClick={() => setShowCandidates(!showCandidates)}
                >
                  {showCandidates ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                  待确认 ({candidates.length})
                </button>
                {showCandidates && (
                  <div className="pb-2">
                    {candidates.map(agent => (
                      <CandidateRow
                        key={agent.id}
                        agent={agent}
                        isSelected={selectedAgent?.id === agent.id}
                        onSelect={setSelectedAgent}
                        onConfirm={confirmCandidate}
                        onIgnore={ignoreCandidate}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ignored section */}
            {ignored.length > 0 && (
              <div className="border-t border-border/50">
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary/10"
                  onClick={() => setShowIgnored(!showIgnored)}
                >
                  {showIgnored ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
                  已忽略 ({ignored.length})
                </button>
                {showIgnored && (
                  <div className="pb-2 opacity-60">
                    {ignored.map(agent => (
                      <CandidateRow
                        key={agent.id}
                        agent={agent}
                        isSelected={selectedAgent?.id === agent.id}
                        onSelect={setSelectedAgent}
                        onConfirm={confirmCandidate}
                        onIgnore={ignoreCandidate}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Inspector (45%) */}
        <div className="w-[45%] flex-shrink-0 flex flex-col bg-card/30 overflow-hidden">
          <AgentDetailInspector agent={selectedAgent} />
        </div>
      </div>

      <AgentScanDrawer 
        open={isScanDrawerOpen}
        onOpenChange={setIsScanDrawerOpen}
        onScan={handleScanDir}
        isScanning={isScanning}
      />
    </div>
  );
}

// Candidate / Ignored row component with confirm/ignore actions
function CandidateRow({ agent, isSelected, onSelect, onConfirm, onIgnore }: {
  agent: Agent;
  isSelected: boolean;
  onSelect: (a: Agent) => void;
  onConfirm: (id: string) => Promise<void>;
  onIgnore: (id: string) => Promise<void>;
}) {
  const evidence: string[] = (() => {
    try { return agent.evidence_json ? JSON.parse(agent.evidence_json).signals || [] : []; }
    catch { return []; }
  })();

  const confidenceLabel = agent.confidence === 'verified' ? '已验证' : agent.confidence === 'probable' ? '推断' : '候选';
  const confidenceColor = agent.confidence === 'verified' ? 'text-green-600' : agent.confidence === 'probable' ? 'text-yellow-600' : 'text-muted-foreground';

  return (
    <div
      onClick={() => onSelect(agent)}
      className={`relative flex items-center p-3 border-b border-border/30 cursor-pointer transition-colors min-h-[72px]
        ${isSelected ? 'bg-secondary/20 border-l-2 border-l-primary' : 'hover:bg-secondary/5 border-l-2 border-l-transparent'}
      `}
    >
      <div className="min-w-0 flex-1 ml-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground truncate">{agent.name}</span>
          <span className="text-[10px] uppercase text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{agent.type || 'Agent'}</span>
          <span className={`text-[10px] font-medium ${confidenceColor}`}>{confidenceLabel}</span>
        </div>
        {evidence.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {evidence.slice(0, 2).map((ev, i) => (
              <span key={i} className="text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                {ev}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 mr-2">
        {agent.is_ignored ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onConfirm(agent.id); }}>
            恢复
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600 hover:text-green-700" onClick={(e) => { e.stopPropagation(); onConfirm(agent.id); }}>
              <Check className="w-3.5 h-3.5 mr-1" /> 确认
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-red-600" onClick={(e) => { e.stopPropagation(); onIgnore(agent.id); }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
