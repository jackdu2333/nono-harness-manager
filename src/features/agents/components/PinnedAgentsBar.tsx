import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Agent } from '../types';
import { Play, GripVertical } from 'lucide-react';
import { getAgentBrandStyles } from '../utils/brandStyles';
import { isAgentLaunchable } from '../utils/launchability';
import { useAgentsStore } from '../store';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

interface Props {
  agents: Agent[];
}

const dropAnimationConfig = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

function PinnedAgentCard({ agent, isDragOverlay = false }: { agent: Agent, isDragOverlay?: boolean }) {
  const { t } = useTranslation();
  const launchAgent = useAgentsStore(s => s.launchAgent);
  const brand = getAgentBrandStyles(agent.name, agent.type);
  const Icon = brand.Icon;
  const isLaunchable = isAgentLaunchable(agent);
  
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

  if (isDragging && !isDragOverlay) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="h-12 min-w-0 flex-1 max-w-[260px] rounded-md border-2 border-dashed border-primary/30 bg-primary/5 opacity-50"
      />
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between px-3 py-2 rounded-md border transition-all h-12 min-w-0 flex-1 max-w-[260px]
        ${isDragOverlay 
          ? 'cursor-grabbing bg-card/90 backdrop-blur-xl border-primary/30 shadow-xl shadow-black/10 scale-105 z-50 ring-1 ring-ring/20' 
          : 'bg-card border-border shadow-sm hover:border-border hover:shadow-md'
        }
      `}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div 
          {...attributes} 
          {...listeners}
          className={`-ml-1 rounded transition-colors
            ${isDragOverlay ? 'text-primary cursor-grabbing' : 'text-muted-foreground/40 hover:text-muted-foreground cursor-grab'}
          `}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className={`p-1 rounded flex items-center justify-center w-6 h-6 shrink-0 ${brand.bgClass} ${isDragOverlay ? 'shadow-sm' : ''}`}>
          {brand.imgSrc ? (
            <img src={brand.imgSrc} alt={agent.name} className="w-4 h-4 object-contain" />
          ) : (
            Icon && <Icon className={`w-4 h-4 ${brand.textClass}`} />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold text-xs truncate max-w-[80px] ${isDragOverlay ? 'text-primary' : 'text-foreground'}`} title={agent.name}>{agent.name}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">·</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{agent.type || 'Agent'}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">·</span>
            <span className={`text-[10px] shrink-0 ${isLaunchable ? 'text-success' : 'text-muted-foreground'}`}>{isLaunchable ? t('agents.launchable_yes') : t('agents.launchable_no')}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => isLaunchable && !isDragOverlay && launchAgent(agent.id)}
        disabled={!isLaunchable || isDragOverlay}
        className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors ml-2
          ${isDragOverlay ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary'}
        `}
        title={isLaunchable ? t('agents.launch') : t('agents.launchable_no')}
      >
        <Play className="w-2.5 h-2.5 ml-0.5 fill-current" />
      </button>
    </div>
  );
}

export function PinnedAgentsBar({ agents }: Props) {
  const { t } = useTranslation();
  const reorderAgents = useAgentsStore(s => s.reorderAgents);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderAgents(active.id as string, over.id as string);
    }
  };

  // Max 3 agents
  const displayAgents = agents.slice(0, 3);

  const activeAgent = activeId ? displayAgents.find(a => a.id === activeId) : null;

  if (agents.length === 0) return null;

  return (
    <div className="w-full min-w-0 px-6 py-2.5 border-b border-border bg-background shrink-0 relative z-20 flex items-center gap-4 overflow-hidden">
      <div className="flex flex-col shrink-0">
        <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          {t('agents.frequent_launch')}
        </h3>
      </div>
      
      <div className="w-px h-6 bg-border shrink-0"></div>
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={displayAgents.map(a => a.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex min-w-0 flex-1 gap-3 overflow-hidden">
            {displayAgents.map(agent => (
              <PinnedAgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </SortableContext>

        {createPortal(
          <DragOverlay dropAnimation={dropAnimationConfig}>
            {activeAgent ? <PinnedAgentCard agent={activeAgent} isDragOverlay /> : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
