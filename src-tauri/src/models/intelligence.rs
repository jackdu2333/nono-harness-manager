use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HarnessResourceSummary {
    pub resource_type: String,
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub summary: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub confidence: Option<String>,
    pub manual_override: Option<i64>,
    pub last_analyzed_at: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HarnessResourceContext {
    pub resource: HarnessResourceSummary,
    pub safe_context: serde_json::Value,
    pub evidence_files: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct IntelligenceProposal {
    pub id: String,
    pub resource_type: String,
    pub resource_id: String,
    pub proposal_type: String,
    pub proposed_changes: String,
    pub evidence_files: Option<String>,
    pub confidence: Option<String>,
    pub status: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
    pub applied_at: Option<String>,
}
