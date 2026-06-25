use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Skill {
    pub id: String,
    pub source_id: Option<String>,
    pub name: String,
    pub path: String,
    pub skill_type: Option<String>,
    pub category: Option<String>,
    pub subcategory: Option<String>,
    pub description: Option<String>,
    pub description_source: Option<String>,
    pub description_confidence: Option<String>,
    pub description_updated_at: Option<String>,
    pub description_is_manual: Option<i64>,
    pub summary: Option<String>,
    pub tags: Option<String>,
    pub confidence: Option<String>,
    pub evidence_files: Option<String>,
    pub manual_override: Option<i64>,
    pub last_analyzed_at: Option<String>,
    pub status: String,
    pub entry_file: Option<String>,
    pub metadata_path: Option<String>,
    pub has_metadata: i64,
    pub is_executable: i64,
    pub total_usage_count: i64,
    pub last_used_at: Option<String>,
    pub last_modified_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
