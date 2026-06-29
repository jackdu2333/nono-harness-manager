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
  const [activeTab, setActiveTab] = useState('overview');
  const launchAgent = useAgentsStore(s => s.launchAgent);
  const openConfigDir = useAgentsStore(s => s.openConfigDir);

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#F7F7F8] text-[#1F2328]">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#E6E7EB] max-w-md w-full flex flex-col items-center text-center">
          <Box className="w-12 h-12 mb-4 text-[#8B8E98]/50" />
          <h3 className="text-xl font-bold mb-2">未选择 Agent</h3>
          <p className="text-sm text-[#8B8E98] mb-6">
            请选择左侧客户端查看启动方式、配置路径、日志路径、识别证据、绑定资源和健康诊断。
          </p>
          
          <div className="w-full bg-gray-50 rounded-xl p-4 mb-8 border border-[#E6E7EB]">
            <div className="grid grid-cols-2 gap-3 text-sm text-[#1F2328] text-left">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 启动方式</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 识别证据</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 配置路径</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 绑定 Skills / MCP</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 日志路径</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> 健康诊断</div>
            </div>
          </div>
          
          <div className="flex gap-3 w-full">
            <Button onClick={onDiscoverSystem} className="flex-1 gap-2 bg-[#1F2328] text-white hover:bg-[#323842]">
              <ScanLine className="w-4 h-4" /> 自动发现
            </Button>
            <Button onClick={onOpenScanDrawer} variant="outline" className="flex-1 gap-2 border-[#E6E7EB] hover:bg-gray-50">
              <FolderSearch className="w-4 h-4" /> 扫描目录
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const brand = getAgentBrandStyles(agent.name, agent.type);
  const Icon = brand.Icon;
  const isLaunchable = isAgentLaunchable(agent);
  
  const typeDesc = agent.type === 'CLI' ? '命令行客户端' : agent.type === 'IDE Plugin' ? '编辑器集成插件' : '桌面客户端';
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
    <div className="flex flex-col h-full bg-white overflow-hidden text-[#1F2328]">
      {/* Header */}
      <div className="flex-shrink-0 pt-8 px-8 border-b border-[#E6E7EB] bg-gray-50/50">
        {/* Top Summary */}
        <div className="flex items-start gap-5 mb-6">
          <div className={`p-4 rounded-2xl flex items-center justify-center w-20 h-20 shrink-0 ${brand.bgClass} shadow-sm border border-[#E6E7EB]/50`}>
            {brand.imgSrc ? (
              <img src={brand.imgSrc} alt={agent.name} className="w-12 h-12 object-contain" />
            ) : (
              Icon && <Icon className={`w-12 h-12 ${brand.textClass}`} />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-3 mb-2 min-w-0">
              <h2 className="text-2xl font-bold tracking-tight truncate max-w-full" title={agent.name}>{agent.name}</h2>
              
              <span className="text-xs uppercase font-medium text-[#8B8E98] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                {agent.type || 'Agent'}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border shadow-sm ${agent.status === 'active' ? 'bg-green-50 text-[#22C55E] border-green-200' : agent.status === 'broken' ? 'bg-red-50 text-[#EF4444] border-red-200' : 'bg-gray-100 text-[#8B8E98] border-gray-200'}`}>
                {agent.status || 'Unknown'}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border shadow-sm ${agent.confidence === 'verified' ? 'bg-green-50 text-[#22C55E] border-green-200' : agent.confidence === 'probable' ? 'bg-amber-50 text-[#F59E0B] border-amber-200' : 'bg-white text-[#8B8E98] border-gray-200'}`}>
                {agent.confidence === 'verified' ? 'Verified' : agent.confidence === 'probable' ? 'Probable' : 'Candidate'}
              </span>
            </div>
            <p className="text-sm text-[#8B8E98] line-clamp-2 max-w-2xl">
              {desc}
            </p>
          </div>
          
          <div className="shrink-0 flex flex-col gap-2">
            <Button 
               size="sm" 
               className={`gap-1.5 h-9 w-32 shadow-sm ${isLaunchable ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-50 text-blue-400'}`} 
               onClick={() => launchAgent(agent.id)} 
               disabled={!isLaunchable}
            >
              <Play className="w-3.5 h-3.5 fill-current" /> <span className="font-semibold">启动</span>
            </Button>
            <Button 
               size="sm" 
               variant="outline"
               className="gap-1.5 h-9 w-32 border-[#E6E7EB] hover:bg-gray-50 shadow-sm text-[#1F2328]" 
               onClick={() => openConfigDir(agent.id)} 
               disabled={!hasConfig}
            >
              <Settings className="w-3.5 h-3.5" /> <span className="font-semibold">打开配置</span>
            </Button>
            <Button 
               size="sm" 
               variant="outline"
               className="gap-1.5 h-9 w-32 border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-700 shadow-sm" 
            >
              <ExternalLink className="w-3.5 h-3.5" /> <span className="font-semibold">Codex 分析</span>
            </Button>
          </div>
        </div>

        {/* Key Facts Card */}
        <div className="bg-white rounded-xl border border-[#E6E7EB] shadow-sm mb-6 p-4">
          <h4 className="text-xs font-bold text-[#8B8E98] uppercase tracking-wider mb-3">关键事实 (Key Facts)</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <FactItem label="启动方式" value={agent.type === 'App' ? 'GUI 应用' : agent.type === 'CLI' ? '命令行' : '无需启动'} />
            <FactItem label="检测来源" value={agent.detection_source || 'Unknown'} />
            <FactItem label="发现时间" value={agent.last_detected_at ? new Date(agent.last_detected_at).toLocaleString() : '未知'} />
            <FactItem label="日志分析支持" value={agent.log_path ? '✅ 支持' : '❌ 未支持'} />
            
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
                className={`pb-4 text-sm font-semibold transition-colors relative ${isActive ? 'text-blue-600' : 'text-[#8B8E98] hover:text-[#1F2328]'}`}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.4)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
        {renderTabContent()}
      </div>
    </div>
  );
}

function FactItem({ label, value, fullWidth = false }: { label: string, value: string, fullWidth?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${fullWidth ? 'col-span-2 lg:col-span-4' : ''}`}>
      <span className="text-[#8B8E98] truncate">{label}</span>
      <span className="font-mono text-[#1F2328] bg-gray-50 px-2 py-1 rounded border border-[#E6E7EB] truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

// Sub-component for Evidence Tab
function EvidenceTabContent({ agent }: { agent: Agent }) {
  const evidence: string[] = (() => {
    try { return agent.evidence_json ? JSON.parse(agent.evidence_json).signals || [] : []; }
    catch { return []; }
  })();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h3 className="text-lg font-bold mb-1">识别证据 (Detection Evidence)</h3>
        <p className="text-sm text-[#8B8E98] mb-6">Harness Manager 推断此客户端身份所依赖的本地证据链路。</p>
        
        {evidence.length === 0 ? (
          <div className="p-4 bg-gray-50 text-[#8B8E98] text-sm rounded-lg border border-[#E6E7EB]">
            未能解析任何证据，这可能是一个手动注入的客户端。
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E6E7EB] shadow-sm overflow-hidden">
            <div className="divide-y divide-[#E6E7EB]">
              {evidence.map((ev, index) => {
                // Determine icon based on evidence content
                let icon = <CheckCircle2 className="w-4 h-4 text-blue-500" />;
                if (ev.includes('置信度')) icon = <CheckCircle2 className="w-4 h-4 text-green-500" />;
                
                return (
                  <div key={index} className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <div className="flex-1 font-mono text-sm text-[#1F2328] break-words">
                      {ev}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 text-blue-800 p-4 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
          置信度判定原因
        </h4>
        <p className="text-xs">
          当前置信度评级为 <strong>{agent.confidence === 'verified' ? '已验证 (Verified)' : agent.confidence === 'probable' ? '推断 (Probable)' : '候选 (Candidate)'}</strong>。
          系统通过分析检测来源 ({agent.detection_source})、安装路径以及配置文件结构等维度来进行这一判定。
        </p>
      </div>
    </div>
  );
}
