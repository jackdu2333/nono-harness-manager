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
        className="h-12 w-64 rounded-md border-2 border-dashed border-blue-500/30 bg-blue-50/50 opacity-50 flex-shrink-0"
      />
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between px-3 py-2 rounded-md border transition-all h-12 w-64 flex-shrink-0
        ${isDragOverlay 
          ? 'cursor-grabbing bg-white/90 backdrop-blur-xl border-blue-200 shadow-xl shadow-black/10 scale-105 z-50 ring-1 ring-blue-500/20' 
          : 'bg-white border-[#E6E7EB] shadow-sm hover:border-gray-300 hover:shadow-md'
        }
      `}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div 
          {...attributes} 
          {...listeners}
          className={`-ml-1 rounded transition-colors
            ${isDragOverlay ? 'text-blue-500 cursor-grabbing' : 'text-[#8B8E98]/40 hover:text-[#8B8E98] cursor-grab'}
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
            <span className={`font-semibold text-xs truncate max-w-[80px] ${isDragOverlay ? 'text-blue-600' : 'text-[#1F2328]'}`} title={agent.name}>{agent.name}</span>
            <span className="text-[10px] text-[#8B8E98] shrink-0">·</span>
            <span className="text-[10px] text-[#8B8E98] shrink-0">{agent.type || 'Agent'}</span>
            <span className="text-[10px] text-[#8B8E98] shrink-0">·</span>
            <span className={`text-[10px] shrink-0 ${isLaunchable ? 'text-[#22C55E]' : 'text-[#8B8E98]'}`}>{isLaunchable ? '可启动' : '不可启动'}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => isLaunchable && !isDragOverlay && launchAgent(agent.id)}
        disabled={!isLaunchable || isDragOverlay}
        className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors ml-2
          ${isDragOverlay ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:hover:bg-blue-50 disabled:hover:text-blue-600'}
        `}
        title={isLaunchable ? "启动" : "不可启动"}
      >
        <Play className="w-2.5 h-2.5 ml-0.5 fill-current" />
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

  // Max 4 agents
  const displayAgents = agents.slice(0, 4);

  const activeAgent = activeId ? displayAgents.find(a => a.id === activeId) : null;

  if (agents.length === 0) return null;

  return (
    <div className="px-6 py-2.5 border-b border-[#E6E7EB] bg-[#F7F7F8] shrink-0 relative z-20 flex items-center gap-4 overflow-x-auto no-scrollbar">
      <div className="flex flex-col shrink-0">
        <h3 className="text-[11px] font-bold text-[#1F2328] uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          常用启动
        </h3>
      </div>
      
      <div className="w-px h-6 bg-[#E6E7EB] shrink-0"></div>
      
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={displayAgents.map(a => a.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3">
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
