import React, { useState } from 'react';
import { McpServer } from '../types';
import { Box, Calendar, Tag, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MCPOverviewTab } from './tabs/MCPOverviewTab';
import { MCPConfigTab } from './tabs/MCPConfigTab';
import { MCPToolsTab } from './tabs/MCPToolsTab';
import { MCPResourcesTab } from './tabs/MCPResourcesTab';
import { MCPHealthTab } from './tabs/MCPHealthTab';
import { MCPUsageTab } from './tabs/MCPUsageTab';

interface Props {
  server: McpServer | null;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tools', label: 'Tools' },
  { id: 'resources', label: 'Resources' },
  { id: 'config', label: 'Config' },
  { id: 'health', label: 'Health' },
  { id: 'usage', label: 'Usage' },
];

export function MCPDetailInspector({ server }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  if (!server) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Box className="w-12 h-12 mb-4 opacity-50 text-muted-foreground/50" />
        <h3 className="text-lg font-medium text-foreground mb-1">{t('mcp.no_selection')}</h3>
        <p className="text-sm max-w-sm">
          {t('mcp.select_prompt', 'Select an MCP server from the list to view its details, configuration, and tools.')}
        </p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return <MCPOverviewTab server={server} />;
      case 'config': return <MCPConfigTab server={server} />;
      case 'tools': return <MCPToolsTab />;
      case 'resources': return <MCPResourcesTab />;
      case 'health': return <MCPHealthTab />;
      case 'usage': return <MCPUsageTab />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
            <Box className="w-8 h-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground truncate" title={server.name}>{server.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider shrink-0 ${server.status === 'active' ? 'bg-success/10 text-success border border-success/20' : 'bg-muted text-muted-foreground'}`}>
                {server.status || 'Unknown'}
              </span>
            </div>
            
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {server.description || '暂无描述'}
            </p>
            
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 shrink-0 bg-secondary/50 px-2 py-1 rounded-md">
                <Tag className="w-3.5 h-3.5" />
                {server.category || 'Uncategorized'}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(server.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Tabs Navigation */}
        <div className="flex items-center gap-6 mt-6 border-b border-border/50">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
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
