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
  
  // New Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [launchableFilter, setLaunchableFilter] = useState('all');
  
  const [isScanDrawerOpen, setIsScanDrawerOpen] = useState(false);
  const [showCandidates, setShowCandidates] = useState(true);
  const [showIgnored, setShowIgnored] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

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
    setScanMessage(null);
    try {
      const result = await scanSystemAgents();
      const parts: string[] = [];
      if (result.inserted_count > 0) parts.push('新增 ' + result.inserted_count);
      if (result.updated_count > 0) parts.push('更新 ' + result.updated_count);
      if (result.skipped_count > 0) parts.push('跳过 ' + result.skipped_count);
      if (result.errors.length > 0) {
        setScanMessage('发现 ' + result.discovered_count + ' 个客户端，' + parts.join('，') + '。' + result.errors.length + ' 个错误');
      } else if (parts.length > 0) {
        setScanMessage('发现 ' + result.discovered_count + ' 个客户端，' + parts.join('，'));
      } else {
        setScanMessage('发现 ' + result.discovered_count + ' 个客户端，无新增');
      }
    } catch (err) {
      setScanMessage('扫描失败: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const q = searchQuery.toLowerCase();
  
  const matches = (a: Agent) => {
    // 1. Search Query
    if (q) {
      const evidenceStr = a.evidence_json ? a.evidence_json.toLowerCase() : '';
      const matchedQuery = a.name.toLowerCase().includes(q) ||
        (a.agent_key || '').toLowerCase().includes(q) ||
        (a.type || '').toLowerCase().includes(q) ||
        (a.app_path || '').toLowerCase().includes(q) ||
        (a.cli_path || '').toLowerCase().includes(q) ||
        (a.config_path || '').toLowerCase().includes(q) ||
        (a.log_path || '').toLowerCase().includes(q) ||
        (a.bundle_id || '').toLowerCase().includes(q) ||
        evidenceStr.includes(q);
      if (!matchedQuery) return false;
    }
    
    // 2. Type Filter
    if (typeFilter !== 'all') {
      const aType = (a.type || '').toLowerCase();
      if (typeFilter === 'App' && aType !== 'app') return false;
      if (typeFilter === 'CLI' && aType !== 'cli') return false;
      if (typeFilter === 'ConfigOnly' && aType !== 'configonly') return false;
    }
    
    // 3. Confidence Filter
    if (confidenceFilter !== 'all') {
      if (a.confidence !== confidenceFilter) return false;
    }
    
    // 4. Launchable Filter
    if (launchableFilter !== 'all') {
      const isLaunchable = (a.type || '').toLowerCase() === 'app' && a.status === 'active' && !!a.app_path;
      if (launchableFilter === 'launchable' && !isLaunchable) return false;
      if (launchableFilter === 'unlaunchable' && isLaunchable) return false;
    }
    
    // 5. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && a.status !== 'active') return false;
      if (statusFilter === 'pending' && getAgentGroup(a) !== 'candidate') return false;
      if (statusFilter === 'ignored' && getAgentGroup(a) !== 'ignored') return false;
      if (statusFilter === 'broken' && a.status === 'broken') return false; 
    }

    return true;
  };

  // Three groups
  const confirmed = agents.filter(a => getAgentGroup(a) === 'confirmed' && matches(a));
  const candidates = agents.filter(a => getAgentGroup(a) === 'candidate' && matches(a));
  const ignored = agents.filter(a => getAgentGroup(a) === 'ignored' && matches(a));

  // Advanced Stats
  const totalCount = agents.length;
  const availableCount = agents.filter(a => a.status === 'active').length;
  const pendingCount = agents.filter(a => getAgentGroup(a) === 'candidate').length;
  const launchableCount = agents.filter(a => (a.type || '').toLowerCase() === 'app' && a.status === 'active' && !!a.app_path).length;
  const logAvailableCount = agents.filter(a => !!a.log_path).length;
  const errorCount = agents.filter(a => a.status === 'broken').length;
  
  const pinnedAgents = [...agents.filter(a => getAgentGroup(a) === 'confirmed')]
    .sort((a, b) => (b.launch_count || 0) - (a.launch_count || 0))
    .slice(0, 4);

  return (
    <div className="flex flex-col h-full bg-[#F7F7F8] relative overflow-hidden text-[#1F2328]">
      {scanMessage && (
        <div className={'px-4 py-2 text-xs border-b border-border ' + (scanMessage.includes('错误') || scanMessage.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600')}>
          {scanMessage}
          <button className='ml-2 text-muted-foreground hover:text-foreground' onClick={() => setScanMessage(null)}>x</button>
        </div>
      )}
      
      <AgentsToolbar 
        totalCount={totalCount}
        availableCount={availableCount}
        pendingCount={pendingCount}
        launchableCount={launchableCount}
        logAvailableCount={logAvailableCount}
        errorCount={errorCount}
        
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        confidenceFilter={confidenceFilter}
        setConfidenceFilter={setConfidenceFilter}
        launchableFilter={launchableFilter}
        setLaunchableFilter={setLaunchableFilter}
        
        onRefresh={fetchAgents}
        isLoading={isLoading}
        onDiscoverSystem={handleDiscoverSystem}
        onOpenScanDrawer={() => setIsScanDrawerOpen(true)}
      />

      <PinnedAgentsBar agents={pinnedAgents} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent List */}
        <div className="w-[440px] xl:w-[480px] flex-shrink-0 flex flex-col border-r border-[#E6E7EB] bg-white overflow-hidden shadow-sm z-0">
          <div className="flex-1 overflow-y-auto">
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
              <div className="flex flex-col items-center justify-center p-8 text-center text-[#8B8E98]">
                <ShieldCheck className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm mb-4">尚未确认任何符合条件的 Agent</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDiscoverSystem}>自动发现</Button>
                  <Button size="sm" onClick={() => setIsScanDrawerOpen(true)}>扫描目录</Button>
                </div>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="border-t border-[#E6E7EB]">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-[#8B8E98] hover:bg-gray-50 transition-colors"
                  onClick={() => setShowCandidates(!showCandidates)}
                >
                  {showCandidates ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
                  待确认候选 ({candidates.length})
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

            {ignored.length > 0 && (
              <div className="border-t border-[#E6E7EB]">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-[#8B8E98] hover:bg-gray-50 transition-colors"
                  onClick={() => setShowIgnored(!showIgnored)}
                >
                  {showIgnored ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <EyeOff className="w-3.5 h-3.5 text-[#8B8E98]" />
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

        {/* Right: Detail Inspector */}
        <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
          <AgentDetailInspector 
            agent={selectedAgent} 
            onDiscoverSystem={handleDiscoverSystem}
            onOpenScanDrawer={() => setIsScanDrawerOpen(true)}
          />
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
  const confidenceColor = agent.confidence === 'verified' ? 'text-[#22C55E]' : agent.confidence === 'probable' ? 'text-[#F59E0B]' : 'text-[#8B8E98]';

  return (
    <div
      onClick={() => onSelect(agent)}
      className={`relative flex items-center p-3 border-b border-[#E6E7EB]/50 cursor-pointer transition-colors min-h-[72px]
        ${isSelected ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 border-l-2 border-l-transparent'}
      `}
    >
      <div className="min-w-0 flex-1 ml-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-[#1F2328] truncate">{agent.name}</span>
          <span className="text-[10px] uppercase text-[#8B8E98] bg-gray-100 px-1.5 py-0.5 rounded font-medium">{agent.type || 'Agent'}</span>
          <span className={`text-[10px] font-medium bg-white border shadow-sm px-1.5 py-0.5 rounded ${confidenceColor}`}>{confidenceLabel}</span>
        </div>
        {evidence.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {evidence.slice(0, 2).map((ev, i) => (
              <span key={i} className="text-[10px] text-[#8B8E98] bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                {ev}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 mr-2">
        {agent.is_ignored ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-[#8B8E98]" onClick={(e) => { e.stopPropagation(); onConfirm(agent.id); }}>
            恢复
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-[#22C55E] hover:text-green-700 hover:bg-green-50" onClick={(e) => { e.stopPropagation(); onConfirm(agent.id); }}>
              <Check className="w-3.5 h-3.5 mr-1" /> 确认
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-[#8B8E98] hover:text-[#EF4444] hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onIgnore(agent.id); }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
