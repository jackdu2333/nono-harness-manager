import { invoke } from '@tauri-apps/api/core';
import type { IntelligenceProposal } from './types';

export async function listIntelligenceProposals(status?: string): Promise<IntelligenceProposal[]> {
  return invoke('list_intelligence_proposals', { status: status ?? null });
}

export async function applyIntelligenceProposal(proposalId: string): Promise<void> {
  return invoke('apply_intelligence_proposal', { proposalId, actor: 'user' });
}

export async function rejectIntelligenceProposal(proposalId: string): Promise<void> {
  return invoke('reject_intelligence_proposal', { proposalId, actor: 'user' });
}

export async function rollbackIntelligenceProposal(proposalId: string): Promise<void> {
  return invoke('rollback_intelligence_proposal', { proposalId, actor: 'user' });
}
