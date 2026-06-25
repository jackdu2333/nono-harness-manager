use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub command: String,
    pub args: Option<String>, // JSON array string
    pub env: Option<String>,  // JSON object string
    pub source_path: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<String>,
    pub confidence: Option<String>,
    pub evidence_files: Option<String>,
    pub manual_override: Option<i64>,
    pub last_analyzed_at: Option<String>,
    pub status: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
