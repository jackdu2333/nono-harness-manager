pub mod mcp_repository;
pub mod repositories;

use sqlx::SqlitePool;
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

pub async fn init_db(app_handle: &AppHandle) -> Result<SqlitePool, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_dir.join("harness.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());

    let pool = SqlitePool::connect(&db_url)
        .await
        .map_err(|e| format!("Failed to connect SQLite: {}", e))?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("Failed to run database migrations: {}", e))?;

    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Row;

    #[tokio::test]
    async fn migrations_create_phase_one_schema() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory sqlite should connect");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrations should run");

        for table in [
            "agents",
            "skill_sources",
            "skills",
            "scan_logs",
            "resource_usage_events",
            "settings",
            "mcp_servers",
        ] {
            let exists: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
            )
            .bind(table)
            .fetch_one(&pool)
            .await
            .expect("table lookup should succeed");
            assert_eq!(exists.0, 1, "{table} should exist");
        }

        let skill_columns = sqlx::query("PRAGMA table_info(skills)")
            .fetch_all(&pool)
            .await
            .expect("skills columns should be readable")
            .into_iter()
            .map(|row| row.get::<String, _>("name"))
            .collect::<Vec<_>>();

        for column in [
            "description_source",
            "description_confidence",
            "description_updated_at",
            "description_is_manual",
            "summary",
            "tags",
            "confidence",
            "evidence_files",
            "manual_override",
            "last_analyzed_at",
        ] {
            assert!(
                skill_columns.iter().any(|name| name == column),
                "{column} should exist on skills"
            );
        }

        for table in ["intelligence_proposals", "audit_logs"] {
            let exists: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
            )
            .bind(table)
            .fetch_one(&pool)
            .await
            .expect("table lookup should succeed");
            assert_eq!(exists.0, 1, "{table} should exist");
        }

        let proposal_columns = sqlx::query("PRAGMA table_info(intelligence_proposals)")
            .fetch_all(&pool)
            .await
            .expect("intelligence_proposals columns should be readable")
            .into_iter()
            .map(|row| row.get::<String, _>("name"))
            .collect::<Vec<_>>();

        for column in [
            "risk_level",
            "risk_reasons",
            "auto_applied",
            "trust_policy_version",
        ] {
            assert!(
                proposal_columns.iter().any(|name| name == column),
                "{column} should exist on intelligence_proposals"
            );
        }

        for key in [
            "auto_apply_low_risk",
            "require_evidence_files",
            "allowed_auto_apply_resource_types",
            "allowed_auto_apply_fields",
            "min_confidence_for_auto_apply",
            "max_auto_apply_batch_size",
        ] {
            let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM settings WHERE key = ?")
                .bind(key)
                .fetch_one(&pool)
                .await
                .expect("trust policy setting lookup should succeed");
            assert_eq!(exists.0, 1, "{key} setting should exist");
        }
    }
}
