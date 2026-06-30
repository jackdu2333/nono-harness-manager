import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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

function getCreatorLabel(t: (key: string, opts?: Record<string, unknown>) => string, key?: string | null): string {
  switch (key) {
    case 'built_in_ai':
      return t('proposals.source_builtin_ai');
    case 'codex':
      return 'Codex';
    case 'mcp':
      return 'MCP';
    case 'manual':
      return t('proposals.source_manual');
    case 'rule_engine':
      return t('proposals.source_rule_engine');
    case 'user_rewrite':
      return t('proposals.source_manual_rewrite');
    case 'built_in_ai_rewrite':
      return t('proposals.source_ai_rewrite');
    default:
      return key || t('common.unknown');
  }
}

function parseReasons(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return [raw];
  }
}

function formatTime(t: (key: string, opts?: Record<string, unknown>) => string, value?: string | null) {
  if (!value) return t('common.not_recorded');
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

function collectProposalKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectProposalKeys);
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    key,
    ...collectProposalKeys(child),
  ]);
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

  const keys = collectProposalKeys(changes);
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

const getRiskBadge = (t: (key: string, opts?: Record<string, unknown>) => string, level?: string | null) => {
  const lvl = level || 'low';
  switch (lvl) {
    case 'high':
    case 'blocked':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-destructive/10 text-destructive">high</span>;
    case 'medium':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-warning/10 text-warning">medium</span>;
    case 'low':
    default:
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-success/10 text-success">low</span>;
  }
};

const getStatusBadge = (t: (key: string, opts?: Record<string, unknown>) => string, status?: string | null) => {
  const st = status || 'unknown';
  switch (st) {
    case 'applied':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-success/10 text-success">{t('proposals.status_applied')}</span>;
    case 'pending':
    case 'pending_review':
    case 'pending_manual_review':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-warning/10 text-warning">{t('proposals.status_pending_review')}</span>;
    case 'blocked':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-destructive/10 text-destructive">{t('proposals.status_blocked')}</span>;
    case 'rejected':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground">{t('proposals.status_rejected')}</span>;
    case 'rolled_back':
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400">{t('proposals.status_rolled_back')}</span>;
    default:
      return <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground">{st}</span>;
  }
};

function ProposalDetails({ t, proposal }: { t: (key: string, opts?: Record<string, unknown>) => string; proposal: IntelligenceProposal }) {
  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-foreground">{t('proposals.view_detail')}</summary>
      <pre className="mt-2 max-h-56 overflow-auto rounded border border-border bg-muted/40 p-3 whitespace-pre-wrap">
        {proposal.proposed_changes}
      </pre>
    </details>
  );
}

function ProposalRow({
  t,
  proposal,
  actions,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
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
          {t('proposals.source_label', { source: getCreatorLabel(t, proposal.created_by) })}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{proposal.proposal_type}</div>
        {proposal.linked_from && (
          <div className="mt-1 text-xs text-success">
            {t('proposals.safety_rewrite_created', { id: proposal.linked_from.slice(0, 8) })}
          </div>
        )}
        <ProposalDetails t={t} proposal={proposal} />
      </div>
      <div className="text-sm text-muted-foreground space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{t('proposals.risk_label')}</span> {getRiskBadge(t, proposal.risk_level)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{t('proposals.status_label')}</span> {getStatusBadge(t, proposal.status)}
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        <div>{t('proposals.created', { time: formatTime(t, proposal.created_at) })}</div>
        <div className="mt-1">{t('proposals.applied', { time: formatTime(t, proposal.applied_at) })}</div>
        {reasons.length > 0 && (
          <ul className="mt-2 space-y-1">
            {reasons.map(reason => (
              <li key={reason} className="text-destructive">- {reason}</li>
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
  const { t } = useTranslation();
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
      setSuccessMsg(t('proposals.safety_version_created'));
    });
  };

  const handleAcknowledge = async (proposalId: string) => {
    await runAction(async () => {
      await acknowledgeIntelligenceProposal(proposalId);
      setSuccessMsg(t('proposals.acknowledged'));
    });
  };

  const applyAllPending = () =>
    setConfirmDialog({
      title: t('proposals.batch_apply'),
      description: t('proposals.batch_apply_desc', { count: applyablePendingReview.length }),
      action: async () => {
        for (const proposal of applyablePendingReview) {
          await applyIntelligenceProposal(proposal.id);
        }
      },
    });

  const rejectAllPending = () =>
    setConfirmDialog({
      title: t('proposals.batch_reject'),
      description: t('proposals.batch_reject_desc', { count: pendingReview.length }),
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
            {t('proposals.trust_policy_note')}
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          {t('common.refresh')}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {successMsg}
        </div>
      )}

      {/* 1. 待确认 Section */}
      <ProposalSection
        id="pending"
        title={t('proposals.pending_title')}
        icon={<UserCheck className="h-4.5 w-4.5 text-warning" />}
        count={pendingReview.length}
        summary={
          <div className="flex gap-2">
            <span>{t('proposals.pending_applyable', { count: applyablePendingReview.length })}</span>
            <span>·</span>
            <span>{t('proposals.pending_suggest_only', { count: pendingReview.length - applyablePendingReview.length })}</span>
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
              {t('proposals.batch_apply')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rejectAllPending}
              disabled={pendingReview.length === 0}
            >
              {t('proposals.batch_reject')}
            </Button>
          </>
        }
        emptyText={t('proposals.pending_empty')}
      >
        <div className="divide-y divide-border">
          {visiblePending.map(proposal => (
            <ProposalRow
              key={proposal.id}
              t={t}
              proposal={proposal}
              actions={
                <>
                  {canApplyProposal(proposal) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runAction(() => applyIntelligenceProposal(proposal.id))}
                    >
                      {t('proposals.apply')}
                    </Button>
                  ) : (
                    <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                      {t('proposals.suggest_only')}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAction(() => rejectIntelligenceProposal(proposal.id))}
                  >
                    <X className="mr-2 h-4 w-4" />
                    {t('proposals.reject')}
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
              {expandedAllSections.pending ? t('proposals.collapse_to_10') : t('proposals.show_more', { count: sortedPendingReview.length })}
            </button>
          </div>
        )}
      </ProposalSection>

      {/* 2. 已拦截 Section */}
      <ProposalSection
        id="blocked"
        title={t('proposals.blocked_title')}
        icon={<ShieldAlert className="h-4.5 w-4.5 text-destructive" />}
        count={blocked.length}
        summary={
          <div className="flex gap-2 items-center">
            <span>{t('proposals.blocked_count', { count: allBlocked.length })}</span>
            <span>·</span>
            <span>{t('proposals.blocked_repairable', { count: repairableBlockedCount })}</span>
            <span>·</span>
            <span>{t('proposals.blocked_acknowledged', { count: acknowledgedBlockedCount })}</span>
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
            {t('proposals.show_acknowledged')}
          </label>
        }
        emptyText={t('proposals.blocked_empty')}
      >
        <div className="p-4 bg-destructive/5 border-b border-border text-xs text-muted-foreground">
          {t('proposals.blocked_desc')}
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
                      {getRiskBadge(t, proposal.risk_level)}
                      {getStatusBadge(t, proposal.status)}
                      {isAcknowledge && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">
                          {t('proposals.acknowledge')}
                        </span>
                      )}
                      {group === 'repairable' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-success/10 text-success rounded">
                          {t('proposals.gen_safe_version')}
                        </span>
                      )}
                      {group === 'manual' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-warning/10 text-warning rounded">
                          {t('proposals.manual_confirm')}
                        </span>
                      )}
                      {group === 'high_risk' && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-destructive/10 text-destructive rounded">
                          {t('proposals.high_risk_reject')}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>
                        {t('proposals.resource_label', { resource: `${proposal.resource_type} / ${proposal.resource_id}` })}
                      </div>
                      <div>
                        {t('proposals.source_label', { source: getCreatorLabel(t, proposal.created_by) })}
                      </div>
                      {reasons.length > 0 && (
                        <div className="text-destructive font-medium">
                          {t('proposals.block_reason', { reason: reasons[0] })}
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
                      {expandedReasons[proposal.id] ? t('proposals.hide_reason') : t('proposals.view_reason')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!repairable}
                      onClick={() => handleCreateSafeVersion(proposal.id)}
                      title={!repairable ? t('proposals.no_safe_version') : ""}
                    >
                      {t('proposals.gen_safe')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runAction(() => rejectIntelligenceProposal(proposal.id))}
                    >
                      {t('proposals.reject')}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isAcknowledge}
                      onClick={() => handleAcknowledge(proposal.id)}
                    >
                      {t('proposals.acknowledge')}
                    </Button>

                    <div className="relative group inline-block">
                      <Button variant="outline" size="sm" disabled={true}>
                        {t('proposals.let_ai_analyze')}
                      </Button>
                      <div className="absolute z-10 hidden group-hover:block bg-popover text-popover-foreground text-[10px] rounded p-2 border border-border shadow-md -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        {t('proposals.ai_runtime_note')}
                      </div>
                    </div>
                  </div>
                </div>

                {expandedReasons[proposal.id] && (
                  <div className="mt-3 p-4 border border-destructive/30 bg-destructive/5 rounded text-xs space-y-3">
                    <div>
                      <div className="font-semibold text-destructive mb-1">
                        {t('proposals.all_block_reasons')}
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-destructive">
                        {reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-destructive/30 pt-2 text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">{t('proposals.change_type')}</span>
                        {proposal.proposal_type}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t('proposals.resource_type')}</span>
                        {proposal.resource_type}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t('proposals.create_source')}</span>
                        {getCreatorLabel(t, proposal.created_by)}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{t('proposals.create_time')}</span>
                        {formatTime(t, proposal.created_at)}
                      </div>
                    </div>

                    {proposal.linked_from && (
                      <div className="text-success">
                        <span>{t('proposals.linked_from')} </span>
                        <code className="text-[10px] bg-success/10 px-1 rounded">{proposal.linked_from}</code>
                      </div>
                    )}

                    <div className="border-t border-destructive/30 pt-2">
                      <div className="font-medium text-foreground mb-1">{t('proposals.proposed_changes')}</div>
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
              {expandedAllSections.blocked ? t('proposals.collapse_to_10') : t('proposals.show_more', { count: sortedBlocked.length })}
            </button>
          </div>
        )}
      </ProposalSection>

      {/* 3. 已自动应用 Section */}
      <ProposalSection
        id="autoApplied"
        title={t('proposals.auto_applied_title')}
        icon={<ShieldCheck className="h-4.5 w-4.5 text-success" />}
        count={autoApplied.length}
        summary={
          <div className="flex gap-2">
            <span>{t('proposals.auto_applied_today', { count: autoAppliedToday.length })}</span>
            <span>·</span>
            <span>{t('proposals.auto_applied_history', { count: autoApplied.length })}</span>
          </div>
        }
        collapsed={collapsedSections.autoApplied ?? true}
        onToggle={() => setCollapsedSections(prev => ({ ...prev, autoApplied: !prev.autoApplied }))}
        emptyText={t('proposals.auto_applied_empty')}
      >
        <div className="divide-y divide-border">
          {visibleAutoApplied.map(proposal => (
            <ProposalRow
              key={proposal.id}
              t={t}
              proposal={proposal}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAction(() => rollbackIntelligenceProposal(proposal.id))}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('proposals.rollback')}
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
              {expandedAllSections.autoApplied ? t('proposals.collapse_to_10') : t('proposals.show_more', { count: sortedAutoApplied.length })}
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
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                const dialog = confirmDialog;
                if (!dialog) return;
                setConfirmDialog(null);
                runAction(dialog.action);
              }}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
