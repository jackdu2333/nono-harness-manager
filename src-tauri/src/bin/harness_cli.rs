// Force recompile to embed all migrations
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::env;
use std::path::PathBuf;

#[allow(dead_code)]
#[path = "../models/mod.rs"]
mod models;
#[allow(dead_code)]
#[path = "../trust_policy.rs"]
mod trust_policy;

// TODO: Migrate harness_cli list/context/propose to reuse ai::safe_tools so
// MCP Server, CLI, and Built-in AI share one safe context and redaction layer.
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
            println!(
                "{}",
                serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?
            );
        }
        "context" => {
            let resource_type = args.get(1).ok_or_else(usage)?;
            let resource_id = args.get(2).ok_or_else(usage)?;
            let output = get_context(&pool, resource_type, resource_id).await?;
            println!(
                "{}",
                serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?
            );
        }
        "propose" => {
            let resource_type = args.get(1).ok_or_else(usage)?;
            let resource_id = args.get(2).ok_or_else(usage)?;
            let proposal_type = args.get(3).ok_or_else(usage)?;
            let proposed_changes = args.get(4).ok_or_else(usage)?;
            let output = create_proposal(
                &pool,
                resource_type,
                resource_id,
                proposal_type,
                proposed_changes,
            )
            .await?;
            println!(
                "{}",
                serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?
            );
        }
        "rollback" => {
            let proposal_id = args.get(1).ok_or_else(usage)?;
            trust_policy::rollback_proposal(&pool, proposal_id, "harness_cli").await?;
            println!(r#"{{"id":"{}","status":"rolled_back"}}"#, proposal_id);
        }
        "reject" => {
            let proposal_id = args.get(1).ok_or_else(usage)?;
            trust_policy::reject_proposal(&pool, proposal_id, "harness_cli").await?;
            println!(r#"{{"id":"{}","status":"rejected"}}"#, proposal_id);
        }
        _ => return Err(usage()),
    }

    Ok(())
}

async fn connect_pool() -> Result<SqlitePool, String> {
    let db_path = if let Ok(path) = env::var("HARNESS_DB_PATH") {
        PathBuf::from(path)
    } else {
        let data_dir =
            dirs::data_dir().ok_or_else(|| "Unable to resolve user data directory".to_string())?;
        data_dir
            .join("com.jackdu.nono-harness-manager")
            .join("harness.db")
    };

    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());
    let pool = SqlitePool::connect(&db_url).await.map_err(|e| {
        format!(
            "Failed to connect Harness database at {}: {}",
            db_path.display(),
            e
        )
    })?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("Failed to run database migrations: {}", e))?;

    Ok(pool)
}

async fn list_resources(pool: &SqlitePool, resource_type: Option<&str>) -> Result<Value, String> {
    let types = match resource_type {
        Some(t) => vec![t],
        None => vec!["skill", "mcp_server", "agent"],
    };
    let mut combined_resources = Vec::new();
    for t in types {
        let raw = nono_harness_manager_lib::ai::tools::resource::list_resources_raw(
            t.to_string(),
            50,
            pool,
        )
        .await?;
        if let Some(arr) = raw.get("resources").and_then(|r| r.as_array()) {
            combined_resources.extend(arr.clone());
        }
    }
    let output = json!({ "resources": combined_resources });
    let sanitized = nono_harness_manager_lib::ai::safe_tools::redact_sensitive_fields(output);
    Ok(sanitized)
}

async fn get_context(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
) -> Result<Value, String> {
    let raw = nono_harness_manager_lib::ai::tools::resource::get_resource_context_raw(
        resource_type.to_string(),
        resource_id.to_string(),
        pool,
    )
    .await?;
    let sanitized = nono_harness_manager_lib::ai::safe_tools::redact_sensitive_fields(raw);
    Ok(sanitized)
}

async fn create_proposal(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
    proposal_type: &str,
    proposed_changes: &str,
) -> Result<Value, String> {
    let ctx = nono_harness_manager_lib::ai::safe_tools::ToolContext { pool };
    let changes_val: Value = serde_json::from_str(proposed_changes)
        .map_err(|e| format!("proposed_changes must be JSON: {}", e))?;
    let out =
        nono_harness_manager_lib::ai::tools::proposal::create_governance_proposal_with_creator(
            resource_type.to_string(),
            resource_id.to_string(),
            proposal_type.to_string(),
            changes_val,
            "harness_cli",
            &ctx,
        )
        .await?;
    Ok(out.data)
}

fn usage() -> String {
    "Usage: harness_cli list [skill|mcp_server|agent] | context <skill|mcp_server|agent> <id> | propose <type> <id> <proposal_type> '<json>' | rollback <proposal_id> | reject <proposal_id>".to_string()
}
