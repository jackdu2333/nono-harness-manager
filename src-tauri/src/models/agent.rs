use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub r#type: Option<String>,
    pub app_path: Option<String>,
    pub launch_command: Option<String>,
    pub config_path: Option<String>,
    pub default_workspace: Option<String>,
    pub status: Option<String>,
    pub launch_count: i64,
    pub last_launched_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
