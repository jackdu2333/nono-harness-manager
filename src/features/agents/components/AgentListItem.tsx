import { Agent } from '../types';
import { Play, GripVertical, ChevronRight } from 'lucide-react';
import { getAgentBrandStyles } from '../utils/brandStyles';
import { isAgentLaunchable } from '../utils/launchability';
import { useAgentsStore } from '../store';
import { Button } from '@/components/ui/button';
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
  const isLaunchable = isAgentLaunchable(agent);

  let statusColor = 'bg-gray-400';
  if (agent.status === 'active') statusColor = 'bg-green-500';
  else if (agent.status === 'broken') statusColor = 'bg-red-500';
  else if (agent.status === 'missing_path') statusColor = 'bg-yellow-500';

  // Format description logic based on Type
  const typeLower = (agent.type || '').toLowerCase();
  let descLine = '';
  if (typeLower === 'app') {
    descLine = `桌面客户端 · ${isLaunchable ? '可启动' : '不可启动'}`;
  } else if (typeLower === 'cli') {
    descLine = `命令行客户端 · 不直接启动 · ${agent.log_path ? '日志可用' : '日志缺失'}`;
  } else if (typeLower === 'configonly') {
    descLine = '仅发现配置或日志 · 待确认';
  } else {
    descLine = agent.description || '客户端组件';
  }

  // Smart truncation helper for paths
  const truncatePath = (path?: string) => {
    if (!path) return '';
    if (path.length <= 40) return path;
    const start = path.substring(0, 15);
    const end = path.substring(path.length - 20);
    return `${start}...${end}`;
  };

  // Paths line
  const pathsLineItems = [];
  if (typeLower === 'app' && agent.app_path) {
    pathsLineItems.push(truncatePath(agent.app_path));
  } else if (typeLower === 'cli') {
    if (agent.cli_path) pathsLineItems.push(`CLI: ${truncatePath(agent.cli_path)}`);
    if (agent.log_path) pathsLineItems.push(`Log: ${truncatePath(agent.log_path)}`);
  } else if (typeLower === 'configonly') {
    if (agent.config_path) pathsLineItems.push(`Config: ${truncatePath(agent.config_path)}`);
    else if (agent.log_path) pathsLineItems.push(`Log: ${truncatePath(agent.log_path)}`);
  }

  // Placeholder state (when being dragged, the original item stays but looks like an empty slot)
  if (isDragging && !isDragOverlay) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="min-h-[96px] m-2 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-50/50 opacity-50 flex items-center justify-center"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => !isDragOverlay && onSelect(agent)}
      className={`
        relative group flex items-start p-4 transition-all border-b border-[#E6E7EB]/50
        min-h-[96px] max-h-[108px] overflow-hidden
        ${isDragOverlay 
          ? 'cursor-grabbing scale-[1.02] bg-white/90 backdrop-blur-xl shadow-xl shadow-black/10 border border-blue-200 rounded-xl z-50 ring-1 ring-blue-500/20' 
          : 'cursor-pointer'
        }
        ${!isDragOverlay && isSelected
          ? 'bg-blue-50/40 border-l-2 border-l-blue-500' 
          : ''
        }
        ${!isDragOverlay && !isSelected
          ? 'bg-transparent hover:bg-gray-50 border-l-2 border-l-transparent'
          : ''
        }
      `}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className={`absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center transition-opacity z-10
          ${isDragOverlay ? 'opacity-100 cursor-grabbing' : 'opacity-0 group-hover:opacity-100 cursor-grab hover:bg-black/5'}
        `}
      >
        <GripVertical className={`w-3.5 h-3.5 ${isDragOverlay ? 'text-blue-500' : 'text-[#8B8E98]'}`} />
      </div>

      {/* Left: Status Dot & Icon */}
      <div className="flex items-start gap-3 shrink-0 pt-1 ml-3">
        <span className={`block w-2 h-2 rounded-full mt-3 ${statusColor} ${isDragOverlay ? 'shadow-sm ring-2 ring-white' : 'ring-2 ring-white'}`} />
        <div className={`p-2 rounded-lg flex items-center justify-center w-10 h-10 ${brand.bgClass} ${isDragOverlay ? 'ring-2 ring-blue-500/20 shadow-md' : 'border border-[#E6E7EB] shadow-sm'}`}>
          {brand.imgSrc ? (
            <img src={brand.imgSrc} alt={agent.name} className="w-5 h-5 object-contain" />
          ) : (
            Icon && <Icon className={`w-5 h-5 ${brand.textClass}`} />
          )}
        </div>
      </div>

      {/* Middle: Content */}
      <div className="min-w-0 flex-1 ml-4 flex flex-col justify-center h-full">
        {/* Line 1: Name & Badges */}
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`font-semibold text-sm truncate ${isSelected || isDragOverlay ? 'text-blue-700' : 'text-[#1F2328]'}`}>
            {agent.name}
          </h3>
          <span className="text-[10px] uppercase font-medium text-[#8B8E98] bg-gray-100 px-1.5 py-0.5 rounded">
            {agent.type || 'Agent'}
          </span>
          <span className={`text-[10px] font-medium border shadow-sm px-1.5 py-0.5 rounded
            ${agent.confidence === 'verified' ? 'bg-green-50 text-[#22C55E] border-green-200' 
            : agent.confidence === 'probable' ? 'bg-amber-50 text-[#F59E0B] border-amber-200' 
            : 'bg-white text-[#8B8E98] border-gray-200'}
          `}>
            {agent.confidence === 'verified' ? '已验证' : agent.confidence === 'probable' ? '推断' : '候选'}
          </span>
        </div>

        {/* Line 2: Description */}
        <p className="text-xs text-[#8B8E98] line-clamp-1 mb-1 pr-4">
          {descLine}
        </p>

        {/* Line 3: Smart Truncated Paths */}
        <div className="text-[11px] text-[#8B8E98]/80 truncate pr-4 font-mono">
          {pathsLineItems.length > 0 ? pathsLineItems.join(' · ') : <span className="opacity-50 italic">路径未提供</span>}
        </div>
      </div>

      {/* Right: Hover Actions & Arrow */}
      <div className="shrink-0 flex items-center justify-end gap-2 h-full relative z-20 min-w-[100px] h-full">
        {/* Hover Actions */}
        <div className={`flex items-center gap-1.5 transition-opacity duration-200 absolute right-6 ${isSelected || isDragOverlay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <Button 
            size="sm" 
            variant="outline" 
            className={`h-7 px-3 text-xs rounded-full transition-colors border-[#E6E7EB] ${isDragOverlay ? 'bg-white shadow-md' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
            onClick={(e) => { e.stopPropagation(); onSelect(agent); }}
          >
            详情
          </Button>
          
          <Button 
            size="icon" 
            variant="secondary" 
            className={`w-7 h-7 rounded-full transition-colors ${isDragOverlay ? 'bg-blue-500 text-white shadow-md' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'}`} 
            onClick={(e) => { e.stopPropagation(); isLaunchable && launchAgent(agent.id); }} 
            disabled={!isLaunchable}
            title={isLaunchable ? "启动" : "无法启动"}
          >
            <Play className="w-3 h-3 fill-current ml-0.5" />
          </Button>
        </div>
        
        {/* Always visible chevron indicator (fades out on hover to make room for buttons) */}
        <div className={`transition-opacity duration-200 absolute right-0 flex items-center justify-center w-6 ${isSelected || isDragOverlay ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}>
          <ChevronRight className="w-4 h-4 text-[#8B8E98]/40" />
        </div>
      </div>
    </div>
  );
}
