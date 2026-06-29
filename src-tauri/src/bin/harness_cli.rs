// Force recompile to embed all migrations
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::env;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[allow(dead_code)]
#[path = "../models/mod.rs"]
mod models;
#[allow(dead_code)]
#[path = "../trust_policy.rs"]
mod trust_policy;

const SAFE_CONTEXT_MAX_CHARS: usize = 2048;
const SAFE_CONTEXT_FILES: &[&str] = &[
    "README.md",
    "readme.md",
    "SKILL.md",
    "skill.md",
    "skill.yaml",
    "skill.json",
];
const LOG_ADAPTER_SUPPORTED_AGENT_KEYS: &[&str] = &[
    "codex",
    "antigravity",
    "antigravity_cli",
    "antigravity_ide",
    "workbuddy",
    "newmax",
    "claude_code",
];
const AGENT_PROPOSAL_TYPES: &[&str] = &[
    "update_agent_metadata",
    "suggest_agent_confirmation",
    "suggest_agent_ignore",
    "fix_agent_paths",
    "improve_agent_detection_rule",
    "explain_agent_launch_strategy",
];
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
    let mut resources = Vec::new();

    if resource_type.is_none() || resource_type == Some("skill") {
        let rows = sqlx::query(
            "SELECT id, name, description, summary, category, tags, confidence, status FROM skills ORDER BY updated_at DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        resources.extend(rows.into_iter().map(|row| {
            json!({
                "resource_type": "skill",
                "id": row.get::<String, _>("id"),
                "name": row.get::<String, _>("name"),
                "description": row.get::<Option<String>, _>("description"),
                "summary": row.get::<Option<String>, _>("summary"),
                "category": row.get::<Option<String>, _>("category"),
                "tags": row.get::<Option<String>, _>("tags"),
                "confidence": row.get::<Option<String>, _>("confidence"),
                "status": row.get::<String, _>("status"),
            })
        }));
    }

    if resource_type.is_none() || resource_type == Some("mcp_server") {
        let rows = sqlx::query(
            "SELECT id, name, description, summary, category, tags, confidence, status FROM mcp_servers ORDER BY updated_at DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        resources.extend(rows.into_iter().map(|row| {
            json!({
                "resource_type": "mcp_server",
                "id": row.get::<String, _>("id"),
                "name": row.get::<String, _>("name"),
                "description": row.get::<Option<String>, _>("description"),
                "summary": row.get::<Option<String>, _>("summary"),
                "category": row.get::<Option<String>, _>("category"),
                "tags": row.get::<Option<String>, _>("tags"),
                "confidence": row.get::<Option<String>, _>("confidence"),
                "status": row.get::<Option<String>, _>("status"),
            })
        }));
    }

    if resource_type.is_none() || resource_type == Some("agent") {
        let rows = sqlx::query(
            r#"
            SELECT id, name, agent_key, type, status, confidence, detection_source,
                   is_user_confirmed, is_ignored, last_detected_at,
                   launch_count, last_launched_at
            FROM agents
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        resources.extend(rows.into_iter().map(|row| {
            json!({
                "resource_type": "agent",
                "id": row.get::<String, _>("id"),
                "name": row.get::<String, _>("name"),
                "agent_key": row.get::<Option<String>, _>("agent_key"),
                "type": row.get::<Option<String>, _>("type"),
                "status": row.get::<Option<String>, _>("status"),
                "confidence": row.get::<Option<String>, _>("confidence"),
                "detection_source": row.get::<Option<String>, _>("detection_source"),
                "is_user_confirmed": sqlite_bool(row.get::<Option<i64>, _>("is_user_confirmed")),
                "is_ignored": sqlite_bool(row.get::<Option<i64>, _>("is_ignored")),
                "last_detected_at": row.get::<Option<String>, _>("last_detected_at"),
                "launch_count": row.get::<i64, _>("launch_count"),
                "last_launched_at": row.get::<Option<String>, _>("last_launched_at"),
            })
        }));
    }

    Ok(json!({ "resources": resources }))
}

async fn get_context(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
) -> Result<Value, String> {
    match resource_type {
        "skill" => {
            let row = sqlx::query(
                "SELECT id, name, description, summary, category, tags, confidence, path, entry_file, evidence_files FROM skills WHERE id = ?"
            )
            .bind(resource_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
            let path = row.get::<String, _>("path");
            let entry_file = row.get::<Option<String>, _>("entry_file");
            let safe_excerpt = safe_skill_content_excerpt(&path, entry_file.as_deref());
            let context_evidence = safe_excerpt
                .as_ref()
                .map(|excerpt| json!(excerpt.evidence_files))
                .map(|value| value.to_string());
            let evidence_files = row
                .get::<Option<String>, _>("evidence_files")
                .or(context_evidence);

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
                    "path": path,
                    "entry_file": entry_file,
                    "safe_content_excerpt": safe_excerpt.as_ref().map(|excerpt| excerpt.content.clone()),
                    "excerpt_evidence_files": safe_excerpt.as_ref().map(|excerpt| excerpt.evidence_files.clone())
                },
                "evidence_files": evidence_files
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
        "agent" => {
            let row = sqlx::query(
                r#"
                SELECT id, name, agent_key, type, status, app_path, cli_path,
                       config_path, log_path, bundle_id, confidence, detection_source,
                       evidence_json, is_user_confirmed, is_ignored, last_detected_at,
                       launch_count, last_launched_at, launch_command
                FROM agents
                WHERE id = ?
                "#,
            )
            .bind(resource_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

            let agent_type = row.get::<Option<String>, _>("type");
            let app_path = row.get::<Option<String>, _>("app_path");
            let launch_command = row.get::<Option<String>, _>("launch_command");
            let launchable = is_agent_launchable(
                agent_type.as_deref(),
                app_path.as_deref(),
                launch_command.as_deref(),
            );
            let agent_key = row.get::<Option<String>, _>("agent_key");

            Ok(json!({
                "resource_type": "agent",
                "id": row.get::<String, _>("id"),
                "name": row.get::<String, _>("name"),
                "agent_key": agent_key,
                "type": agent_type,
                "status": row.get::<Option<String>, _>("status"),
                "confidence": row.get::<Option<String>, _>("confidence"),
                "safe_context": {
                    "app_path": app_path,
                    "cli_path": row.get::<Option<String>, _>("cli_path"),
                    "config_path": row.get::<Option<String>, _>("config_path"),
                    "log_path": row.get::<Option<String>, _>("log_path"),
                    "bundle_id": row.get::<Option<String>, _>("bundle_id"),
                    "detection_source": row.get::<Option<String>, _>("detection_source"),
                    "is_user_confirmed": sqlite_bool(row.get::<Option<i64>, _>("is_user_confirmed")),
                    "is_ignored": sqlite_bool(row.get::<Option<i64>, _>("is_ignored")),
                    "last_detected_at": row.get::<Option<String>, _>("last_detected_at"),
                    "launch_count": row.get::<i64, _>("launch_count"),
                    "last_launched_at": row.get::<Option<String>, _>("last_launched_at"),
                    "launchable": launchable,
                    "launch_unavailable_reason": launch_unavailable_reason(
                        agent_type.as_deref(),
                        app_path.as_deref(),
                        launch_command.as_deref()
                    ),
                    "log_adapter_supported": agent_key
                        .as_deref()
                        .is_some_and(|key| LOG_ADAPTER_SUPPORTED_AGENT_KEYS.contains(&key)),
                    "evidence_signals": evidence_signals(row.get::<Option<String>, _>("evidence_json"))
                }
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
    let changes: Value = serde_json::from_str(proposed_changes)
        .map_err(|e| format!("proposed_changes must be JSON: {}", e))?;
    validate_resource_type(resource_type)?;
    validate_proposal_type(resource_type, proposal_type)?;
    trust_policy::ensure_json_object(&changes)?;
    if !trust_policy::resource_exists(pool, resource_type, resource_id).await? {
        return Err("Resource not found".to_string());
    }

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

    let proposal = trust_policy::run_trust_policy_for_proposal(pool, &id).await?;

    Ok(json!({
        "id": proposal.id,
        "resource_type": proposal.resource_type,
        "resource_id": proposal.resource_id,
        "proposal_type": proposal.proposal_type,
        "status": proposal.status,
        "risk_level": proposal.risk_level,
        "risk_reasons": proposal.risk_reasons,
        "auto_applied": proposal.auto_applied,
        "created_by": proposal.created_by,
        "created_at": proposal.created_at,
        "applied_at": proposal.applied_at
    }))
}

fn usage() -> String {
    "Usage: harness_cli list [skill|mcp_server|agent] | context <skill|mcp_server|agent> <id> | propose <type> <id> <proposal_type> '<json>' | rollback <proposal_id> | reject <proposal_id>".to_string()
}

fn validate_resource_type(resource_type: &str) -> Result<(), String> {
    if matches!(
        resource_type,
        "skill" | "mcp_server" | "agent" | "memory_source" | "knowledge_base" | "project"
    ) {
        Ok(())
    } else {
        Err("Unsupported resource type".to_string())
    }
}

fn validate_proposal_type(resource_type: &str, proposal_type: &str) -> Result<(), String> {
    if resource_type == "agent" && !AGENT_PROPOSAL_TYPES.contains(&proposal_type) {
        return Err(format!("Unsupported agent proposal type: {proposal_type}"));
    }
    Ok(())
}

fn sqlite_bool(value: Option<i64>) -> bool {
    value.unwrap_or(0) != 0
}

fn evidence_signals(evidence_json: Option<String>) -> Vec<String> {
    let Some(raw) = evidence_json else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return Vec::new();
    };
    value
        .get("signals")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .take(5)
        .map(str::to_string)
        .collect()
}

fn is_agent_launchable(
    agent_type: Option<&str>,
    app_path: Option<&str>,
    launch_command: Option<&str>,
) -> bool {
    if matches!(
        agent_type,
        Some("CLI") | Some("IDE Plugin") | Some("ConfigOnly") | Some("Plugin")
    ) {
        return false;
    }
    app_path.is_some_and(|path| path.ends_with(".app"))
        || safe_open_app_command(launch_command).is_some()
}

fn launch_unavailable_reason(
    agent_type: Option<&str>,
    app_path: Option<&str>,
    launch_command: Option<&str>,
) -> Option<String> {
    if is_agent_launchable(agent_type, app_path, launch_command) {
        return None;
    }
    match agent_type {
        Some("CLI") => Some("CLI Agent 第一阶段不直接启动，请配置安全启动方式。".to_string()),
        Some("IDE Plugin") | Some("Plugin") => {
            Some("IDE Plugin 第一阶段不由 Harness 直接启动。".to_string())
        }
        Some("ConfigOnly") => Some("ConfigOnly Agent 没有可安全启动的 App。".to_string()),
        _ => Some("缺少可安全启动的 macOS App 路径。".to_string()),
    }
}

fn safe_open_app_command(command: Option<&str>) -> Option<String> {
    let command = command?.trim();
    let app_name = command.strip_prefix("open -a ")?.trim();
    if app_name.is_empty() || app_name.contains([';', '&', '|', '`', '$', '>', '<']) {
        return None;
    }
    Some(app_name.trim_matches('"').to_string())
}

struct SafeContentExcerpt {
    content: String,
    evidence_files: Vec<String>,
}

fn safe_skill_content_excerpt(path: &str, entry_file: Option<&str>) -> Option<SafeContentExcerpt> {
    let skill_path = Path::new(path);
    let skill_dir = if skill_path.is_dir() {
        skill_path.to_path_buf()
    } else {
        skill_path.parent()?.to_path_buf()
    };

    let mut candidates = Vec::new();
    if let Some(entry_file) = entry_file.filter(|file| SAFE_CONTEXT_FILES.contains(file)) {
        candidates.push(skill_dir.join(entry_file));
    }
    candidates.extend(SAFE_CONTEXT_FILES.iter().map(|file| skill_dir.join(file)));

    for candidate in candidates {
        if !is_safe_excerpt_file(&skill_dir, &candidate) {
            continue;
        }

        if let Ok(content) = std::fs::read_to_string(&candidate) {
            let excerpt = content
                .chars()
                .take(SAFE_CONTEXT_MAX_CHARS)
                .collect::<String>();
            let file_name = candidate.file_name()?.to_string_lossy().to_string();
            return Some(SafeContentExcerpt {
                content: excerpt,
                evidence_files: vec![file_name],
            });
        }
    }

    None
}

fn is_safe_excerpt_file(skill_dir: &Path, candidate: &PathBuf) -> bool {
    if candidate.parent() != Some(skill_dir) {
        return false;
    }

    candidate
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| SAFE_CONTEXT_FILES.contains(&name))
}
