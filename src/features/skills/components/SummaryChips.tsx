import { useMemo } from 'react';
import { useSkillsStore } from '../store';
import { SkillView } from '../types';
import { getCompatibleClient } from '../utils/clientMatcher';

/**
 * Lightweight summary chips — NOT a dashboard. §二
 * Each chip is a clickable filter that switches the current view.
 * No charts, no rankings, no global analytics (those belong in Analytics).
 */
export function SummaryChips() {
  const {
    skills,
    currentView,
    setView,
    duplicateAssignment,
    sourceFilter,
    clientFilter,
    categoryFilter,
    statusFilter,
    sources
  } = useSkillsStore();

  // Apply dropdown filters to calculate count for Summary Chips
  const baseFiltered = useMemo(() => {
    let result = skills;
    if (sourceFilter.length > 0) {
      result = result.filter((s) => s.source_id && sourceFilter.includes(s.source_id));
    }
    if (clientFilter.length > 0) {
      result = result.filter((s) => {
        const src = sources.find((x) => x.id === s.source_id);
        const clientName = getCompatibleClient(s, src ? src.name : '');
        return clientFilter.includes(clientName);
      });
    }
    if (categoryFilter.length > 0) {
      result = result.filter((s) => s.category && categoryFilter.includes(s.category));
    }
    if (statusFilter.length > 0) {
      result = result.filter((s) => statusFilter.includes(s.status));
    }
    return result;
  }, [skills, sourceFilter, clientFilter, categoryFilter, statusFilter, sources]);

  const active = useMemo(() => baseFiltered.filter((s) => s.is_archived === 0), [baseFiltered]);
  const dupCount = useMemo(() => active.filter((s) => !!duplicateAssignment[s.id]).length, [active, duplicateAssignment]);

  const chips: { view: SkillView; label: string; count: number }[] = [
    { view: 'all', label: 'Total', count: active.length },
    { view: 'favorites', label: '常用', count: active.filter((s) => s.is_favorite === 1).length },
    { view: 'missing_description', label: '缺描述', count: active.filter((s) => !s.description).length },
    { view: 'uncategorized', label: '未分类', count: active.filter((s) => !s.category).length },
    { view: 'needs_review', label: '待整理', count: active.filter((s) => s.needs_review === 1).length },
    { view: 'needs_improvement', label: '待进化', count: active.filter((s) => s.needs_improvement === 1).length },
    { view: 'duplicates', label: '疑似重复', count: dupCount },
    { view: 'archived', label: '已归档', count: baseFiltered.filter((s) => s.is_archived === 1).length },
  ];

  return (
    <div className="shrink-0 flex items-center gap-2 px-4 lg:px-6 py-2 border-b border-border bg-background overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {chips.map((chip) => {
        const isActive = currentView === chip.view;
        return (
          <button
            key={chip.view}
            onClick={() => setView(chip.view)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isActive
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            }`}
          >
            <span>{chip.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                isActive ? 'bg-background/20' : 'bg-muted'
              }`}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
