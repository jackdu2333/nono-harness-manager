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
  const { skills, fetchSkills, currentView, duplicateAssignment, duplicateReasons, recordUsage } = useSkillsStore();
  const { t } = useTranslation();

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
    columnHelper.accessor('category', {
      header: '分类',
      cell: info => <span className="text-muted-foreground">{info.getValue() || '未分类'}</span>,
    }),
    columnHelper.accessor('updated_at', {
      header: 'Updated',
      cell: info => {
        const val = info.getValue();
        return <span className="text-xs text-muted-foreground/80">{val ? new Date(val).toLocaleDateString() : '-'}</span>;
      },
    }),
  ], [t, duplicateAssignment, duplicateReasons]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Each "view" is just a filtered list — not a separate dashboard. §三
  const viewFiltered = useMemo(() => {
    const active = skills.filter((s) => s.is_archived === 0);
    switch (currentView) {
      case 'favorites': return active.filter((s) => s.is_favorite === 1);
      case 'missing_description': return active.filter((s) => !s.description);
      case 'uncategorized': return active.filter((s) => !s.category);
      case 'needs_review': return active.filter((s) => s.needs_review === 1);
      case 'needs_improvement': return active.filter((s) => s.needs_improvement === 1);
      case 'duplicates': return active.filter((s) => !!duplicateAssignment[s.id]);
      case 'archived': return skills.filter((s) => s.is_archived === 1);
      case 'all':
      default: return active;
    }
  }, [skills, currentView, duplicateAssignment]);

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
    <div className="h-full overflow-auto bg-card border border-border rounded-lg shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground bg-background sticky top-0 z-10 shadow-sm border-b border-border">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} className="px-4 py-3 font-medium border-b border-border/50">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                </th>
              ))}
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
                // §一/§八：打开详情是最基础的面板操作，必须计入 usage
                recordUsage(row.original.id, 'view_detail');
                onSelectSkill(row.original);
              }}
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
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
