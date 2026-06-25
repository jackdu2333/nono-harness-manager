use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::env;
use std::path::PathBuf;
use uuid::Uuid;

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("{err}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let Some(command) = args.first().map(String::as_str) else {
        return Err(usage());
    };

    let pool = connect_pool().await?;

    match command {
        "list" => {
            let resource_type = args.get(1).map(String::as_str);
            let output = list_resources(&pool, resource_type).await?;
            println!("{}", serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?);
        }
        "context" => {
            let resource_type = args.get(1).ok_or_else(usage)?;
            let resource_id = args.get(2).ok_or_else(usage)?;
            let output = get_context(&pool, resource_type, resource_id).await?;
            println!("{}", serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?);
        }
        "propose" => {
            let resource_type = args.get(1).ok_or_else(usage)?;
            let resource_id = args.get(2).ok_or_else(usage)?;
            let proposal_type = args.get(3).ok_or_else(usage)?;
            let proposed_changes = args.get(4).ok_or_else(usage)?;
            let output = create_proposal(&pool, resource_type, resource_id, proposal_type, proposed_changes).await?;
            println!("{}", serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?);
        }
        _ => return Err(usage()),
    }

    Ok(())
}

async fn connect_pool() -> Result<SqlitePool, String> {
    let db_path = if let Ok(path) = env::var("HARNESS_DB_PATH") {
        PathBuf::from(path)
    } else {
        let data_dir = dirs::data_dir().ok_or_else(|| "Unable to resolve user data directory".to_string())?;
        data_dir
            .join("com.jackdu.nono-harness-manager")
            .join("harness.db")
    };

    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());
    let pool = SqlitePool::connect(&db_url)
        .await
        .map_err(|e| format!("Failed to connect Harness database at {}: {}", db_path.display(), e))?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("Failed to run database migrations: {}", e))?;

    Ok(pool)
}

async fn list_resources(pool: &SqlitePool, resource_type: Option<&str>) -> Result<Value, String> {
    let mut resources = Vec::new();

    if resource_type.is_none() || resource_type == Some("skill") {
        let rows = sqlx::query(
            "SELECT id, name, description, summary, category, tags, confidence, status FROM skills ORDER BY updated_at DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        resources.extend(rows.into_iter().map(|row| json!({
            "resource_type": "skill",
            "id": row.get::<String, _>("id"),
            "name": row.get::<String, _>("name"),
            "description": row.get::<Option<String>, _>("description"),
            "summary": row.get::<Option<String>, _>("summary"),
            "category": row.get::<Option<String>, _>("category"),
            "tags": row.get::<Option<String>, _>("tags"),
            "confidence": row.get::<Option<String>, _>("confidence"),
            "status": row.get::<String, _>("status"),
        })));
    }

    if resource_type.is_none() || resource_type == Some("mcp_server") {
        let rows = sqlx::query(
            "SELECT id, name, description, summary, category, tags, confidence, status FROM mcp_servers ORDER BY updated_at DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        resources.extend(rows.into_iter().map(|row| json!({
            "resource_type": "mcp_server",
            "id": row.get::<String, _>("id"),
            "name": row.get::<String, _>("name"),
            "description": row.get::<Option<String>, _>("description"),
            "summary": row.get::<Option<String>, _>("summary"),
            "category": row.get::<Option<String>, _>("category"),
            "tags": row.get::<Option<String>, _>("tags"),
            "confidence": row.get::<Option<String>, _>("confidence"),
            "status": row.get::<Option<String>, _>("status"),
        })));
    }

    Ok(json!({ "resources": resources }))
}

async fn get_context(pool: &SqlitePool, resource_type: &str, resource_id: &str) -> Result<Value, String> {
    match resource_type {
        "skill" => {
            let row = sqlx::query(
                "SELECT id, name, description, summary, category, tags, confidence, path, entry_file, evidence_files FROM skills WHERE id = ?"
            )
            .bind(resource_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
            Ok(json!({
                "resource_type": "skill",
                "id": row.get::<String, _>("id"),
                "name": row.get::<String, _>("name"),
                "description": row.get::<Option<String>, _>("description"),
                "summary": row.get::<Option<String>, _>("summary"),
                "category": row.get::<Option<String>, _>("category"),
                "tags": row.get::<Option<String>, _>("tags"),
                "confidence": row.get::<Option<String>, _>("confidence"),
                "safe_context": {
                    "path": row.get::<String, _>("path"),
                    "entry_file": row.get::<Option<String>, _>("entry_file")
                },
                "evidence_files": row.get::<Option<String>, _>("evidence_files")
            }))
        }
        "mcp_server" => {
            let row = sqlx::query(
                "SELECT id, name, description, summary, category, tags, confidence, source_path, command, args, env, evidence_files FROM mcp_servers WHERE id = ?"
            )
            .bind(resource_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
            Ok(json!({
                "resource_type": "mcp_server",
                "id": row.get::<String, _>("id"),
                "name": row.get::<String, _>("name"),
                "description": row.get::<Option<String>, _>("description"),
                "summary": row.get::<Option<String>, _>("summary"),
                "category": row.get::<Option<String>, _>("category"),
                "tags": row.get::<Option<String>, _>("tags"),
                "confidence": row.get::<Option<String>, _>("confidence"),
                "safe_context": {
                    "source_path": row.get::<Option<String>, _>("source_path"),
                    "command": row.get::<String, _>("command"),
                    "args": row.get::<Option<String>, _>("args"),
                    "env": row.get::<Option<String>, _>("env")
                },
                "evidence_files": row.get::<Option<String>, _>("evidence_files")
            }))
        }
        _ => Err("Unsupported resource type".to_string()),
    }
}

async fn create_proposal(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
    proposal_type: &str,
    proposed_changes: &str,
) -> Result<Value, String> {
    let _: Value = serde_json::from_str(proposed_changes)
        .map_err(|e| format!("proposed_changes must be JSON: {}", e))?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO intelligence_proposals
          (id, resource_type, resource_id, proposal_type, proposed_changes, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', 'harness_cli', ?)
        "#
    )
    .bind(&id)
    .bind(resource_type)
    .bind(resource_id)
    .bind(proposal_type)
    .bind(proposed_changes)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!({
        "id": id,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "proposal_type": proposal_type,
        "status": "pending",
        "created_by": "harness_cli",
        "created_at": now
    }))
}

fn usage() -> String {
    "Usage: harness_cli list [skill|mcp_server] | context <skill|mcp_server> <id> | propose <type> <id> <proposal_type> '<json>'".to_string()
}
