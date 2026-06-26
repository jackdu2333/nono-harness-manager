import { useEffect, useMemo } from 'react';
import { useSkillsStore } from '../store';
import { Skill } from '../types';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { getCompatibleClient, getFriendlySourceName } from '../utils/clientMatcher';

const columnHelper = createColumnHelper<Skill>();

export function SkillList({
  onSelectSkill,
  selectedSkillId,
  globalFilter
}: {
  onSelectSkill: (skill: Skill) => void;
  selectedSkillId?: string | null;
  globalFilter: string;
}) {
  const {
    skills,
    fetchSkills,
    currentView,
    duplicateAssignment,
    duplicateReasons,
    recordUsage,
    sources,
    sourceFilter,
    clientFilter,
    categoryFilter,
    statusFilter
  } = useSkillsStore();
  const { t } = useTranslation();

  // Build source lookup map for display
  const sourceMap = useMemo(() => {
    const map = new Map<string, string>();
    sources.forEach((src) => map.set(src.id, src.name));
    return map;
  }, [sources]);

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: t('skills.name'),
      cell: info => {
        const skill = info.row.original;
        const dupReason = duplicateReasons[skill.id];
        return (
          <div className="py-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground text-base">{skill.name}</span>
              {skill.is_favorite === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">常用</span>
              )}
              {skill.needs_review === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">待整理</span>
              )}
              {skill.needs_improvement === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">待进化</span>
              )}
              {skill.duplicate_group_id && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                  title="已保存的重复标记（持久化，不会因刷新消失）"
                >
                  已标记重复
                </span>
              )}
              {!skill.duplicate_group_id && duplicateAssignment[skill.id] && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  title={`实时疑似重复（未保存，刷新或规则变化可能改变）${dupReason?.length ? ' · 命中：' + dupReason.join('、') : ''}`}
                >
                  实时疑似重复
                </span>
              )}
            </div>
            {skill.description ? (
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {skill.description}
                {skill.description_confidence === 'low' && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    推测
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground/60 mt-1 italic">暂无描述</div>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('source_id', {
      header: '来源',
      cell: info => {
        const sourceId = info.getValue();
        const rawName = sourceId ? sourceMap.get(sourceId) ?? '-' : '-';
        const friendlyName = rawName !== '-' ? getFriendlySourceName(rawName) : '-';
        return <span className="text-xs text-muted-foreground whitespace-nowrap">{friendlyName}</span>;
      },
    }),
    columnHelper.accessor('category', {
      header: '分类',
      cell: info => (
        <span className="text-xs text-muted-foreground whitespace-nowrap truncate max-w-[120px] block">
          {info.getValue() || '未分类'}
        </span>
      ),
    }),
    columnHelper.accessor('updated_at', {
      header: 'Updated',
      cell: info => {
        const val = info.getValue();
        return <span className="text-xs text-muted-foreground/80 whitespace-nowrap">{val ? new Date(val).toLocaleDateString() : '-'}</span>;
      },
    }),
  ], [t, duplicateAssignment, duplicateReasons, sourceMap]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const viewFiltered = useMemo(() => {
    const active = skills.filter((s) => s.is_archived === 0);
    let result: Skill[];
    switch (currentView) {
      case 'favorites': result = active.filter((s) => s.is_favorite === 1); break;
      case 'missing_description': result = active.filter((s) => !s.description); break;
      case 'uncategorized': result = active.filter((s) => !s.category); break;
      case 'needs_review': result = active.filter((s) => s.needs_review === 1); break;
      case 'needs_improvement': result = active.filter((s) => s.needs_improvement === 1); break;
      case 'duplicates': result = active.filter((s) => !!duplicateAssignment[s.id]); break;
      case 'archived': result = skills.filter((s) => s.is_archived === 1); break;
      case 'all':
      default: result = active; break;
    }

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
  }, [skills, currentView, duplicateAssignment, sourceFilter, clientFilter, categoryFilter, statusFilter, sources]);

  const table = useReactTable({
    data: viewFiltered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
  });

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] bg-card border border-border rounded-lg shadow-sm">
      <table className="w-full text-sm text-left table-fixed">
        <colgroup>
          <col style={{ minWidth: '520px' }} />
          <col style={{ width: '110px' }} />
          <col style={{ width: '120px' }} />
          <col style={{ width: '110px' }} />
        </colgroup>
        <thead className="text-xs text-muted-foreground bg-background sticky top-0 z-10 shadow-sm border-b border-border">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const id = header.column.id;
                const widthClass = 
                  id === 'name' ? 'min-w-[520px]' :
                  id === 'source_id' ? 'w-[110px]' :
                  id === 'category' ? 'w-[120px]' :
                  id === 'updated_at' ? 'w-[110px]' : '';
                return (
                  <th
                    key={header.id}
                    className={`px-4 py-3 font-medium border-b border-border/50 ${widthClass}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr
              key={row.id}
              className={`border-b border-border/50 cursor-pointer transition-colors ${
                selectedSkillId === row.original.id
                  ? 'bg-accent/60 shadow-[inset_3px_0_0_0_hsl(var(--foreground))] '
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => {
                recordUsage(row.original.id, 'view_detail');
                onSelectSkill(row.original);
              }}
            >
              {row.getVisibleCells().map(cell => {
                const id = cell.column.id;
                const widthClass = 
                  id === 'name' ? 'min-w-[520px]' :
                  id === 'source_id' ? 'w-[110px]' :
                  id === 'category' ? 'w-[120px]' :
                  id === 'updated_at' ? 'w-[110px]' : '';
                return (
                  <td key={cell.id} className={`px-4 py-3 align-top ${widthClass}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground/60">
                {t('skills.no_skills')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
