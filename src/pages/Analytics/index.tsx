import { useEffect, useState } from 'react';
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
  const maxCount = items.length > 0 ? Math.max(...items.map(i => i.count)) : 0;
  return (
    <section className="border border-border bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground flex items-center gap-2 bg-muted/20">
        {icon}
        <span>{title}</span>
      </div>
      <div className="p-4 space-y-3">
        {items.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground text-center">暂无日志推断记录</div>
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
                  <span className="text-primary font-semibold tabular-nums">{item.count} 次</span>
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
            暂无趋势数据
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
                  {item.count}次
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
  if (!cells || cells.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground bg-card border border-border rounded-lg text-center shadow-sm">
        暂无交叉矩阵统计数据。
      </div>
    );
  }

  // 提取唯一的 Agent 和 Resource
  const agents = Array.from(new Set(cells.map(c => c.agent))).sort();
  const resources = Array.from(new Set(cells.map(c => c.resource))).sort();

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground">
        {agentLabel} × {resourceLabel} 矩阵 (可观测调用频次)
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
            Agent 日志推断统计
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            系统通过扫描外部 Agent 客户端 (Codex / Antigravity / WorkBuddy / Newmax) 的本地日志，
            推断 Skill 与 MCP 资源的可观测使用痕迹。
            本页面所有统计指标均为<strong className="text-foreground">可观测调用次数（日志推断）</strong>，
            不包含 Harness UI 主动管理操作。
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {scanStatus && (
            <span className="text-xs text-muted-foreground">
              {isScanning ? '扫描中...' : scanStatus.last_finished_at ? `上次扫描: ${formatTime(scanStatus.last_finished_at)}` : '未扫描'}
            </span>
          )}
          <Button variant="outline" onClick={handleScan} disabled={isScanning || isLoading} className="flex-shrink-0">
            <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? '扫描中' : '扫描 Agent 日志'}
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

      {/* 资源统计卡片 */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { key: 'agents', label: 'Agent 客户端数' },
          { key: 'skills', label: 'Skills 技能数' },
          { key: 'mcp_servers', label: 'MCP 服务数' },
          { key: 'memory_sources', label: '本地记忆源' },
          { key: 'knowledge_bases', label: '知识库关联' },
          { key: 'projects', label: '绑定项目数' }
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
          title="Agent 客户端排行" 
          items={overview?.usage_by_agent_client ?? []} 
          icon={<User className="h-4 w-4 text-primary" />}
        />
        <VisualMetricList 
          title="Skill 使用排行" 
          items={overview?.usage_by_skill ?? []} 
          icon={<BookOpen className="h-4 w-4 text-primary" />}
        />
        <VisualMetricList 
          title="MCP Server 使用排行" 
          items={overview?.usage_by_mcp_server ?? []} 
          icon={<Cpu className="h-4 w-4 text-primary" />}
        />
        <VisualMetricList 
          title="MCP Tool 调用排行" 
          items={overview?.usage_by_mcp_tool ?? []} 
          icon={<ListOrdered className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* 使用趋势 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          可观测使用频次趋势 (日志推断)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <TrendTimeline title="最近 7 天趋势" items={overview?.trends.week ?? []} />
          <TrendTimeline title="最近 30 天趋势" items={overview?.trends.month ?? []} />
          <TrendTimeline title="历史以来趋势" items={overview?.trends.year ?? []} />
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
          resourceLabel="MCP 资源" 
        />
      </section>

      {/* 最近推断事件 */}
      <section className="border border-border bg-card rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/20">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">最近日志推断使用事件 (高/中置信度)</h2>
        </div>
        <div className="overflow-auto max-h-[350px]">
          {!overview || overview.recent_events.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">暂无推断事件。</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 sticky top-0 z-10">
                  <th className="p-3 font-semibold text-foreground">资源类型</th>
                  <th className="p-3 font-semibold text-foreground">动作行为</th>
                  <th className="p-3 font-semibold text-foreground">Agent 客户端</th>
                  <th className="p-3 font-semibold text-foreground">日志推断时间</th>
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
    </div>
  );
}
