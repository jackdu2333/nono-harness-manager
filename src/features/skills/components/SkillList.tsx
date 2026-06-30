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
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning">{t('skills.tag_frequent')}</span>
              )}
              {skill.needs_review === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{t('skills.tag_organize')}</span>
              )}
              {skill.needs_improvement === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{t('skills.tag_evolve')}</span>
              )}
              {skill.duplicate_group_id && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                  title={t('skills.dup_tag_persisted')}
                >
                  {t('skills.dup_tagged')}
                </span>
              )}
              {!skill.duplicate_group_id && duplicateAssignment[skill.id] && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning"
                  title={`${t('skills.dup_tag_realtime')}${dupReason?.length ? t('skills.dup_hit_prefix') + dupReason.join('、') : ''}`}
                >
                  {t('skills.dup_realtime_badge')}
                </span>
              )}
            </div>
            {skill.description ? (
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {skill.description}
                {skill.description_confidence === 'low' && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {t('skills.desc_inferred_badge')}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground/60 mt-1 italic">{t('mcp.no_description_short')}</div>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('source_id', {
      header: t('skills.source_label'),
      cell: info => {
        const sourceId = info.getValue();
        const rawName = sourceId ? sourceMap.get(sourceId) ?? '-' : '-';
        const friendlyName = rawName !== '-' ? getFriendlySourceName(rawName) : '-';
        return <span className="text-xs text-muted-foreground whitespace-nowrap">{friendlyName}</span>;
      },
    }),
    columnHelper.accessor('category', {
      header: t('skills.category_label'),
      cell: info => (
        <span className="text-xs text-muted-foreground whitespace-nowrap truncate max-w-[120px] block">
          {info.getValue() || t('common.uncategorized')}
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
