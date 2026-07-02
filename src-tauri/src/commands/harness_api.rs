use crate::models::intelligence::{
    HarnessResourceContext, HarnessResourceSummary, IntelligenceProposal,
};
use crate::trust_policy;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use tauri::{command, State};
use uuid::Uuid;

#[command]
pub async fn list_harness_resources(
    resource_type: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<HarnessResourceSummary>, String> {
    let ctx = crate::ai::safe_tools::ToolContext { pool: &*pool };
    let types_to_query = match resource_type.as_deref() {
        Some(t) => vec![t.to_string()],
        None => vec!["skill".to_string(), "mcp_server".to_string()],
    };

    let mut result = Vec::new();
    for t in types_to_query {
        let args = json!({
            "resource_type": t,
            "limit": 50
        });
        let output = crate::ai::safe_tools::call_tool("list_resources", args, &ctx).await?;
        let resources = output
            .data
            .get("resources")
            .and_then(|r| r.as_array())
            .ok_or_else(|| "Invalid output from list_resources tool".to_string())?;
        for r in resources {
            let summary: HarnessResourceSummary = serde_json::from_value(r.clone())
                .map_err(|e| format!("Failed to parse HarnessResourceSummary: {}", e))?;
            result.push(summary);
        }
    }
    Ok(result)
}

#[command]
pub async fn get_harness_resource_context(
    resource_type: String,
    resource_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<HarnessResourceContext, String> {
    let ctx = crate::ai::safe_tools::ToolContext { pool: &*pool };
    let args = json!({
        "resource_type": resource_type,
        "resource_id": resource_id
    });
    let output = crate::ai::safe_tools::call_tool("get_resource_context", args, &ctx).await?;
    let context: HarnessResourceContext = serde_json::from_value(output.data)
        .map_err(|e| format!("Failed to parse HarnessResourceContext: {}", e))?;
    Ok(context)
}

#[command]
pub async fn create_intelligence_proposal(
    resource_type: String,
    resource_id: String,
    proposal_type: String,
    proposed_changes: String,
    evidence_files: Option<String>,
    confidence: Option<String>,
    created_by: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<IntelligenceProposal, String> {
    if !matches!(
        resource_type.as_str(),
        "skill" | "mcp_server" | "agent" | "memory_source" | "knowledge_base" | "project"
    ) {
        return Err("Unsupported resource type".to_string());
    }

    let changes: Value = serde_json::from_str(&proposed_changes)
        .map_err(|e| format!("Invalid proposed_changes JSON: {}", e))?;
    trust_policy::ensure_json_object(&changes)?;

    if !trust_policy::resource_exists(&pool, &resource_type, &resource_id).await? {
        return Err("Resource not found".to_string());
    }

    let proposal = IntelligenceProposal {
        id: Uuid::new_v4().to_string(),
        resource_type,
        resource_id,
        proposal_type,
        proposed_changes,
        evidence_files,
        confidence,
        status: Some("pending".to_string()),
        created_by,
        created_at: Utc::now().to_rfc3339(),
        applied_at: None,
        risk_level: None,
        risk_reasons: None,
        auto_applied: Some(0),
        trust_policy_version: None,
        resource_name: None,
        acknowledged_at: None,
        acknowledged_by: None,
        linked_from: None,
    };

    sqlx::query(
        r#"
        INSERT INTO intelligence_proposals
          (id, resource_type, resource_id, proposal_type, proposed_changes, evidence_files,
           confidence, status, created_by, created_at, applied_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&proposal.id)
    .bind(&proposal.resource_type)
    .bind(&proposal.resource_id)
    .bind(&proposal.proposal_type)
    .bind(&proposal.proposed_changes)
    .bind(&proposal.evidence_files)
    .bind(&proposal.confidence)
    .bind(&proposal.status)
    .bind(&proposal.created_by)
    .bind(&proposal.created_at)
    .bind(&proposal.applied_at)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    trust_policy::run_trust_policy_for_proposal(&pool, &proposal.id).await
}

#[command]
pub async fn list_intelligence_proposals(
    status: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<IntelligenceProposal>, String> {
    let proposals = if let Some(status) = status {
        sqlx::query_as::<_, IntelligenceProposal>(
            "SELECT * FROM intelligence_proposals WHERE status = ? ORDER BY created_at DESC",
        )
        .bind(status)
        .fetch_all(&*pool)
        .await
    } else {
        sqlx::query_as::<_, IntelligenceProposal>(
            "SELECT * FROM intelligence_proposals ORDER BY created_at DESC",
        )
        .fetch_all(&*pool)
        .await
    }
    .map_err(|e| e.to_string())?;

    enrich_proposals_with_resource_names(&pool, proposals).await
}

async fn enrich_proposals_with_resource_names(
    pool: &SqlitePool,
    mut proposals: Vec<IntelligenceProposal>,
) -> Result<Vec<IntelligenceProposal>, String> {
    let skill_ids = collect_ids(&proposals, "skill");
    let mcp_ids = collect_ids(&proposals, "mcp_server");
    let mem_ids = collect_ids(&proposals, "memory_source");
    let kb_ids = collect_ids(&proposals, "knowledge_base");
    let proj_ids = collect_ids(&proposals, "project");

    let skill_names = fetch_names(pool, "skills", &skill_ids).await?;
    let mcp_names = fetch_names(pool, "mcp_servers", &mcp_ids).await?;
    let mem_names = fetch_names(pool, "memory_sources", &mem_ids).await?;
    let kb_names = fetch_names(pool, "knowledge_bases", &kb_ids).await?;
    let proj_names = fetch_names(pool, "projects", &proj_ids).await?;

    for proposal in &mut proposals {
        let names = match proposal.resource_type.as_str() {
            "skill" => &skill_names,
            "mcp_server" => &mcp_names,
            "memory_source" => &mem_names,
            "knowledge_base" => &kb_names,
            "project" => &proj_names,
            _ => continue,
        };
        proposal.resource_name = names.get(&proposal.resource_id).cloned();
    }

    Ok(proposals)
}

fn collect_ids(proposals: &[IntelligenceProposal], resource_type: &str) -> Vec<String> {
    proposals
        .iter()
        .filter(|p| p.resource_type == resource_type)
        .map(|p| p.resource_id.clone())
        .collect()
}

async fn fetch_names(
    pool: &SqlitePool,
    table: &str,
    ids: &[String],
) -> Result<std::collections::HashMap<String, String>, String> {
    if ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let validated_table = match table {
        "skills" | "mcp_servers" | "memory_sources" | "knowledge_bases" | "projects" => table,
        _ => return Err(format!("Unknown resource table: {table}")),
    };

    let mut builder = sqlx::QueryBuilder::<sqlx::Sqlite>::new("SELECT id, name FROM ");
    builder.push(validated_table);
    builder.push(" WHERE id IN (");
    let mut separated = builder.separated(", ");
    for id in ids {
        separated.push_bind(id.clone());
    }
    builder.push(")");

    let rows = builder
        .build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    let mut map = std::collections::HashMap::new();
    for row in rows {
        map.insert(row.get("id"), row.get("name"));
    }
    Ok(map)
}

#[command]
pub async fn apply_intelligence_proposal(
    proposal_id: String,
    actor: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let actor = actor.unwrap_or_else(|| "user".to_string());
    trust_policy::apply_proposal(&pool, &proposal_id, &actor, false).await
}

#[command]
pub async fn reject_intelligence_proposal(
    proposal_id: String,
    actor: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let actor = actor.unwrap_or_else(|| "user".to_string());
    trust_policy::reject_proposal(&pool, &proposal_id, &actor).await
}

fn sanitize_proposal_changes(value: &Value) -> Value {
    let forbidden_keys = [
        "path",
        "source_path",
        "app_path",
        "cli_path",
        "config_path",
        "log_path",
        "command",
        "args",
        "env",
        "launch_command",
        "enabled",
        "status",
        "delete",
        "execute",
        "shell",
        "token",
        "api_key",
        "secret",
        "password",
        "authorization",
        "bearer",
        "access_token",
        "refresh_token",
        "cookie",
    ];

    match value {
        Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (key, val) in map {
                if forbidden_keys.contains(&key.as_str()) {
                    continue;
                }
                let sanitized_val = sanitize_proposal_changes(val);
                let is_val_empty = match &sanitized_val {
                    Value::Object(m) => m.is_empty(),
                    Value::Null => true,
                    _ => false,
                };
                if !is_val_empty {
                    new_map.insert(key.clone(), sanitized_val);
                }
            }
            Value::Object(new_map)
        }
        Value::Array(arr) => {
            let mut new_arr = Vec::new();
            for val in arr {
                let sanitized_val = sanitize_proposal_changes(val);
                let is_val_empty = match &sanitized_val {
                    Value::Object(m) => m.is_empty(),
                    Value::Null => true,
                    _ => false,
                };
                if !is_val_empty {
                    new_arr.push(sanitized_val);
                }
            }
            Value::Array(new_arr)
        }
        other => other.clone(),
    }
}

#[command]
pub async fn acknowledge_intelligence_proposal(
    proposal_id: String,
    actor: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let actor = actor.unwrap_or_else(|| "user".to_string());
    let now = Utc::now().to_rfc3339();

    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM intelligence_proposals WHERE id = ?")
            .bind(&proposal_id)
            .fetch_optional(&*pool)
            .await
            .map_err(|e| e.to_string())?
            .flatten();

    if status.as_deref() != Some("blocked") {
        return Err("Only blocked proposals can be acknowledged".to_string());
    }

    sqlx::query(
        "UPDATE intelligence_proposals SET acknowledged_at = ?, acknowledged_by = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(&actor)
    .bind(&proposal_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO audit_logs
          (id, actor, action, resource_type, resource_id, proposal_id, before_state, after_state, created_at)
        VALUES (?, ?, 'acknowledge_intelligence_proposal', '', '', ?, NULL, NULL, ?)
        "#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&actor)
    .bind(&proposal_id)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn create_safe_rewrite_proposal(
    blocked_proposal_id: String,
    actor: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<IntelligenceProposal, String> {
    let actor = actor.unwrap_or_else(|| "user".to_string());
    let now = Utc::now().to_rfc3339();

    let proposal: IntelligenceProposal = sqlx::query_as::<_, IntelligenceProposal>(
        "SELECT * FROM intelligence_proposals WHERE id = ?",
    )
    .bind(&blocked_proposal_id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Proposal not found".to_string())?;

    if proposal.status.as_deref() != Some("blocked") {
        return Err("Only blocked proposals can be safely rewritten".to_string());
    }

    let changes_val: Value = serde_json::from_str(&proposal.proposed_changes)
        .map_err(|e| format!("Invalid JSON in proposed_changes: {}", e))?;

    let sanitized_val = sanitize_proposal_changes(&changes_val);

    let is_empty = match &sanitized_val {
        Value::Object(map) => map.is_empty(),
        Value::Null => true,
        _ => false,
    };
    if is_empty {
        return Err(
            "The proposal contains only high-risk changes and cannot generate a safe version."
                .to_string(),
        );
    }

    let sanitized_str = serde_json::to_string(&sanitized_val).unwrap_or_default();

    let new_id = uuid::Uuid::new_v4().to_string();
    let created_by = format!("{}_rewrite", actor);

    sqlx::query(
        r#"
        INSERT INTO intelligence_proposals
          (id, resource_type, resource_id, proposal_type, proposed_changes, status, created_by, created_at, linked_from)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        "#,
    )
    .bind(&new_id)
    .bind(&proposal.resource_type)
    .bind(&proposal.resource_id)
    .bind(&proposal.proposal_type)
    .bind(&sanitized_str)
    .bind(&created_by)
    .bind(&now)
    .bind(&blocked_proposal_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let evaluated_proposal = trust_policy::run_trust_policy_for_proposal(&pool, &new_id).await?;

    sqlx::query(
        r#"
        INSERT INTO audit_logs
          (id, actor, action, resource_type, resource_id, proposal_id, before_state, after_state, created_at)
        VALUES (?, ?, 'create_safe_rewrite_proposal', ?, ?, ?, NULL, NULL, ?)
        "#,
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&actor)
    .bind(&proposal.resource_type)
    .bind(&proposal.resource_id)
    .bind(&new_id)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut vec_prop = vec![evaluated_proposal];
    vec_prop = enrich_proposals_with_resource_names(&pool, vec_prop).await?;
    Ok(vec_prop.remove(0))
}

#[command]
pub async fn rollback_intelligence_proposal(
    proposal_id: String,
    actor: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let actor = actor.unwrap_or_else(|| "user".to_string());
    trust_policy::rollback_proposal(&pool, &proposal_id, &actor).await
}

#[cfg(test)]
mod tests {
    use crate::trust_policy::{assess_proposal_risk, RiskLevel, TrustPolicySettings};
    use serde_json::json;

    #[test]
    fn trust_policy_rejects_forbidden_proposal_fields() {
        let changes = json!({
            "description": "Useful description",
            "launch_command": "rm -rf ~"
        });
        let settings = TrustPolicySettings::default();

        let decision =
            assess_proposal_risk("skill", "description_update", &changes, true, &settings);

        assert_eq!(decision.risk_level, RiskLevel::High);
        assert!(!decision.can_auto_apply);
    }

    #[test]
    fn trust_policy_accepts_ai_metadata_fields() {
        let changes = json!({
            "description": "Useful description",
            "summary": "Short summary",
            "category": "编程开发",
            "tags": ["rust", "tauri"],
            "confidence": "medium",
            "evidence_files": ["SKILL.md"]
        });
        let settings = TrustPolicySettings::default();

        let decision =
            assess_proposal_risk("skill", "description_update", &changes, true, &settings);

        assert_eq!(decision.risk_level, RiskLevel::Low);
        assert!(decision.can_auto_apply);
    }

    #[test]
    fn trust_policy_marks_low_risk_metadata_update_auto_applyable() {
        let changes = json!({
            "description": "中文简介",
            "summary": "摘要",
            "category": "开发测试",
            "tags": ["mcp", "codex"],
            "confidence": "medium",
            "evidence_files": ["SKILL.md"]
        });

        let decision = assess_proposal_risk(
            "skill",
            "ai_metadata_update",
            &changes,
            true,
            &TrustPolicySettings::default(),
        );

        assert_eq!(decision.risk_level, RiskLevel::Low);
        assert!(decision.can_auto_apply);
    }

    #[test]
    fn trust_policy_marks_missing_evidence_as_medium_risk() {
        let changes = json!({
            "description": "中文简介",
            "confidence": "high"
        });

        let decision = assess_proposal_risk(
            "skill",
            "description_update",
            &changes,
            true,
            &TrustPolicySettings::default(),
        );

        assert_eq!(decision.risk_level, RiskLevel::Medium);
        assert!(!decision.can_auto_apply);
    }

    #[test]
    fn trust_policy_blocks_forbidden_launch_fields() {
        let changes = json!({
            "description": "中文简介",
            "launch_command": "open -a Terminal",
            "confidence": "high",
            "evidence_files": ["SKILL.md"]
        });

        let decision = assess_proposal_risk(
            "skill",
            "description_update",
            &changes,
            true,
            &TrustPolicySettings::default(),
        );

        assert_eq!(decision.risk_level, RiskLevel::High);
        assert!(!decision.can_auto_apply);
    }
}
