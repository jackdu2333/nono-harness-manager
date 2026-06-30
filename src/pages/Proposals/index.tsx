import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
  ChevronDown,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  applyIntelligenceProposal,
  listIntelligenceProposals,
  rejectIntelligenceProposal,
  rollbackIntelligenceProposal,
  acknowledgeIntelligenceProposal,
  createSafeRewriteProposal,
} from '@/features/proposals/api';
import type { IntelligenceProposal } from '@/features/proposals/types';

const SECTION_PREVIEW_LIMIT = 10;

const creatorLabels: Record<string, string> = {
  built_in_ai: '内置 AI',
  codex: 'Codex',
  mcp: 'MCP',
  manual: '手动',
  rule_engine: '规则引擎',
  user_rewrite: '手动重写',
  built_in_ai_rewrite: '内置 AI 重写',
};

function parseReasons(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return [raw];
  }
}

function formatTime(value?: string | null) {
  if (!value) return '未记录';
  return new Date(value).toLocaleString();
}

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function canApplyProposal(proposal: IntelligenceProposal) {
  return proposal.resource_type === 'skill' || proposal.resource_type === 'mcp_server';
}

function getBlockedGroup(proposal: IntelligenceProposal): 'repairable' | 'manual' | 'high_risk' {
  let changes: any = {};
  try {
    changes = JSON.parse(proposal.proposed_changes);
  } catch {}

  const forbiddenKeys = [
    "path", "source_path", "app_path", "cli_path", "config_path", "log_path",
    "command", "args", "env", "launch_command", "enabled", "status", "delete",
    "execute", "shell", "token", "api_key", "secret", "password",
    "authorization", "bearer", "access_token", "refresh_token", "cookie"
  ];

  const highRiskKeys = [
    "delete", "execute", "shell", "env", "token", "api_key", "password", "secret", "authorization", "bearer"
  ];

  const keys = Object.keys(changes);
  const hasHighRisk = keys.some(k => highRiskKeys.includes(k));
  if (hasHighRisk) {
    return 'high_risk';
  }

  const sensitiveKeys = ["path", "command", "status", "enabled"];
  const hasSensitive = keys.some(k => sensitiveKeys.includes(k));

  const allowedKeys = keys.filter(k => !forbiddenKeys.includes(k));

  if (allowedKeys.length > 0) {
    return 'repairable';
  } else if (hasSensitive) {
    return 'manual';
  } else {
    return 'high_risk';
  }
}

const getRiskBadge = (level?: string | null) => {
  const lvl = level || 'low';
  switch (lvl) {
    case 'high':
    case 'blocked':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-500/10 text-red-700 dark:text-red-400">high</span>;
    case 'medium':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">medium</span>;
    case 'low':
    default:
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-500/10 text-green-700 dark:text-green-400">low</span>;
  }
};

const getStatusBadge = (status?: string | null) => {
  const st = status || 'unknown';
  switch (st) {
    case 'applied':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-500/10 text-green-700 dark:text-green-400">已应用</span>;
    case 'pending':
    case 'pending_review':
    case 'pending_manual_review':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">待确认</span>;
    case 'blocked':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-500/10 text-red-700 dark:text-red-400">已拦截</span>;
    case 'rejected':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-zinc-500/10 text-zinc-700 dark:text-zinc-400">已拒绝</span>;
    case 'rolled_back':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400">已回滚</span>;
    default:
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground">{st}</span>;
  }
};

function ProposalDetails({ proposal }: { proposal: IntelligenceProposal }) {
  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-foreground">查看详情</summary>
      <pre className="mt-2 max-h-56 overflow-auto rounded border border-border bg-muted/40 p-3 whitespace-pre-wrap">
        {proposal.proposed_changes}
      </pre>
    </details>
  );
}

function ProposalRow({
  proposal,
  actions,
}: {
  proposal: IntelligenceProposal;
  actions?: ReactNode;
}) {
  const reasons = parseReasons(proposal.risk_reasons);
  const displayName = proposal.resource_name || `${proposal.resource_type} / ${proposal.resource_id}`;

  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">
          {displayName}
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {proposal.resource_type} / {proposal.resource_id}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          来源：{(proposal.created_by && creatorLabels[proposal.created_by]) || proposal.created_by || '未知来源'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{proposal.proposal_type}</div>
        {proposal.linked_from && (
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            已由安全重写创建 (原ID: {proposal.linked_from.slice(0, 8)}...)
          </div>
        )}
        <ProposalDetails proposal={proposal} />
      </div>
      <div className="text-sm text-muted-foreground space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">风险:</span> {getRiskBadge(proposal.risk_level)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs">状态:</span> {getStatusBadge(proposal.status)}
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        <div>创建：{formatTime(proposal.created_at)}</div>
        <div className="mt-1">应用：{formatTime(proposal.applied_at)}</div>
        {reasons.length > 0 && (
          <ul className="mt-2 space-y-1">
            {reasons.map(reason => (
              <li key={reason} className="text-red-500 dark:text-red-400">- {reason}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-start gap-2">{actions}</div>
    </div>
  );
}

interface ProposalSectionProps {
  id: string;
  title: string;
  icon: ReactNode;
  count: number;
  summary: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  emptyText: string;
  children: ReactNode;
}

function ProposalSection({
  title,
  icon,
  count,
  summary,
  collapsed,
  onToggle,
  actions,
  emptyText,
  children,
}: ProposalSectionProps) {
  return (
    <section className="mb-6 border border-border bg-card rounded-md overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 bg-muted/10 cursor-pointer select-none hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4.5 w-4.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4.5 w-4.5 text-muted-foreground" />
          )}
          {icon}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
            {count}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground" onClick={e => e.stopPropagation()}>
          <div className="text-xs">{summary}</div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div>
          {count === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<IntelligenceProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // Expanded details panel state for blocked items
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  // Show acknowledged items toggle
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  // Load and save collapsed states in localStorage
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('proposal_collapsed_sections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      pending: false,
      blocked: false,
      autoApplied: true,
    };
  });

  useEffect(() => {
    localStorage.setItem('proposal_collapsed_sections', JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const [expandedAllSections, setExpandedAllSections] = useState<Record<string, boolean>>({
    pending: false,
    blocked: false,
    autoApplied: false,
  });

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setProposals(await listIntelligenceProposals());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Filter datasets
  const autoApplied = useMemo(
    () => proposals.filter(p => p.status === 'applied' && p.auto_applied === 1),
    [proposals],
  );
  const autoAppliedToday = autoApplied.filter(p => isToday(p.applied_at));

  const pendingReview = useMemo(
    () => proposals.filter(p => p.status === 'pending' || p.status === 'pending_review' || p.status === 'pending_manual_review'),
    [proposals],
  );
  const applyablePendingReview = useMemo(
    () => pendingReview.filter(canApplyProposal),
    [pendingReview],
  );

  // Blocked proposals filtering
  const allBlocked = useMemo(
    () => proposals.filter(p => p.status === 'blocked'),
    [proposals],
  );

  const blocked = useMemo(() => {
    if (showAcknowledged) {
      return allBlocked;
    }
    return allBlocked.filter(p => !p.acknowledged_at);
  }, [allBlocked, showAcknowledged]);

  const repairableBlockedCount = useMemo(
    () => allBlocked.filter(p => getBlockedGroup(p) === 'repairable').length,
    [allBlocked],
  );

  const acknowledgedBlockedCount = useMemo(
    () => allBlocked.filter(p => !!p.acknowledged_at).length,
    [allBlocked],
  );

  // Sorting
  const getRiskWeight = (level?: string | null) => {
    if (level === 'high') return 3;
    if (level === 'medium') return 2;
    if (level === 'low') return 1;
    return 0;
  };

  const sortedPendingReview = useMemo(() => {
    return [...pendingReview].sort((a, b) => {
      const rA = getRiskWeight(a.risk_level);
      const rB = getRiskWeight(b.risk_level);
      if (rA !== rB) return rB - rA;

      const isAgentA = a.resource_type === 'agent' ? 1 : 0;
      const isAgentB = b.resource_type === 'agent' ? 1 : 0;
      if (isAgentA !== isAgentB) return isAgentB - isAgentA;

      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });
  }, [pendingReview]);

  const sortedBlocked = useMemo(() => {
    return [...blocked].sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });
  }, [blocked]);

  const sortedAutoApplied = useMemo(() => {
    return [...autoApplied].sort((a, b) => {
      const tA = a.applied_at ? new Date(a.applied_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const tB = b.applied_at ? new Date(b.applied_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return tB - tA;
    });
  }, [autoApplied]);

  // Section visibility slices
  const visiblePending = expandedAllSections.pending
    ? sortedPendingReview
    : sortedPendingReview.slice(0, SECTION_PREVIEW_LIMIT);

  const visibleBlocked = expandedAllSections.blocked
    ? sortedBlocked
    : sortedBlocked.slice(0, SECTION_PREVIEW_LIMIT);

  const visibleAutoApplied = expandedAllSections.autoApplied
    ? sortedAutoApplied
    : sortedAutoApplied.slice(0, SECTION_PREVIEW_LIMIT);

  const runAction = async (action: () => Promise<void>) => {
    setError(null);
    setSuccessMsg(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateSafeVersion = async (proposalId: string) => {
    await runAction(async () => {
      await createSafeRewriteProposal(proposalId);
      setSuccessMsg('已创建安全版本 proposal，请在“待确认”中查看。');
    });
  };

  const handleAcknowledge = async (proposalId: string) => {
    await runAction(async () => {
      await acknowledgeIntelligenceProposal(proposalId);
      setSuccessMsg('已将该 proposal 标记为已了解。');
    });
  };

  const applyAllPending = () =>
    setConfirmDialog({
      title: '批量应用',
      description: `即将应用 ${applyablePendingReview.length} 条可应用 proposal。Agent 类型 proposal、已拦截 proposal、高风险 proposal 不会被直接应用。所有应用操作会记录审计日志，可在支持回滚的情况下回滚。是否继续？`,
      action: async () => {
        for (const proposal of applyablePendingReview) {
          await applyIntelligenceProposal(proposal.id);
        }
      },
    });

  const rejectAllPending = () =>
    setConfirmDialog({
      title: '批量拒绝',
      description: `即将拒绝 ${pendingReview.length} 条待确认 proposal。该操作不会修改本地资源，但会将这些 proposal 标记为 rejected。是否继续？`,
      action: async () => {
        for (const proposal of pendingReview) {
          await rejectIntelligenceProposal(proposal.id);
        }
      },
    });

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Proposals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trust Policy 只判断本地安全边界，内容质量由创建 proposal 的 AI 负责。
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          刷新
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          {successMsg}
        </div>
      )}

      {/* 1. 待确认 Section */}
      <ProposalSection
        id="pending"
        title="待确认"
        icon={<UserCheck className="h-4.5 w-4.5 text-amber-600" />}
        count={pendingReview.length}
        summary={
          <div className="flex gap-2">
            <span>{applyablePendingReview.length} 条可应用</span>
            <span>·</span>
            <span>{pendingReview.length - applyablePendingReview.length} 条仅建议</span>
          </div>
        }
        collapsed={collapsedSections.pending ?? false}
        onToggle={() => setCollapsedSections(prev => ({ ...prev, pending: !prev.pending }))}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={applyAllPending}
              disabled={applyablePendingReview.length === 0}
            >
              批量应用
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rejectAllPending}
              disabled={pendingReview.length === 0}
            >
              批量拒绝
            </Button>
          </>
        }
        emptyText="暂无需要确认的 proposal。外部 AI 或内置 AI 创建的建议会出现在这里。"
      >
        <div className="divide-y divide-border">
          {visiblePending.map(proposal => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              actions={
                <>
                  {canApplyProposal(proposal) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runAction(() => applyIntelligenceProposal(proposal.id))}
                    >
                      应用
                    </Button>
                  ) : (
                    <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                      仅建议
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAction(() => rejectIntelligenceProposal(proposal.id))}
                  >
                    <X className="mr-2 h-4 w-4" />
                    拒绝
                  </Button>
                </>
              }
            />
          ))}
        </div>
        {sortedPendingReview.length > SECTION_PREVIEW_LIMIT && (
          <div className="border-t border-border px-4 py-2 bg-muted/5 flex justify-center">
            <button
              onClick={() => setExpandedAllSections(prev => ({ ...prev, pending: !prev.pending }))}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {expandedAllSections.pending ? '收起到前 10 条' : `显示全部 ${sortedPendingReview.length} 条`}
            </button>
          </div>
        )}
      </ProposalSection>

      {/* 2. 已拦截 Section */}
      <ProposalSection
        id="blocked"
        title="已拦截"
        icon={<ShieldAlert className="h-4.5 w-4.5 text-destructive" />}
        count={blocked.length}
        summary={
          <div className="flex gap-2 items-center">
            <span>{allBlocked.length} 条被 Trust Policy 拦截</span>
            <span>·</span>
            <span>{repairableBlockedCount} 条可生成安全版本</span>
            <span>·</span>
            <span>{acknowledgedBlockedCount} 条已了解</span>
          </div>
        }
        collapsed={collapsedSections.blocked ?? (blocked.length === 0)}
        onToggle={() => setCollapsedSections(prev => ({ ...prev, blocked: !prev.blocked }))}
        actions={
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={e => setShowAcknowledged(e.target.checked)}
              className="rounded border-border"
            />
            显示已了解
          </label>
        }
        emptyText="暂无被 Trust Policy 拦截的高风险 proposal。"
      >
        <div className="p-4 bg-red-500/5 border-b border-border text-xs text-muted-foreground">
          这些 proposal 被 Trust Policy 拦截，表示它们包含越权、危险字段或不允许自动执行的变更。你可以查看原因、拒绝记录，或生成一个移除危险字段后的安全版本。
        </div>

        <div className="divide-y divide-border">
          {visibleBlocked.map(proposal => {
            const group = getBlockedGroup(proposal);
            const repairable = group === 'repairable';
            const isAcknowledge = !!proposal.acknowledged_at;
            const reasons = parseReasons(proposal.risk_reasons);
            const displayName = proposal.resource_name || `${proposal.resource_type} / ${proposal.resource_id}`;

            return (
              <div key={proposal.id} className="p-4 bg-card hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{displayName}</span>
                      {getRiskBadge(proposal.risk_level)}
                      {getStatusBadge(proposal.status)}
                      {isAcknowledge && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                          已了解
                        </span>
                      )}
                      {group === 'repairable' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 rounded">
                          可生成安全版本
                        </span>
                      )}
                      {group === 'manual' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded">
                          需要人工确认，不能自动转安全版本
                        </span>
                      )}
                      {group === 'high_risk' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-700 dark:text-red-400 rounded">
                          高风险，建议拒绝
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>
                        资源：<span className="text-foreground">{proposal.resource_type} / {proposal.resource_id}</span>
                      </div>
                      <div>
                        来源：<span className="text-foreground">{(proposal.created_by && creatorLabels[proposal.created_by]) || proposal.created_by || '未知来源'}</span>
                      </div>
                      {reasons.length > 0 && (
                        <div className="text-red-500 dark:text-red-400 font-medium">
                          拦截原因：{reasons[0]}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedReasons(prev => ({ ...prev, [proposal.id]: !prev[proposal.id] }))}
                    >
                      {expandedReasons[proposal.id] ? '隐藏原因' : '查看原因'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!repairable}
                      onClick={() => handleCreateSafeVersion(proposal.id)}
                      title={!repairable ? "该 proposal 只包含高风险变更，无法生成安全版本。" : ""}
                    >
                      生成安全版本
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runAction(() => rejectIntelligenceProposal(proposal.id))}
                    >
                      拒绝
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isAcknowledge}
                      onClick={() => handleAcknowledge(proposal.id)}
                    >
                      已了解
                    </Button>

                    <div className="relative group inline-block">
                      <Button variant="outline" size="sm" disabled={true}>
                        让 AI 分析
                      </Button>
                      <div className="absolute z-10 hidden group-hover:block bg-popover text-popover-foreground text-[10px] rounded p-2 border border-border shadow-md -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        内置 AI Tool Runtime 完成后启用。
                      </div>
                    </div>
                  </div>
                </div>

                {expandedReasons[proposal.id] && (
                  <div className="mt-3 p-4 border border-red-200 bg-red-50/30 rounded text-xs space-y-3 dark:border-red-900/50 dark:bg-red-950/20">
                    <div>
                      <div className="font-semibold text-red-700 dark:text-red-400 mb-1">
                        违反 Trust Policy 的所有安全拦截原因：
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-red-600 dark:text-red-300">
                        {reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-red-200/50 pt-2 text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">变更类型：</span>
                        {proposal.proposal_type}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">资源类型：</span>
                        {proposal.resource_type}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">创建来源：</span>
                        {(proposal.created_by && creatorLabels[proposal.created_by]) || proposal.created_by || '未知'}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">创建时间：</span>
                        {formatTime(proposal.created_at)}
                      </div>
                    </div>

                    {proposal.linked_from && (
                      <div className="text-emerald-600 dark:text-emerald-400">
                        <span>🔗 关联自拦截 Proposal ID: </span>
                        <code className="text-[10px] bg-emerald-500/10 px-1 rounded">{proposal.linked_from}</code>
                      </div>
                    )}

                    <div className="border-t border-red-200/50 pt-2">
                      <div className="font-medium text-foreground mb-1">提案变更内容 (proposed_changes)：</div>
                      <pre className="p-2 bg-muted rounded border overflow-x-auto text-[10px] text-foreground max-h-48 whitespace-pre-wrap">
                        {proposal.proposed_changes}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {sortedBlocked.length > SECTION_PREVIEW_LIMIT && (
          <div className="border-t border-border px-4 py-2 bg-muted/5 flex justify-center">
            <button
              onClick={() => setExpandedAllSections(prev => ({ ...prev, blocked: !prev.blocked }))}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {expandedAllSections.blocked ? '收起到前 10 条' : `显示全部 ${sortedBlocked.length} 条`}
            </button>
          </div>
        )}
      </ProposalSection>

      {/* 3. 已自动应用 Section */}
      <ProposalSection
        id="autoApplied"
        title="已自动应用"
        icon={<ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />}
        count={autoApplied.length}
        summary={
          <div className="flex gap-2">
            <span>今日 {autoAppliedToday.length} 条</span>
            <span>·</span>
            <span>历史 {autoApplied.length} 条</span>
          </div>
        }
        collapsed={collapsedSections.autoApplied ?? true}
        onToggle={() => setCollapsedSections(prev => ({ ...prev, autoApplied: !prev.autoApplied }))}
        emptyText="暂无自动应用记录。低风险且符合 Trust Policy 的 proposal 会自动应用并记录在这里。"
      >
        <div className="divide-y divide-border">
          {visibleAutoApplied.map(proposal => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAction(() => rollbackIntelligenceProposal(proposal.id))}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  回滚
                </Button>
              }
            />
          ))}
        </div>
        {sortedAutoApplied.length > SECTION_PREVIEW_LIMIT && (
          <div className="border-t border-border px-4 py-2 bg-muted/5 flex justify-center">
            <button
              onClick={() => setExpandedAllSections(prev => ({ ...prev, autoApplied: !prev.autoApplied }))}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {expandedAllSections.autoApplied ? '收起到前 10 条' : `显示全部 ${sortedAutoApplied.length} 条`}
            </button>
          </div>
        )}
      </ProposalSection>

      <Dialog open={confirmDialog !== null} onOpenChange={open => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                const dialog = confirmDialog;
                if (!dialog) return;
                setConfirmDialog(null);
                runAction(dialog.action);
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
