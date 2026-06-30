import { Agent } from '../types';
import { Play, GripVertical, ChevronRight } from 'lucide-react';
import { getAgentBrandStyles } from '../utils/brandStyles';
import { isAgentLaunchable } from '../utils/launchability';
import { useAgentsStore } from '../store';
import { Button } from '@/components/ui/button';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

interface Props {
  agent: Agent;
  isSelected: boolean;
  onSelect: (agent: Agent) => void;
  isDragOverlay?: boolean;
}

export function AgentListItem({ agent, isSelected, onSelect, isDragOverlay = false }: Props) {
  const { t } = useTranslation();
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

  let statusColor = 'bg-muted-foreground';
  if (agent.status === 'active') statusColor = 'bg-success';
  else if (agent.status === 'broken') statusColor = 'bg-destructive';
  else if (agent.status === 'missing_path') statusColor = 'bg-warning';

  // Format description logic based on Type
  const typeLower = (agent.type || '').toLowerCase();
  let descLine = '';
  if (typeLower === 'app') {
    descLine = t('agents.desktop_launchable', { status: isLaunchable ? t('agents.launchable_yes') : t('agents.launchable_no') });
  } else if (typeLower === 'cli') {
    descLine = t('agents.cli_log_status', { status: agent.log_path ? t('agents.filter_log_ok') : t('agents.log_missing') });
  } else if (typeLower === 'configonly') {
    descLine = t('agents.config_only');
  } else {
    descLine = agent.description || t('agents.client_component');
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
        min-h-[96px] max-h-[108px] overflow-hidden
        ${isDragOverlay 
          ? 'cursor-grabbing scale-[1.02] bg-card/90 backdrop-blur-xl shadow-xl shadow-black/10 border border-primary/30 rounded-xl z-50 ring-1 ring-ring/20' 
          : 'cursor-pointer'
        }
        ${!isDragOverlay && isSelected
          ? 'bg-primary/5 border-l-2 border-l-primary' 
          : ''
        }
        ${!isDragOverlay && !isSelected
          ? 'bg-transparent hover:bg-muted/50 border-l-2 border-l-transparent'
          : ''
        }
      `}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className={`absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center transition-opacity z-10
          ${isDragOverlay ? 'opacity-100 cursor-grabbing' : 'opacity-0 group-hover:opacity-100 cursor-grab hover:bg-muted/50'}
        `}
      >
        <GripVertical className={`w-3.5 h-3.5 ${isDragOverlay ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>

      {/* Left: Status Dot & Icon */}
      <div className="flex items-start gap-3 shrink-0 pt-1 ml-3">
        <span className={`block w-2 h-2 rounded-full mt-3 ${statusColor} ${isDragOverlay ? 'shadow-sm ring-2 ring-card' : 'ring-2 ring-card'}`} />
        <div className={`p-2 rounded-lg flex items-center justify-center w-10 h-10 ${brand.bgClass} ${isDragOverlay ? 'ring-2 ring-ring/20 shadow-md' : 'border border-border shadow-sm'}`}>
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
          <h3 className={`font-semibold text-sm truncate ${isSelected || isDragOverlay ? 'text-primary' : 'text-foreground'}`}>
            {agent.name}
          </h3>
          <span className="text-[10px] uppercase font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {agent.type || 'Agent'}
          </span>
          <span className={`text-[10px] font-medium border shadow-sm px-1.5 py-0.5 rounded
            ${agent.confidence === 'verified' ? 'bg-success/10 text-success border-success/30' 
            : agent.confidence === 'probable' ? 'bg-warning/10 text-warning border-warning/30' 
            : 'bg-card text-muted-foreground border-border'}
          `}>
            {agent.confidence === 'verified' ? t('agents.verified') : agent.confidence === 'probable' ? t('agents.probable') : t('agents.candidate')}
          </span>
        </div>

        {/* Line 2: Description */}
        <p className="text-xs text-muted-foreground line-clamp-1 mb-1 pr-4">
          {descLine}
        </p>

        {/* Line 3: Smart Truncated Paths */}
        <div className="text-[11px] text-muted-foreground/80 truncate pr-4 font-mono">
          {pathsLineItems.length > 0 ? pathsLineItems.join(' · ') : <span className="opacity-50 italic">{t('agents.path_not_provided')}</span>}
        </div>
      </div>

      {/* Right: Hover Actions & Arrow */}
      <div className="shrink-0 flex items-center justify-end gap-2 h-full relative z-20 min-w-[100px] h-full">
        {/* Hover Actions */}
        <div className={`flex items-center gap-1.5 transition-opacity duration-200 absolute right-6 ${isSelected || isDragOverlay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <Button 
            size="sm" 
            variant="outline" 
            className={`h-7 px-3 text-xs rounded-full transition-colors border-border ${isDragOverlay ? 'bg-card shadow-md' : 'bg-card hover:bg-muted/50 shadow-sm'}`}
            onClick={(e) => { e.stopPropagation(); onSelect(agent); }}
          >
            {t('agents.detail')}
          </Button>
          
          <Button 
            size="icon" 
            variant="secondary" 
            className={`w-7 h-7 rounded-full transition-colors ${isDragOverlay ? 'bg-primary text-primary-foreground shadow-md' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'}`} 
            onClick={(e) => { e.stopPropagation(); isLaunchable && launchAgent(agent.id); }} 
            disabled={!isLaunchable}
            title={isLaunchable ? t('agents.launch') : t('agents.launchable_no')}
          >
            <Play className="w-3 h-3 fill-current ml-0.5" />
          </Button>
        </div>
        
        {/* Always visible chevron indicator (fades out on hover to make room for buttons) */}
        <div className={`transition-opacity duration-200 absolute right-0 flex items-center justify-center w-6 ${isSelected || isDragOverlay ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}
