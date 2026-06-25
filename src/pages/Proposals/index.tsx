import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RotateCcw, ShieldAlert, ShieldCheck, UserCheck, X } from 'lucide-react';
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
} from '@/features/proposals/api';
import type { IntelligenceProposal } from '@/features/proposals/types';

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
        <div className="mt-1 text-xs text-muted-foreground">{proposal.proposal_type}</div>
        <ProposalDetails proposal={proposal} />
      </div>
      <div className="text-sm text-muted-foreground">
        <div>风险：{proposal.risk_level ?? '未评估'}</div>
        <div className="mt-1">状态：{proposal.status ?? 'unknown'}</div>
      </div>
      <div className="text-sm text-muted-foreground">
        <div>创建：{formatTime(proposal.created_at)}</div>
        <div className="mt-1">应用：{formatTime(proposal.applied_at)}</div>
        {reasons.length > 0 && (
          <ul className="mt-2 space-y-1">
            {reasons.map(reason => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-start gap-2">{actions}</div>
    </div>
  );
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<IntelligenceProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

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

  const autoApplied = useMemo(
    () => proposals.filter(p => p.status === 'applied' && p.auto_applied === 1),
    [proposals],
  );
  const autoAppliedToday = autoApplied.filter(p => isToday(p.applied_at));
  const pendingReview = useMemo(
    () => proposals.filter(p => p.status === 'pending_review' || p.status === 'pending_manual_review'),
    [proposals],
  );
  const blocked = useMemo(
    () => proposals.filter(p => p.status === 'blocked'),
    [proposals],
  );

  const runAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const applyAllPending = () =>
    setConfirmDialog({
      title: '批量应用',
      description: `即将应用 ${pendingReview.length} 条 medium-risk proposal，是否继续？`,
      action: async () => {
        for (const proposal of pendingReview) {
          await applyIntelligenceProposal(proposal.id);
        }
      },
    });

  const rejectAllPending = () =>
    setConfirmDialog({
      title: '批量拒绝',
      description: `即将拒绝 ${pendingReview.length} 条 pending proposal，是否继续？`,
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

      <section className="mb-6 border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-foreground">已自动应用</h2>
          </div>
          <div className="text-sm text-muted-foreground">
            今天自动应用 {autoAppliedToday.length} 条
          </div>
        </div>
        {autoApplied.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">暂无自动应用记录。</div>
        ) : (
          autoApplied.map(proposal => (
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
          ))
        )}
      </section>

      <section className="mb-6 border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-foreground">待确认</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={applyAllPending} disabled={pendingReview.length === 0}>
              批量应用
            </Button>
            <Button variant="outline" size="sm" onClick={rejectAllPending} disabled={pendingReview.length === 0}>
              批量拒绝
            </Button>
          </div>
        </div>
        {pendingReview.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">暂无需要确认的 proposal。</div>
        ) : (
          pendingReview.map(proposal => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAction(() => applyIntelligenceProposal(proposal.id))}
                  >
                    应用
                  </Button>
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
          ))
        )}
      </section>

      <section className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">已拦截</h2>
          </div>
          <div className="text-sm text-muted-foreground">{blocked.length} 条</div>
        </div>
        {blocked.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">暂无被拦截的高风险 proposal。</div>
        ) : (
         blocked.map(proposal => <ProposalRow key={proposal.id} proposal={proposal} />)
       )}
     </section>
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
