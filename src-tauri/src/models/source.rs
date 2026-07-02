use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[cfg_attr(test, allow(dead_code))]
#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct SkillSource {
    pub id: String,
    pub name: String,
    pub path: String,
    pub source_type: Option<String>,
    pub enabled: i64,
    pub scan_depth: i64,
    pub last_scanned_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
