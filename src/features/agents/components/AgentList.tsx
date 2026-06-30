import React, { useState } from 'react';
import { Agent } from '../types';
import { AgentListItem } from './AgentListItem';
import { Box, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAgentsStore } from '../store';
import { useTranslation } from 'react-i18next';

interface Props {
  agents: Agent[];
  selectedId?: string;
  onSelect: (agent: Agent) => void;
  onOpenScanDrawer: () => void;
  onDiscoverSystem: () => void;
  isScanning: boolean;
}

const dropAnimationConfig = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

export function AgentList({ agents, selectedId, onSelect, onOpenScanDrawer, onDiscoverSystem, isScanning }: Props) {
  const { t } = useTranslation();
  const reorderAgents = useAgentsStore(s => s.reorderAgents);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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

  const handleDragCancel = () => {
    setActiveId(null);
  };

  if (agents.length === 0 && !isScanning) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Box className="w-16 h-16 mb-4 opacity-50 text-muted-foreground/50" />
        <h3 className="text-xl font-medium text-foreground mb-2">{t('agents.no_agents_title')}</h3>
        <p className="text-sm max-w-sm mb-6">
          {t('agents.no_agents_desc')}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onDiscoverSystem}>{t('agents.auto_discover_local')}</Button>
          <Button onClick={onOpenScanDrawer}>{t('agents.scan_local_dir')}</Button>
        </div>
      </div>
    );
  }

  const activeAgent = activeId ? agents.find(a => a.id === activeId) : null;

  return (
    <div className="h-full flex flex-col relative bg-card">
      {/* Loading Overlay */}
      {isScanning && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="bg-card p-4 rounded-xl shadow-lg border border-border flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-medium">Scanning for agents...</span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext 
            items={agents.map(a => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col pb-4">
              {agents.map(agent => (
                <AgentListItem 
                  key={agent.id} 
                  agent={agent} 
                  isSelected={agent.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={dropAnimationConfig}>
            {activeAgent ? (
              <AgentListItem 
                agent={activeAgent} 
                isSelected={activeAgent.id === selectedId}
                onSelect={() => {}}
                isDragOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
