import { useState } from 'react';
import { Agent } from '../types';
import { Box, Play, CheckCircle2, ScanLine, FolderSearch, Settings, ExternalLink } from 'lucide-react';
import { AgentOverviewTab } from './tabs/AgentOverviewTab';
import { AgentLaunchTab } from './tabs/AgentLaunchTab';
import { AgentResourcesTab } from './tabs/AgentResourcesTab';
import { AgentUsageTab } from './tabs/AgentUsageTab';
import { AgentHealthTab } from './tabs/AgentHealthTab';
import { getAgentBrandStyles } from '../utils/brandStyles';
import { useAgentsStore } from '../store';
import { Button } from '@/components/ui/button';
import { isAgentLaunchable } from '../utils/launchability';
import { useTranslation } from 'react-i18next';

interface Props {
  agent: Agent | null;
  onDiscoverSystem?: () => void;
  onOpenScanDrawer?: () => void;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'launch', label: 'Launch' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'resources', label: 'Resources' },
  { id: 'usage', label: 'Usage' },
  { id: 'health', label: 'Health' },
];

export function AgentDetailInspector({ agent, onDiscoverSystem, onOpenScanDrawer }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const launchAgent = useAgentsStore(s => s.launchAgent);
  const openConfigDir = useAgentsStore(s => s.openConfigDir);

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-background text-foreground">
        <div className="bg-card p-8 rounded-2xl shadow-sm border border-border max-w-md w-full flex flex-col items-center text-center">
          <Box className="w-12 h-12 mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-bold mb-2">{t('agents.not_selected')}</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {t('agents.not_selected_desc')}
          </p>
          
          <div className="w-full bg-muted/50 rounded-xl p-4 mb-8 border border-border">
            <div className="grid grid-cols-2 gap-3 text-sm text-foreground text-left">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> {t('agents.tab_launch')}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> {t('agents.tab_evidence')}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> {t('agents.tab_config')}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> {t('agents.tab_resources')}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> {t('agents.tab_logs')}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> {t('agents.tab_health')}</div>
            </div>
          </div>
          
          <div className="flex gap-3 w-full">
            <Button onClick={onDiscoverSystem} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <ScanLine className="w-4 h-4" /> {t('common.auto_discover')}
            </Button>
            <Button onClick={onOpenScanDrawer} variant="outline" className="flex-1 gap-2 border-border hover:bg-muted/50">
              <FolderSearch className="w-4 h-4" /> {t('common.scan_dir')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const brand = getAgentBrandStyles(agent.name, agent.type);
  const Icon = brand.Icon;
  const isLaunchable = isAgentLaunchable(agent);
  
  const typeDesc = agent.type === 'CLI' ? t('agents.type_cli_client') : agent.type === 'IDE Plugin' ? t('agents.type_editor_plugin') : t('agents.type_desktop');
  const desc = agent.description || typeDesc;
  const hasConfig = !!agent.config_path;

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return <AgentOverviewTab agent={agent} />;
      case 'launch': return <AgentLaunchTab agent={agent} />;
      case 'evidence': return <EvidenceTabContent agent={agent} />;
      case 'resources': return <AgentResourcesTab />;
      case 'usage': return <AgentUsageTab agent={agent} />;
      case 'health': return <AgentHealthTab agent={agent} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden text-foreground">
      {/* Header */}
      <div className="flex-shrink-0 pt-8 px-8 border-b border-border bg-muted/30">
        {/* Top Summary */}
        <div className="flex items-start gap-5 mb-6">
          <div className={`p-4 rounded-2xl flex items-center justify-center w-20 h-20 shrink-0 ${brand.bgClass} shadow-sm border border-border/50`}>
            {brand.imgSrc ? (
              <img src={brand.imgSrc} alt={agent.name} className="w-12 h-12 object-contain" />
            ) : (
              Icon && <Icon className={`w-12 h-12 ${brand.textClass}`} />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-3 mb-2 min-w-0">
              <h2 className="text-2xl font-bold tracking-tight truncate max-w-full" title={agent.name}>{agent.name}</h2>
              
              <span className="text-xs uppercase font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                {agent.type || 'Agent'}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border shadow-sm ${agent.status === 'active' ? 'bg-success/10 text-success border-success/30' : agent.status === 'broken' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-muted text-muted-foreground border-border'}`}>
                {agent.status || 'Unknown'}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border shadow-sm ${agent.confidence === 'verified' ? 'bg-success/10 text-success border-success/30' : agent.confidence === 'probable' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-card text-muted-foreground border-border'}`}>
                {agent.confidence === 'verified' ? 'Verified' : agent.confidence === 'probable' ? 'Probable' : 'Candidate'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl">
              {desc}
            </p>
          </div>
          
          <div className="shrink-0 flex flex-col gap-2">
            <Button 
               size="sm" 
               className={`gap-1.5 h-9 w-32 shadow-sm ${isLaunchable ? 'bg-primary text-primary-foreground hover:bg-primary' : 'bg-primary/10 text-primary/50'}`} 
               onClick={() => launchAgent(agent.id)} 
               disabled={!isLaunchable}
            >
              <Play className="w-3.5 h-3.5 fill-current" /> <span className="font-semibold">{t('agents.launch')}</span>
            </Button>
            <Button 
               size="sm" 
               variant="outline"
               className="gap-1.5 h-9 w-32 border-border hover:bg-muted/50 shadow-sm text-foreground" 
               onClick={() => openConfigDir(agent.id)} 
               disabled={!hasConfig}
            >
              <Settings className="w-3.5 h-3.5" /> <span className="font-semibold">{t('agents.open_config')}</span>
            </Button>
            <Button 
               size="sm" 
               variant="outline"
               className="gap-1.5 h-9 w-32 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary shadow-sm" 
            >
              <ExternalLink className="w-3.5 h-3.5" /> <span className="font-semibold">{t('agents.codex_analysis')}</span>
            </Button>
          </div>
        </div>

        {/* Key Facts Card */}
        <div className="bg-card rounded-xl border border-border shadow-sm mb-6 p-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t('agents.key_facts')}</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <FactItem label={t('agents.fact_launch')} value={agent.type === 'App' ? t('agents.gui_app') : agent.type === 'CLI' ? t('agents.cli_command') : t('agents.no_launch_needed')} />
            <FactItem label={t('agents.fact_source')} value={agent.detection_source || 'Unknown'} />
            <FactItem label={t('agents.fact_discovered')} value={agent.last_detected_at ? new Date(agent.last_detected_at).toLocaleString() : t('common.unknown')} />
            <FactItem label={t('agents.fact_log_support')} value={agent.log_path ? t('agents.log_supported') : t('agents.log_not_supported')} />
            
            <FactItem label="Bundle ID" value={agent.bundle_id || '-'} fullWidth />
            {agent.app_path && <FactItem label="App Path" value={agent.app_path} fullWidth />}
            {agent.cli_path && <FactItem label="CLI Path" value={agent.cli_path} fullWidth />}
            <FactItem label="Config Path" value={agent.config_path || '-'} fullWidth />
            <FactItem label="Log Path" value={agent.log_path || '-'} fullWidth />
          </div>
        </div>

        {/* Custom Tabs Navigation */}
        <div className="flex items-center gap-8 px-2">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 text-sm font-semibold transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_8px_hsl(var(--primary)/0.4)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-card">
        {renderTabContent()}
      </div>
    </div>
  );
}

function FactItem({ label, value, fullWidth = false }: { label: string, value: string, fullWidth?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${fullWidth ? 'col-span-2 lg:col-span-4' : ''}`}>
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="font-mono text-foreground bg-muted/50 px-2 py-1 rounded border border-border truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

// Sub-component for Evidence Tab
function EvidenceTabContent({ agent }: { agent: Agent }) {
  const { t } = useTranslation();
  const evidence: string[] = (() => {
    try { return agent.evidence_json ? JSON.parse(agent.evidence_json).signals || [] : []; }
    catch { return []; }
  })();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h3 className="text-lg font-bold mb-1">{t('agents.evidence_title')}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t('agents.evidence_desc')}</p>
        
        {evidence.length === 0 ? (
          <div className="p-4 bg-muted/50 text-muted-foreground text-sm rounded-lg border border-border">
            {t('agents.no_evidence')}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="divide-y divide-border">
              {evidence.map((ev, index) => {
                // Determine icon based on evidence content
                let icon = <CheckCircle2 className="w-4 h-4 text-primary" />;
                if (ev.includes('置信度')) icon = <CheckCircle2 className="w-4 h-4 text-success" />;
                
                return (
                  <div key={index} className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <div className="flex-1 font-mono text-sm text-foreground break-words">
                      {ev}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-primary/10 text-primary p-4 rounded-lg border border-primary/30">
        <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
          {t('agents.confidence_reason')}
        </h4>
        <p className="text-xs">
          <strong>{agent.confidence === 'verified' ? t('agents.verified_full') : agent.confidence === 'probable' ? t('agents.probable_full') : t('agents.candidate_full')}</strong>。
          {t('agents.confidence_desc')}
        </p>
      </div>
    </div>
  );
}
