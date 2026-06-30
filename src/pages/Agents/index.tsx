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
import { useTranslation } from 'react-i18next';

export default function AgentsPage() {
  const { t } = useTranslation();
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
      if (result.errors.length > 0) {
        const parts: string[] = [];
        if (result.inserted_count > 0) parts.push(t('agents.scan_msg_new', { total: result.discovered_count, added: result.inserted_count }));
        setScanMessage(t('agents.scan_msg_error_count', { total: result.discovered_count, count: result.errors.length }));
      } else if (result.inserted_count > 0) {
        setScanMessage(t('agents.scan_msg_new', { total: result.discovered_count, added: result.inserted_count }));
      } else if (result.updated_count > 0) {
        setScanMessage(t('agents.scan_msg_update', { total: result.discovered_count, updated: result.updated_count }));
      } else if (result.skipped_count > 0) {
        setScanMessage(t('agents.scan_msg_skip', { total: result.discovered_count, skipped: result.skipped_count }));
      } else {
        setScanMessage(t('agents.scan_msg_no_new', { total: result.discovered_count }));
      }
    } catch (err) {
      setScanMessage(t('agents.scan_msg_error', { error: err instanceof Error ? err.message : String(err) }));
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
      if (statusFilter === 'broken' && a.status !== 'broken') return false; 
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
    <div className="flex flex-col h-full w-full min-w-0 bg-background relative overflow-hidden text-foreground">
      {scanMessage && (
        <div className={'px-4 py-2 text-xs border-b border-border ' + (scanMessage.includes('错误') || scanMessage.includes('失败') ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
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

      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Left: Agent List */}
        <div className="w-[440px] xl:w-[480px] flex-shrink-0 flex flex-col border-r border-border bg-card overflow-hidden shadow-sm z-0">
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
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <ShieldCheck className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm mb-4">{t('agents.no_candidates')}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDiscoverSystem}>{t('common.auto_discover')}</Button>
                  <Button size="sm" onClick={() => setIsScanDrawerOpen(true)}>{t('common.scan_dir')}</Button>
                </div>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="border-t border-border">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setShowCandidates(!showCandidates)}
                >
                  {showCandidates ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <AlertCircle className="w-3.5 h-3.5 text-warning" />
                  {t('agents.candidates_title', { count: candidates.length })}
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
              <div className="border-t border-border">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setShowIgnored(!showIgnored)}
                >
                  {showIgnored ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('agents.ignored_title', { count: ignored.length })}
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
        <div className="flex-1 min-w-0 flex flex-col bg-transparent overflow-hidden">
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
  const { t } = useTranslation();
  const evidence: string[] = (() => {
    try { return agent.evidence_json ? JSON.parse(agent.evidence_json).signals || [] : []; }
    catch { return []; }
  })();

  const confidenceLabel = agent.confidence === 'verified' ? t('agents.verified') : agent.confidence === 'probable' ? t('agents.probable') : t('agents.candidate');
  const confidenceColor = agent.confidence === 'verified' ? 'text-success' : agent.confidence === 'probable' ? 'text-warning' : 'text-muted-foreground';

  return (
    <div
      onClick={() => onSelect(agent)}
      className={`relative flex items-center p-3 border-b border-border/50 cursor-pointer transition-colors min-h-[72px]
        ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50 border-l-2 border-l-transparent'}
      `}
    >
      <div className="min-w-0 flex-1 ml-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground truncate">{agent.name}</span>
          <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">{agent.type || 'Agent'}</span>
          <span className={`text-[10px] font-medium bg-card border shadow-sm px-1.5 py-0.5 rounded ${confidenceColor}`}>{confidenceLabel}</span>
        </div>
        {evidence.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {evidence.slice(0, 2).map((ev, i) => (
              <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">
                {ev}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 mr-2">
        {agent.is_ignored ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); onConfirm(agent.id); }}>
            {t('common.restore')}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-success hover:text-success hover:bg-success/10" onClick={(e) => { e.stopPropagation(); onConfirm(agent.id); }}>
              <Check className="w-3.5 h-3.5 mr-1" /> {t('common.confirm')}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onIgnore(agent.id); }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
