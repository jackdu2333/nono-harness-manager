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
  globalFilter 
}: { 
  onSelectSkill: (skill: Skill) => void;
  globalFilter: string;
}) {
  const { skills, fetchSkills } = useSkillsStore();
  const { t } = useTranslation();

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: t('skills.name'),
      cell: info => {
        const skill = info.row.original;
        return (
          <div className="py-1">
            <div className="font-medium text-foreground text-base">{skill.name}</div>
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
  ], [t]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const table = useReactTable({
    data: skills,
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
              className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onSelectSkill(row.original)}
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
