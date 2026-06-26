import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FolderOpen, RefreshCw, Search, Sparkles, Cpu, Box, ShieldCheck, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listSkills, listSkillSources } from '@/features/skills/api';
import { listAgents } from '@/features/agents/api';
import { listMcpServers } from '@/features/mcp/api';
import { listIntelligenceProposals } from '@/features/proposals/api';
import { getAnalyticsOverview } from '@/features/local-assets/api';
import { detectDuplicates } from '@/features/skills/utils/duplicateDetector';
import type { Skill, SkillSource } from '@/features/skills/types';
import type { Agent } from '@/features/agents/types';
import type { McpServer } from '@/features/mcp/types';
import type { IntelligenceProposal } from '@/features/proposals/types';
import type { AnalyticsOverview } from '@/features/local-assets/types';

interface DashboardData {
  skills: Skill[];
  sources: SkillSource[];
  agents: Agent[];
  mcpServers: McpServer[];
  proposals: IntelligenceProposal[];
  analytics: AnalyticsOverview | null;
}

function formatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return date.toLocaleString();
}

const actionLabels: Record<string, string> = {
  view_detail: '查看',
  copy_path: '复制路径',
  copy_ref: '复制引用',
  open_dir: '打开目录',
  edit_description: '编辑描述',
  set_category: '设置分类',
  set_status: '设置状态',
  archive: '归档',
  delete_index: '移除索引',
  remove_index: '移除索引',
  delete_source_file: '删除源文件',
  move_source_to_trash: '移到废纸篓',
  toggle_favorite: '切换常用',
  toggle_needs_review: '切换待整理',
  toggle_needs_improvement: '切换待进化',
  update_improvement_note: '更新进化备注',
  update_review_note: '更新整理备注',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [skills, sources, agents, mcpServers, proposals, analytics] = await Promise.all([
        listSkills(),
        listSkillSources(),
        listAgents(),
        listMcpServers(),
        listIntelligenceProposals(),
        getAnalyticsOverview().catch(() => null),
      ]);
      setData({ skills, sources, agents, mcpServers, proposals, analytics });
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeSkills = data ? data.skills.filter((s) => s.is_archived === 0) : [];
  const missingDesc = activeSkills.filter((s) => !s.description).length;
  const uncategorized = activeSkills.filter((s) => !s.category).length;
  const needsReview = activeSkills.filter((s) => s.needs_review === 1).length;
  const needsImprovement = activeSkills.filter((s) => s.needs_improvement === 1).length;
  const archivedCount = data ? data.skills.filter((s) => s.is_archived === 1).length : 0;
  const dupResult = data ? detectDuplicates(data.skills) : null;
  const duplicateCount = dupResult ? Object.keys(dupResult.assignment).length : 0;

  const launchableAgents = data ? data.agents.filter(
    (a) => a.type === 'App' && a.app_path && a.app_path.endsWith('.app'),
  ).length : 0;

  const pendingProposals = data ? data.proposals.filter(
    (p) => p.status === 'pending_review' || p.status === 'pending_manual_review',
  ).length : 0;

  const recentEvents = data?.analytics?.recent_events ?? [];

  // Build today's status sentence
  const parts: string[] = [];
  const totalNeedsWork = missingDesc + uncategorized + needsReview + needsImprovement;
  if (totalNeedsWork > 0) {
    const bits: string[] = [];
    if (missingDesc) bits.push(`${missingDesc} 个 Skills 缺少描述`);
    if (uncategorized) bits.push(`${uncategorized} 个 Skills 未分类`);
    if (needsReview) bits.push(`${needsReview} 个 Skills 待整理`);
    if (needsImprovement) bits.push(`${needsImprovement} 个 Skills 待进化`);
    parts.push(bits.join('，'));
  }
  if (pendingProposals > 0) parts.push(`${pendingProposals} 个 Proposals 待确认`);

  const statusSentence = totalNeedsWork === 0 && pendingProposals === 0
    ? (data && data.skills.length > 0
        ? '所有 Skills 已有描述和分类，暂无待处理事项。'
        : '欢迎使用 NoNo Harness。先从添加或扫描 Skills 资源库开始。')
    : `今天有 ${parts.join('，')}。`;

  const todoItems = [
    { label: 'Skills 缺少描述', count: missingDesc, path: '/skills', view: 'missing_description' as const },
    { label: 'Skills 未分类', count: uncategorized, path: '/skills', view: 'uncategorized' as const },
    { label: 'Skills 待整理', count: needsReview, path: '/skills', view: 'needs_review' as const },
    { label: 'Skills 待进化', count: needsImprovement, path: '/skills', view: 'needs_improvement' as const },
    { label: '疑似重复 Skills', count: duplicateCount, path: '/skills', view: 'duplicates' as const },
  ].filter((item) => item.count > 0).slice(0, 5);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">本地 Harness 今日状态与待处理事项</p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            加载中...
          </div>
        ) : (
          <>
            {/* 今日状态 */}
            <div className="mb-6 rounded-lg border border-border bg-card p-5">
              <p className="text-base text-foreground leading-relaxed">{statusSentence}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {totalNeedsWork > 0 && (
                  <button
                    onClick={() => navigate('/skills')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    Skills 待整理 {totalNeedsWork}
                  </button>
                )}
                {pendingProposals > 0 && (
                  <button
                    onClick={() => navigate('/proposals')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                  >
                    Proposals 待确认 {pendingProposals}
                  </button>
                )}
                {totalNeedsWork === 0 && pendingProposals === 0 && data && data.skills.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3 h-3" />
                    暂无待处理
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[3fr_2fr] gap-5">
              {/* 主卡片：继续整理 Skills */}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">继续整理 Skills</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <StatTile label="缺描述" value={missingDesc} onClick={() => navigate('/skills')} />
                  <StatTile label="未分类" value={uncategorized} onClick={() => navigate('/skills')} />
                  <StatTile label="待整理" value={needsReview} onClick={() => navigate('/skills')} />
                  <StatTile label="待进化" value={needsImprovement} onClick={() => navigate('/skills')} />
                </div>
                {duplicateCount > 0 && (
                  <div className="mt-3 text-sm text-orange-600 dark:text-orange-400">
                    还有 {duplicateCount} 个疑似重复 Skills
                  </div>
                )}
                <Button className="mt-4 w-full" onClick={() => navigate('/skills')}>
                  进入 Skills 整理
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>

              {/* 右侧：系统可用性 + 快捷操作 */}
              <div className="flex flex-col gap-5">
                <div className="rounded-lg border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">系统可用性</h2>
                  <div className="space-y-2 text-sm">
                    <button onClick={() => navigate('/agents')} className="flex w-full items-center justify-between hover:text-foreground text-muted-foreground transition-colors">
                      <span className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5" />Agents</span>
                      <span className="text-muted-foreground">{data?.agents.length ?? 0} 个{launchableAgents > 0 ? `，${launchableAgents} 可启动` : ''}</span>
                    </button>
                    <button onClick={() => navigate('/mcp')} className="flex w-full items-center justify-between hover:text-foreground text-muted-foreground transition-colors">
                      <span className="flex items-center gap-2"><Box className="w-3.5 h-3.5" />MCP</span>
                      <span className="text-muted-foreground">{data?.mcpServers.length ?? 0} 个</span>
                    </button>
                    <button onClick={() => navigate('/skills')} className="flex w-full items-center justify-between hover:text-foreground text-muted-foreground transition-colors">
                      <span className="flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5" />Skill Sources</span>
                      <span className="text-muted-foreground">{data?.sources.length ?? 0} 个资源库</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">快捷操作</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/skills')}>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />整理 Skills
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/skills')}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />扫描 Skills
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/agents')}>
                      <Search className="w-3.5 h-3.5 mr-1.5" />发现 Agents
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/mcp')}>
                      <Search className="w-3.5 h-3.5 mr-1.5" />发现 MCP
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 待处理队列 */}
            {todoItems.length > 0 && (
              <div className="mt-5 rounded-lg border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h2 className="text-sm font-semibold text-foreground">待处理</h2>
                </div>
                {todoItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-border px-5 py-3 last:border-b-0">
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <span className="text-xs text-muted-foreground/50 tabular-nums w-4">{idx + 1}</span>
                      {item.label}
                      <span className="font-semibold text-foreground">{item.count}</span>
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(item.path)}>
                      处理
                      <ChevronRight className="ml-1 w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* 最近活动 */}
            <div className="mt-5 rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">最近活动</h2>
              </div>
              {recentEvents.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  暂无最近活动。开始整理 Skills 后，这里会显示你的操作记录。
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentEvents.slice(0, 8).map((event, idx) => (
                    <div key={idx} className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <span className="text-foreground">
                        <span className="text-muted-foreground">{actionLabels[event.action] ?? event.action}</span>
                        {' '}
                        <span className="text-muted-foreground/70">{event.resource_type}</span>
                      </span>
                      <span className="text-xs text-muted-foreground/60">{formatTime(event.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部归档统计（低调展示） */}
            {archivedCount > 0 && (
              <div className="mt-3 text-center text-xs text-muted-foreground/50">
                已归档 {archivedCount} 个 Skills
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-border bg-background/50 p-3 text-left transition-colors hover:bg-accent/30"
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${value > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
        {value}
      </div>
    </button>
  );
}
