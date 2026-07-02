use crate::ai::safe_tools::{sanitize_output, ToolContext, ToolOutput};
use crate::ai::tools::mcp::sanitize_env_value;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::path::{Path, PathBuf};

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

pub async fn list_resources(
    resource_type: String,
    limit: i64,
    ctx: &ToolContext<'_>,
) -> Result<ToolOutput, String> {
    let raw = list_resources_raw(resource_type, limit, ctx.pool).await?;
    Ok(sanitize_output(raw))
}

pub async fn list_resources_raw(
    resource_type: String,
    limit: i64,
    pool: &SqlitePool,
) -> Result<Value, String> {
    let limit = limit.min(50).max(1);
    let mut resources = Vec::new();

    match resource_type.as_str() {
        "skill" => {
            let rows = sqlx::query(
                r#"
                SELECT id, name, description, summary, category, tags, confidence, status
                FROM skills
                ORDER BY updated_at DESC
                LIMIT ?
                "#,
            )
            .bind(limit)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

            for row in rows {
                resources.push(json!({
                    "resource_type": "skill",
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "description": row.get::<Option<String>, _>("description"),
                    "summary": row.get::<Option<String>, _>("summary"),
                    "category": row.get::<Option<String>, _>("category"),
                    "tags": row.get::<Option<String>, _>("tags"),
                    "confidence": row.get::<Option<String>, _>("confidence"),
                    "status": row.get::<String, _>("status"),
                }));
            }
        }
        "mcp_server" => {
            let rows = sqlx::query(
                r#"
                SELECT id, name, description, summary, category, tags, confidence, status
                FROM mcp_servers
                ORDER BY updated_at DESC
                LIMIT ?
                "#,
            )
            .bind(limit)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

            for row in rows {
                resources.push(json!({
                    "resource_type": "mcp_server",
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "description": row.get::<Option<String>, _>("description"),
                    "summary": row.get::<Option<String>, _>("summary"),
                    "category": row.get::<Option<String>, _>("category"),
                    "tags": row.get::<Option<String>, _>("tags"),
                    "confidence": row.get::<Option<String>, _>("confidence"),
                    "status": row.get::<Option<String>, _>("status"),
                }));
            }
        }
        "agent" => {
            let rows = sqlx::query(
                r#"
                SELECT id, name, agent_key, type, status, confidence, detection_source,
                       is_user_confirmed, is_ignored, last_detected_at, launch_count, last_launched_at
                FROM agents
                ORDER BY updated_at DESC
                LIMIT ?
                "#
            )
            .bind(limit)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

            for row in rows {
                resources.push(json!({
                    "resource_type": "agent",
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "agent_key": row.get::<Option<String>, _>("agent_key"),
                    "type": row.get::<Option<String>, _>("type"),
                    "status": row.get::<Option<String>, _>("status"),
                    "confidence": row.get::<Option<String>, _>("confidence"),
                    "detection_source": row.get::<Option<String>, _>("detection_source"),
                    "is_user_confirmed": row.get::<Option<i64>, _>("is_user_confirmed").unwrap_or(0) != 0,
                    "is_ignored": row.get::<Option<i64>, _>("is_ignored").unwrap_or(0) != 0,
                    "last_detected_at": row.get::<Option<String>, _>("last_detected_at"),
                    "launch_count": row.get::<i64, _>("launch_count"),
                    "last_launched_at": row.get::<Option<String>, _>("last_launched_at"),
                }));
            }
        }
        _ => return Err(format!("Unsupported resource type: {}", resource_type)),
    }

    Ok(json!({ "resources": resources }))
}

pub async fn get_resource_context(
    resource_type: String,
    resource_id: String,
    ctx: &ToolContext<'_>,
) -> Result<ToolOutput, String> {
    let raw = get_resource_context_raw(resource_type, resource_id, ctx.pool).await?;
    Ok(sanitize_output(raw))
}

pub async fn get_resource_context_raw(
    resource_type: String,
    resource_id: String,
    pool: &SqlitePool,
) -> Result<Value, String> {
    match resource_type.as_str() {
        "skill" => {
            let row = sqlx::query(
                r#"
                SELECT id, name, description, summary, category, tags, confidence,
                       manual_override, last_analyzed_at, status, path, entry_file, evidence_files
                FROM skills WHERE id = ?
                "#,
            )
            .bind(&resource_id)
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
                "resource": {
                    "resource_type": "skill",
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "description": row.get::<Option<String>, _>("description"),
                    "summary": row.get::<Option<String>, _>("summary"),
                    "category": row.get::<Option<String>, _>("category"),
                    "tags": row.get::<Option<String>, _>("tags"),
                    "confidence": row.get::<Option<String>, _>("confidence"),
                    "manual_override": row.get::<Option<i64>, _>("manual_override"),
                    "last_analyzed_at": row.get::<Option<String>, _>("last_analyzed_at"),
                    "status": row.get::<String, _>("status")
                },
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
                r#"
                SELECT id, name, description, summary, category, tags, confidence,
                       manual_override, last_analyzed_at, status, source_path, command, args, env, evidence_files
                FROM mcp_servers WHERE id = ?
                "#,
            )
            .bind(&resource_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

            let env_raw = row.get::<Option<String>, _>("env");
            let env_sanitized = sanitize_env_value(env_raw.as_deref());

            Ok(json!({
                "resource": {
                    "resource_type": "mcp_server",
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "description": row.get::<Option<String>, _>("description"),
                    "summary": row.get::<Option<String>, _>("summary"),
                    "category": row.get::<Option<String>, _>("category"),
                    "tags": row.get::<Option<String>, _>("tags"),
                    "confidence": row.get::<Option<String>, _>("confidence"),
                    "manual_override": row.get::<Option<i64>, _>("manual_override"),
                    "last_analyzed_at": row.get::<Option<String>, _>("last_analyzed_at"),
                    "status": row.get::<Option<String>, _>("status")
                },
                "safe_context": {
                    "source_path": row.get::<Option<String>, _>("source_path"),
                    "command": row.get::<String, _>("command"),
                    "args": row.get::<Option<String>, _>("args"),
                    "env": env_sanitized
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
            .bind(&resource_id)
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
                "resource": {
                    "resource_type": "agent",
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "description": agent_type.clone(),
                    "summary": None::<String>,
                    "category": None::<String>,
                    "tags": agent_key.clone(),
                    "confidence": row.get::<Option<String>, _>("confidence"),
                    "manual_override": Some(row.get::<Option<i64>, _>("is_user_confirmed").unwrap_or(0)),
                    "last_analyzed_at": row.get::<Option<String>, _>("last_detected_at"),
                    "status": row.get::<Option<String>, _>("status")
                },
                "safe_context": {
                    "app_path": app_path,
                    "cli_path": row.get::<Option<String>, _>("cli_path"),
                    "config_path": row.get::<Option<String>, _>("config_path"),
                    "log_path": row.get::<Option<String>, _>("log_path"),
                    "bundle_id": row.get::<Option<String>, _>("bundle_id"),
                    "detection_source": row.get::<Option<String>, _>("detection_source"),
                    "is_user_confirmed": row.get::<Option<i64>, _>("is_user_confirmed").unwrap_or(0) != 0,
                    "is_ignored": row.get::<Option<i64>, _>("is_ignored").unwrap_or(0) != 0,
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
        _ => Err(format!("Unsupported resource type: {}", resource_type)),
    }
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
