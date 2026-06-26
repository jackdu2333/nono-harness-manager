import { useState } from 'react';
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

interface Props {
  agents: Agent[];
}

const dropAnimationConfig = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

function PinnedAgentCard({ agent, isDragOverlay = false }: { agent: Agent, isDragOverlay?: boolean }) {
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
        className="h-[72px] rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 opacity-50"
      />
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all h-[72px]
        ${isDragOverlay 
          ? 'cursor-grabbing bg-card/90 backdrop-blur-xl border-primary/30 shadow-2xl shadow-black/20 dark:shadow-black/50 scale-105 z-50 ring-1 ring-primary/20' 
          : 'bg-card border-border/40 shadow-sm hover:border-border hover:shadow'
        }
      `}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div 
          {...attributes} 
          {...listeners}
          className={`p-1 -ml-1 rounded transition-colors
            ${isDragOverlay ? 'text-primary cursor-grabbing' : 'text-muted-foreground/30 hover:text-muted-foreground hover:bg-secondary cursor-grab'}
          `}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className={`p-2 rounded-md flex items-center justify-center w-9 h-9 shrink-0 ${brand.bgClass} ${isDragOverlay ? 'shadow-md ring-2 ring-primary/20' : ''}`}>
          {brand.imgSrc ? (
            <img src={brand.imgSrc} alt={agent.name} className="w-5 h-5 object-contain" />
          ) : (
            Icon && <Icon className={`w-5 h-5 ${brand.textClass}`} />
          )}
        </div>
        <div className="min-w-0">
          <div className={`font-semibold text-sm truncate ${isDragOverlay ? 'text-primary' : 'text-foreground'}`} title={agent.name}>{agent.name}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="truncate max-w-[80px]">{agent.type || 'Agent'}</span>
            <span className="shrink-0">•</span>
            <span className={`shrink-0 ${agent.status === 'active' ? 'text-green-500' : ''}`}>{agent.status || 'Unknown'}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => isLaunchable && !isDragOverlay && launchAgent(agent.id)}
        disabled={!isLaunchable || isDragOverlay}
        className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ml-3
          ${isDragOverlay ? 'bg-primary text-primary-foreground shadow-md' : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary'}
        `}
        title={isLaunchable ? "启动" : "不可启动"}
      >
        <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
      </button>
    </div>
  );
}

export function PinnedAgentsBar({ agents }: Props) {
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

  // Max 3 agents as requested
  const displayAgents = agents.slice(0, 3);

  const activeAgent = activeId ? displayAgents.find(a => a.id === activeId) : null;

  if (agents.length === 0) return null;

  return (
    <div className="px-6 py-3 border-b border-border bg-card/30 shrink-0 relative z-20">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          常用启动 (Pinned)
        </h3>
        {agents.length > 3 && (
          <span className="text-[11px] text-primary cursor-pointer hover:underline">查看全部</span>
        )}
      </div>
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={displayAgents.map(a => a.id)} strategy={horizontalListSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayAgents.map(agent => (
              <PinnedAgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimationConfig}>
          {activeAgent ? <PinnedAgentCard agent={activeAgent} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
