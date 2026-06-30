import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  RefreshCw,
  User,
  Cpu,
  BookOpen,
  TrendingUp,
  Activity,
  ListOrdered
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkillAnalysisDashboard } from '@/features/skills/components/SkillAnalysisDashboard';
import { getAnalyticsOverview, triggerAgentLogScan } from '@/features/local-assets/api';
import type { AnalyticsOverview, UsageMetric, MatrixCell, ScanStatus } from '@/features/local-assets/types';

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

// 视觉化柱状排行列表
function VisualMetricList({ 
  title, 
  items, 
  icon 
}: { 
  title: string; 
  items: UsageMetric[]; 
  icon?: React.ReactNode 
}) {
  const { t } = useTranslation();
  const maxCount = items.length > 0 ? Math.max(...items.map(i => i.count)) : 0;
  return (
    <section className="border border-border bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground flex items-center gap-2 bg-muted/20">
        {icon}
        <span>{title}</span>
      </div>
      <div className="p-4 space-y-3">
        {items.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground text-center">{t('analytics.no_logs')}</div>
        ) : (
          items.map((item, index) => {
            const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="font-medium text-foreground truncate" title={item.key}>
                      {item.key}
                    </span>
                  </div>
                  <span className="text-primary font-semibold tabular-nums">{item.count} {t('common.times_unit')}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-700 ease-out" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// 趋势条形图列表
function TrendTimeline({ 
  title, 
  items 
}: { 
  title: string; 
  items: UsageMetric[] 
}) {
  const { t } = useTranslation();
  const maxCount = items.length > 0 ? Math.max(...items.map(i => i.count)) : 0;
  return (
    <div className="flex flex-col h-full border border-border bg-card rounded-lg p-4 shadow-sm">
      <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        {title}
      </div>
      <div className="flex-1 space-y-2.5 overflow-auto max-h-[220px] pr-1">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground py-10">
            {t('analytics.no_trend')}
          </div>
        ) : (
          items.map(item => {
            const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div key={item.key} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-muted-foreground text-left tabular-nums whitespace-nowrap flex-shrink-0">
                  {item.key}
                </span>
                <div className="flex-1 h-3 bg-muted rounded overflow-hidden relative">
                  <div 
                    className="h-full bg-primary/50 rounded transition-all duration-700 ease-out" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-12 text-right font-medium text-foreground tabular-nums">
                  {item.count} {t('common.times_unit')}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Agent 资源交叉矩阵
function MatrixTable({ 
  cells, 
  agentLabel, 
  resourceLabel 
}: { 
  cells: MatrixCell[]; 
  agentLabel: string; 
  resourceLabel: string 
}) {
  const { t } = useTranslation();
  if (!cells || cells.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground bg-card border border-border rounded-lg text-center shadow-sm">
        {t('analytics.no_matrix')}
      </div>
    );
  }

  // 提取唯一的 Agent 和 Resource
  const agents = Array.from(new Set(cells.map(c => c.agent))).sort();
  const resources = Array.from(new Set(cells.map(c => c.resource))).sort();

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground">
        {t('analytics.matrix_title', { agent: agentLabel, resource: resourceLabel })}
      </div>
      <div className="overflow-auto max-w-full max-h-[300px]">
        <table className="w-full text-xs border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/40 sticky top-0 z-10">
              <th className="p-3 font-semibold text-foreground border-r border-border bg-muted/50 whitespace-nowrap">
                {agentLabel} \ {resourceLabel}
              </th>
              {resources.map(res => (
                <th key={res} className="p-3 font-semibold text-foreground border-r border-border text-center whitespace-nowrap min-w-[80px]">
                  {res}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr key={agent} className="border-b border-border last:border-b-0 hover:bg-muted/10">
                <td className="p-3 font-medium text-foreground border-r border-border bg-muted/5 sticky left-0 z-0 whitespace-nowrap">
                  {agent}
                </td>
                {resources.map(res => {
                  const cell = cells.find(c => c.agent === agent && c.resource === res);
                  return (
                    <td key={res} className="p-3 text-center border-r border-border text-foreground last:border-r-0">
                      {cell ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                          {cell.count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'logs' | 'skills'>('logs');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setOverview(await getAnalyticsOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const counts = overview?.resource_counts ?? {};
  const scanStatus = overview?.scan_status;
  const isScanning = scanStatus?.status === 'running';

  const handleScan = async () => {
    if (isScanning) return;
    setError(null);
    try {
      await triggerAgentLogScan();
      // 轮询等待扫描完成（最多 30 秒）
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        const latest = await getAnalyticsOverview();
        if (latest.scan_status?.status !== 'running') {
          setOverview(latest);
          return;
        }
      }
      // 超时也刷新一次
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      refresh();
    }
  };

  return (
    <div className="h-full overflow-auto bg-background p-6 space-y-6">
      {/* 头部区域 */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t('analytics.agent_stats')}
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            {t('analytics.agent_stats_desc')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {scanStatus && (
            <span className="text-xs text-muted-foreground">
              {isScanning ? t('common.scanning') : scanStatus.last_finished_at ? t('analytics.last_scan', { time: formatTime(scanStatus.last_finished_at) }) : t('analytics.not_scanned')}
            </span>
          )}
          <Button variant="outline" onClick={handleScan} disabled={isScanning || isLoading} className="flex-shrink-0">
            <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? t('common.scanning') : t('analytics.scan_agents')}
          </Button>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={isLoading} className="flex-shrink-0">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="inline-flex rounded-md border border-border overflow-hidden">
        <button
          onClick={() => setActiveView('logs')}
          className={`px-3 py-1.5 text-sm transition-colors ${activeView === 'logs' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'}`}
        >
          {t('analytics.tab_log_overview')}
        </button>
        <button
          onClick={() => setActiveView('skills')}
          className={`px-3 py-1.5 text-sm transition-colors ${activeView === 'skills' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'}`}
        >
          {t('analytics.tab_skill_analysis')}
        </button>
      </div>

      {activeView === 'skills' ? (
        <div className="-mx-6">
          <SkillAnalysisDashboard onSelectSkill={() => navigate('/skills')} />
        </div>
      ) : (
        <>

      {/* 资源统计卡片 */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { key: 'agents', label: t('analytics.stat_agents') },
          { key: 'skills', label: t('analytics.stat_skills') },
          { key: 'mcp_servers', label: t('analytics.stat_mcp') },
          { key: 'memory_sources', label: t('analytics.stat_memory') },
          { key: 'knowledge_bases', label: t('analytics.stat_knowledge') },
          { key: 'projects', label: t('analytics.stat_projects') }
        ].map(item => (
          <div key={item.key} className="border border-border bg-card rounded-lg p-4 shadow-sm hover:border-primary/30 transition-colors">
            <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
            <div className="mt-2 text-2xl font-bold text-foreground tracking-tight">
              {counts[item.key] ?? 0}
            </div>
          </div>
        ))}
      </section>

      {/* 排行榜网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <VisualMetricList 
          title={t('analytics.ranking_agents')}
          items={overview?.usage_by_agent_client ?? []} 
          icon={<User className="h-4 w-4 text-primary" />}
        />
        <VisualMetricList 
          title={t('analytics.ranking_skills')}
          items={overview?.usage_by_skill ?? []} 
          icon={<BookOpen className="h-4 w-4 text-primary" />}
        />
        <VisualMetricList 
          title={t('analytics.ranking_mcp_servers')}
          items={overview?.usage_by_mcp_server ?? []} 
          icon={<Cpu className="h-4 w-4 text-primary" />}
        />
        <VisualMetricList 
          title={t('analytics.ranking_mcp_tools')}
          items={overview?.usage_by_mcp_tool ?? []} 
          icon={<ListOrdered className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* 使用趋势 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t('analytics.trend_title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <TrendTimeline title={t('analytics.trend_7d')} items={overview?.trends.week ?? []} />
          <TrendTimeline title={t('analytics.trend_30d')} items={overview?.trends.month ?? []} />
          <TrendTimeline title={t('analytics.trend_all')} items={overview?.trends.year ?? []} />
        </div>
      </section>

      {/* 交叉矩阵 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MatrixTable 
          cells={overview?.skill_by_agent_matrix ?? []} 
          agentLabel="Agent" 
          resourceLabel="Skill" 
        />
        <MatrixTable 
          cells={overview?.mcp_by_agent_matrix ?? []} 
          agentLabel="Agent" 
          resourceLabel={t('analytics.mcp_resource')}
        />
      </section>

      {/* 最近推断事件 */}
      <section className="border border-border bg-card rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/20">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t('analytics.recent_events_title')}</h2>
        </div>
        <div className="overflow-auto max-h-[350px]">
          {!overview || overview.recent_events.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">{t('analytics.no_events')}</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 sticky top-0 z-10">
                  <th className="p-3 font-semibold text-foreground">{t('analytics.col_resource_type')}</th>
                  <th className="p-3 font-semibold text-foreground">{t('analytics.col_action')}</th>
                  <th className="p-3 font-semibold text-foreground">{t('analytics.col_agent')}</th>
                  <th className="p-3 font-semibold text-foreground">{t('analytics.col_time')}</th>
                </tr>
              </thead>
              <tbody>
                {overview.recent_events.map((event, index) => (
                  <tr key={`${event.resource_type}-${event.resource_id}-${event.created_at}-${index}`} className="border-b border-border last:border-b-0 hover:bg-muted/10">
                    <td className="p-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        event.resource_type === 'skill' 
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {event.resource_type}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-foreground truncate max-w-[300px]" title={event.action}>
                      {event.action}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {event.source ?? 'unknown'}
                    </td>
                    <td className="p-3 text-muted-foreground tabular-nums">
                      {formatTime(event.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
