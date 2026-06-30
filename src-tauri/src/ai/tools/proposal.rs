use crate::ai::safe_tools::{sanitize_output, ToolContext, ToolOutput};
use crate::trust_policy;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

pub async fn list_pending_proposals(ctx: &ToolContext<'_>) -> Result<ToolOutput, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, resource_type, resource_id, proposal_type, proposed_changes, status, created_by, created_at 
        FROM intelligence_proposals 
        WHERE status = 'pending' OR status LIKE 'pending%' 
        ORDER BY created_at DESC 
        LIMIT 20
        "#
    )
    .fetch_all(ctx.pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut proposals = Vec::new();
    for r in rows {
        let changes_str = r.get::<String, _>("proposed_changes");
        let changes: Value = serde_json::from_str(&changes_str).unwrap_or(Value::Null);
        proposals.push(json!({
            "id": r.get::<String, _>("id"),
            "resource_type": r.get::<String, _>("resource_type"),
            "resource_id": r.get::<String, _>("resource_id"),
            "proposal_type": r.get::<String, _>("proposal_type"),
            "proposed_changes": changes,
            "status": r.get::<Option<String>, _>("status"),
            "created_by": r.get::<Option<String>, _>("created_by"),
            "created_at": r.get::<String, _>("created_at")
        }));
    }

    Ok(sanitize_output(json!({ "proposals": proposals })))
}

fn is_proposal_type_allowed(resource_type: &str, proposal_type: &str) -> bool {
    match resource_type {
        "skill" => matches!(
            proposal_type,
            "update_metadata" | "improve_description" | "suggest_archive" | "suggest_merge" | "improve_ai_readiness"
        ),
        "agent" => matches!(
            proposal_type,
            "update_agent_metadata" | "suggest_agent_confirmation" | "suggest_agent_ignore" | "fix_agent_paths" | "explain_agent_launch_strategy" | "improve_agent_detection_rule"
        ),
        "mcp_server" => matches!(
            proposal_type,
            "update_mcp_metadata" | "suggest_mcp_health_fix" | "improve_mcp_description" | "improve_tool_schema"
        ),
        _ => false,
    }
}

fn has_forbidden_keys(value: &Value) -> bool {
    let forbidden_keys = [
        "path", "source_path", "app_path", "cli_path", "config_path", "log_path",
        "command", "args", "env", "launch_command", "enabled", "status", "delete",
        "execute", "shell", "token", "api_key", "secret", "password"
    ];

    match value {
        Value::Object(map) => {
            for (key, val) in map {
                if forbidden_keys.contains(&key.as_str()) {
                    return true;
                }
                if has_forbidden_keys(val) {
                    return true;
                }
            }
        }
        Value::Array(arr) => {
            for val in arr {
                if has_forbidden_keys(val) {
                    return true;
                }
            }
        }
        _ => {}
    }
    false
}

pub async fn create_governance_proposal(
    resource_type: String,
    resource_id: String,
    proposal_type: String,
    proposed_changes: Value,
    ctx: &ToolContext<'_>,
) -> Result<ToolOutput, String> {
    let proposed_changes_val = match proposed_changes {
        Value::String(s) => {
            serde_json::from_str::<Value>(&s)
                .map_err(|e| format!("Invalid proposed_changes JSON string: {}", e))?
        }
        other => other,
    };

    if !is_proposal_type_allowed(&resource_type, &proposal_type) {
        return Err(format!(
            "Proposal type '{}' is not allowed for resource type '{}'.",
            proposal_type, resource_type
        ));
    }

    if has_forbidden_keys(&proposed_changes_val) {
        return Err("proposed_changes contains forbidden keys".to_string());
    }

    if !trust_policy::resource_exists(ctx.pool, &resource_type, &resource_id).await? {
        return Err("Resource not found".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let proposed_changes_str = serde_json::to_string(&proposed_changes_val).unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO intelligence_proposals
          (id, resource_type, resource_id, proposal_type, proposed_changes, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', 'ai_governance_agent', ?)
        "#,
    )
    .bind(&id)
    .bind(&resource_type)
    .bind(&resource_id)
    .bind(&proposal_type)
    .bind(&proposed_changes_str)
    .bind(&now)
    .execute(ctx.pool)
    .await
    .map_err(|e| e.to_string())?;

    let proposal = trust_policy::run_trust_policy_for_proposal(ctx.pool, &id).await?;

    let output = json!({
        "id": proposal.id,
        "resource_type": proposal.resource_type,
        "resource_id": proposal.resource_id,
        "proposal_type": proposal.proposal_type,
        "status": proposal.status,
        "risk_level": proposal.risk_level,
        "risk_reasons": proposal.risk_reasons,
        "auto_applied": proposal.auto_applied,
        "created_by": proposal.created_by,
        "created_at": proposal.created_at
    });

    Ok(sanitize_output(output))
}
