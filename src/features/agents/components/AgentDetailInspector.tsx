import { useState } from 'react';
import { Agent } from '../types';
import { Box, Play } from 'lucide-react';
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
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'launch', label: 'Launch' },
  { id: 'resources', label: 'Resources' },
  { id: 'usage', label: 'Usage' },
  { id: 'health', label: 'Health' },
];

export function AgentDetailInspector({ agent }: Props) {
  const [activeTab, setActiveTab] = useState('overview');
  const launchAgent = useAgentsStore(s => s.launchAgent);

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Box className="w-12 h-12 mb-4 opacity-50 text-muted-foreground/50" />
        <h3 className="text-lg font-medium text-foreground mb-1">未选择 Agent</h3>
        <p className="text-sm max-w-sm">
          请从左侧列表中选择一个 Agent 客户端以查看详细配置、绑定资源或进行启动诊断。
        </p>
      </div>
    );
  }

  const brand = getAgentBrandStyles(agent.name, agent.type);
  const Icon = brand.Icon;
  const isLaunchable = isAgentLaunchable(agent);
  
  const typeDesc = agent.type === 'CLI' ? '命令行客户端' : agent.type === 'IDE Plugin' ? '编辑器集成插件' : '桌面客户端';
  const desc = agent.description || typeDesc;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return <AgentOverviewTab agent={agent} />;
      case 'launch': return <AgentLaunchTab agent={agent} />;
      case 'resources': return <AgentResourcesTab />;
      case 'usage': return <AgentUsageTab agent={agent} />;
      case 'health': return <AgentHealthTab agent={agent} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 pt-6 px-6 border-b border-border">
        {/* Top Summary */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-2.5 rounded-xl flex items-center justify-center w-12 h-12 shrink-0 ${brand.bgClass}`}>
            {brand.imgSrc ? (
              <img src={brand.imgSrc} alt={agent.name} className="w-7 h-7 object-contain" />
            ) : (
              Icon && <Icon className={`w-7 h-7 ${brand.textClass}`} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-foreground truncate">{agent.name}</h2>
              <span className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : agent.status === 'broken' ? 'bg-red-500' : 'bg-gray-400'}`} title={agent.status || 'Unknown'} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {desc}
            </p>
          </div>
          <div className="shrink-0">
             <Button 
                size="sm" 
                className="gap-1.5 h-8 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-none" 
                onClick={() => launchAgent(agent.id)} 
                disabled={!isLaunchable}
             >
               <Play className="w-3.5 h-3.5 fill-current" /> <span className="text-xs">启动</span>
             </Button>
          </div>
        </div>

        {/* Key Facts Mini Grid */}
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 mb-5 p-3 bg-secondary/20 rounded-lg border border-border/40 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">启动次数</span>
            <span className="font-medium text-foreground">{agent.launch_count}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">最近启动</span>
            <span className="font-medium text-foreground">{agent.last_launched_at ? new Date(agent.last_launched_at).toLocaleDateString() : '从未'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">配置状态</span>
            <span className={`font-medium ${agent.config_path ? 'text-green-600 dark:text-green-500' : 'text-yellow-600 dark:text-yellow-500'}`}>
              {agent.config_path ? '正常' : '缺失'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">绑定资源</span>
            <span className="font-medium text-muted-foreground">未启用</span>
          </div>
        </div>

        {/* Custom Tabs Navigation */}
        <div className="flex items-center gap-6">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-xs font-medium transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {renderTabContent()}
      </div>
    </div>
  );
}
