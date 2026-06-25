import React from 'react';
import { Agent } from '../types';
import { Play, MoreHorizontal, Settings, Trash2, GripVertical } from 'lucide-react';
import { getAgentBrandStyles } from '../utils/brandStyles';
import { useAgentsStore } from '../store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  agent: Agent;
  isSelected: boolean;
  onSelect: (agent: Agent) => void;
  isDragOverlay?: boolean;
}

export function AgentListItem({ agent, isSelected, onSelect, isDragOverlay = false }: Props) {
  const launchAgent = useAgentsStore(s => s.launchAgent);
  const openConfigDir = useAgentsStore(s => s.openConfigDir);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: agent.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? 'none' : transition,
    zIndex: isDragOverlay ? 999 : (isDragging ? 10 : 1),
    position: 'relative' as const,
  };
  
  const brand = getAgentBrandStyles(agent.name, agent.type);
  const Icon = brand.Icon;
  const isLaunchable = !!agent.app_path || !!agent.launch_command;
  const hasConfig = !!agent.config_path;

  let statusColor = 'bg-gray-400';
  if (agent.status === 'active') statusColor = 'bg-green-500';
  else if (agent.status === 'broken') statusColor = 'bg-red-500';
  else if (agent.status === 'missing_path') statusColor = 'bg-yellow-500';

  const typeDesc = agent.type === 'CLI' ? '命令行客户端' : agent.type === 'IDE Plugin' ? '编辑器集成插件' : '桌面客户端';
  const desc = agent.description || typeDesc;

  // Placeholder state (when being dragged, the original item stays but looks like an empty slot)
  if (isDragging && !isDragOverlay) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="min-h-[96px] m-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 opacity-50 flex items-center justify-center"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => !isDragOverlay && onSelect(agent)}
      className={`
        relative group flex items-start p-4 transition-all border-b border-border/50
        min-h-[96px] max-h-[116px]
        ${isDragOverlay 
          ? 'cursor-grabbing scale-[1.02] bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/20 dark:shadow-black/50 border border-primary/20 rounded-xl z-50' 
          : 'cursor-pointer'
        }
        ${!isDragOverlay && isSelected
          ? 'bg-secondary/30 border-l-2 border-l-primary' 
          : ''
        }
        ${!isDragOverlay && !isSelected
          ? 'bg-transparent hover:bg-secondary/10 border-l-2 border-l-transparent'
          : ''
        }
      `}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className={`absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center transition-opacity z-10
          ${isDragOverlay ? 'opacity-100 cursor-grabbing' : 'opacity-0 group-hover:opacity-100 cursor-grab hover:bg-black/5 dark:hover:bg-white/5'}
        `}
      >
        <GripVertical className={`w-4 h-4 ${isDragOverlay ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>

      {/* Left: Status Dot & Icon */}
      <div className="flex items-start gap-3 shrink-0 pt-0.5 ml-3">
        <span className={`block w-2 h-2 rounded-full mt-2.5 ${statusColor} ${isDragOverlay ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : ''}`} />
        <div className={`p-2 rounded-lg flex items-center justify-center w-10 h-10 ${brand.bgClass} ${isDragOverlay ? 'ring-2 ring-primary/20 shadow-md' : ''}`}>
          {brand.imgSrc ? (
            <img src={brand.imgSrc} alt={agent.name} className="w-5 h-5 object-contain" />
          ) : (
            Icon && <Icon className={`w-5 h-5 ${brand.textClass}`} />
          )}
        </div>
      </div>

      {/* Middle: Content */}
      <div className="min-w-0 flex-1 ml-4 flex flex-col justify-center h-full">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`font-semibold text-sm truncate ${isSelected || isDragOverlay ? 'text-primary' : 'text-foreground'}`}>
            {agent.name}
          </h3>
          <span className="text-[10px] uppercase font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            {agent.type || 'Agent'}
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5 pr-4">
          {desc}
        </p>

        <div className="text-[11px] text-muted-foreground/70 truncate pr-4">
          <span className="font-mono">{agent.config_path ? '配置: ' + agent.config_path.split('/').pop() : '配置: 无'}</span>
          <span className="mx-1.5 text-muted-foreground/30">|</span>
          <span className="font-mono">{agent.default_workspace ? '工作区: ' + agent.default_workspace.split('/').pop() : '工作区: 默认'}</span>
          <span className="mx-1.5 text-muted-foreground/30">|</span>
          <span>{agent.last_launched_at ? `最近: ${new Date(agent.last_launched_at).toLocaleDateString()}` : '从未启动'}</span>
        </div>
      </div>

      {/* Right: Resources & Actions */}
      <div className="shrink-0 flex flex-col items-end gap-3 h-full relative z-20">
        {/* Resource Counts - Muted */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="bg-secondary/50 px-1.5 py-0.5 rounded">Skills 0</span>
          <span className="bg-secondary/50 px-1.5 py-0.5 rounded">MCP 0</span>
          <span className="bg-secondary/50 px-1.5 py-0.5 rounded">Mem 0</span>
        </div>

        {/* Hover Actions */}
        <div className={`flex items-center gap-1 transition-opacity ${isSelected || isDragOverlay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <Button 
            size="icon" 
            variant="secondary" 
            className={`w-7 h-7 rounded-full transition-colors ${isDragOverlay ? 'bg-primary text-primary-foreground shadow-md' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'}`} 
            onClick={(e) => { e.stopPropagation(); isLaunchable && launchAgent(agent.id); }} 
            disabled={!isLaunchable}
            title={isLaunchable ? "启动" : "无法启动"}
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </Button>
          
          {!isDragOverlay && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="w-7 h-7 rounded-full" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); hasConfig && openConfigDir(agent.id); }} disabled={!hasConfig}>
                  <Settings className="w-4 h-4 mr-2" /> 打开配置目录
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={(e) => { 
                    e.preventDefault();
                    useAgentsStore.getState().deleteAgent(agent.id);
                  }} 
                  className="text-red-600 focus:text-red-600 dark:text-red-500 focus:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> 移除客户端
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
