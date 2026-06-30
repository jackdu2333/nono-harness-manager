import type { IntelligenceProposal } from '@/features/proposals/types';
import type { GovernanceSuggestion } from '../types';

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

export function analyzeProposalRules(
  proposals: IntelligenceProposal[],
): GovernanceSuggestion[] {
  const suggestions: GovernanceSuggestion[] = [];
  const now = Date.now();

  // Rule 1: pending_review
  const pendingReview = proposals.filter(
    (p) => p.status === 'pending_review',
  );
  if (pendingReview.length > 0) {
    suggestions.push({
      id: 'proposal.pending_review',
      title: `有 ${pendingReview.length} 个 Proposals 待审核`,
      reason: '这些 Proposal 已通过 Trust Policy 初筛，等待人工确认。',
      severity: 'warning',
      resource_type: 'proposal',
      resource_id: null,
      resource_count: pendingReview.length,
      action_label: '去审核',
      action_target: '/proposals',
      can_create_proposal: false,
      rule_id: 'proposal.pending_review',
    });
  }

  // Rule 2: pending_manual_review
  const pendingManual = proposals.filter(
    (p) => p.status === 'pending_manual_review',
  );
  if (pendingManual.length > 0) {
    suggestions.push({
      id: 'proposal.pending_manual',
      title: `有 ${pendingManual.length} 个 Proposals 待人工审核`,
      reason: '这些 Proposal 风险较高，必须由用户手动审核后才能应用。',
      severity: 'warning',
      resource_type: 'proposal',
      resource_id: null,
      resource_count: pendingManual.length,
      action_label: '去审核',
      action_target: '/proposals',
      can_create_proposal: false,
      rule_id: 'proposal.pending_manual',
    });
  }

  // Rule 3: blocked
  const blocked = proposals.filter((p) => p.status === 'blocked');
  if (blocked.length > 0) {
    suggestions.push({
      id: 'proposal.blocked',
      title: `有 ${blocked.length} 个 Proposals 被阻塞`,
      reason: '被阻塞的 Proposal 可能涉及危险字段或高风险操作，需要人工处理。',
      severity: 'critical',
      resource_type: 'proposal',
      resource_id: null,
      resource_count: blocked.length,
      action_label: '去处理',
      action_target: '/proposals',
      can_create_proposal: false,
      rule_id: 'proposal.blocked',
    });
  }

  // Rule 4: stale proposals (> 7 days pending)
  const stale = proposals.filter((p) => {
    const status = p.status;
    if (
      status !== 'pending_review' &&
      status !== 'pending_manual_review' &&
      status !== 'blocked' &&
      status !== 'pending'
    ) {
      return false;
    }
    return (now - new Date(p.created_at).getTime()) > SEVEN_DAYS_MS;
  });
  if (stale.length > 0) {
    suggestions.push({
      id: 'proposal.stale',
      title: `有 ${stale.length} 个 Proposals 超过 7 天未处理`,
      reason: '长时间未处理的 Proposal 可能已过时，建议尽快审核或驳回。',
      severity: 'warning',
      resource_type: 'proposal',
      resource_id: null,
      resource_count: stale.length,
      action_label: '去处理',
      action_target: '/proposals',
      can_create_proposal: false,
      rule_id: 'proposal.stale',
    });
  }

  return suggestions;
}
