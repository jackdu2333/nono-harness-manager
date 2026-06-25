export type ProposalStatus =
  | 'pending'
  | 'pending_review'
  | 'blocked'
  | 'pending_manual_review'
  | 'applied'
  | 'rejected'
  | 'rolled_back';

export interface IntelligenceProposal {
  id: string;
  resource_type: string;
  resource_id: string;
  proposal_type: string;
  proposed_changes: string;
  evidence_files?: string | null;
  confidence?: string | null;
  status?: ProposalStatus | string | null;
  created_by?: string | null;
  created_at: string;
  applied_at?: string | null;
  risk_level?: 'low' | 'medium' | 'high' | string | null;
  risk_reasons?: string | null;
  auto_applied?: number | null;
  trust_policy_version?: string | null;
  resource_name?: string | null;
}
