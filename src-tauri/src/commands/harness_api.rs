use crate::models::intelligence::{HarnessResourceContext, HarnessResourceSummary, IntelligenceProposal};
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
    let mut resources = Vec::new();
    let filter = resource_type.as_deref();

    if filter.is_none() || filter == Some("skill") {
        let rows = sqlx::query(
            r#"
            SELECT id, name, description, summary, category, tags, confidence,
                   manual_override, last_analyzed_at, status
            FROM skills
            ORDER BY updated_at DESC
            "#
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

        resources.extend(rows.into_iter().map(|row| HarnessResourceSummary {
            resource_type: "skill".to_string(),
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            summary: row.get("summary"),
            category: row.get("category"),
            tags: row.get("tags"),
            confidence: row.get("confidence"),
            manual_override: row.get("manual_override"),
            last_analyzed_at: row.get("last_analyzed_at"),
            status: row.get("status"),
        }));
    }

    if filter.is_none() || filter == Some("mcp_server") {
        let rows = sqlx::query(
            r#"
            SELECT id, name, description, summary, category, tags, confidence,
                   manual_override, last_analyzed_at, status
            FROM mcp_servers
            ORDER BY updated_at DESC
            "#
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

        resources.extend(rows.into_iter().map(|row| HarnessResourceSummary {
            resource_type: "mcp_server".to_string(),
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            summary: row.get("summary"),
            category: row.get("category"),
            tags: row.get("tags"),
            confidence: row.get("confidence"),
            manual_override: row.get("manual_override"),
            last_analyzed_at: row.get("last_analyzed_at"),
            status: row.get("status"),
        }));
    }

    Ok(resources)
}

#[command]
pub async fn get_harness_resource_context(
    resource_type: String,
    resource_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<HarnessResourceContext, String> {
    match resource_type.as_str() {
        "skill" => get_skill_context(&resource_id, &pool).await,
        "mcp_server" => get_mcp_context(&resource_id, &pool).await,
        _ => Err("Unsupported resource type".to_string()),
    }
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
    if !matches!(resource_type.as_str(), "skill" | "mcp_server" | "memory_source" | "knowledge_base" | "project") {
        return Err("Unsupported resource type".to_string());
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
    };

    sqlx::query(
        r#"
        INSERT INTO intelligence_proposals
          (id, resource_type, resource_id, proposal_type, proposed_changes, evidence_files,
           confidence, status, created_by, created_at, applied_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
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

    Ok(proposal)
}

#[command]
pub async fn list_intelligence_proposals(
    status: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<IntelligenceProposal>, String> {
    let proposals = if let Some(status) = status {
        sqlx::query_as::<_, IntelligenceProposal>(
            "SELECT * FROM intelligence_proposals WHERE status = ? ORDER BY created_at DESC"
        )
        .bind(status)
        .fetch_all(&*pool)
        .await
    } else {
        sqlx::query_as::<_, IntelligenceProposal>(
            "SELECT * FROM intelligence_proposals ORDER BY created_at DESC"
        )
        .fetch_all(&*pool)
        .await
    };

    proposals.map_err(|e| e.to_string())
}

#[command]
pub async fn apply_intelligence_proposal(
    proposal_id: String,
    actor: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let proposal = sqlx::query_as::<_, IntelligenceProposal>(
        "SELECT * FROM intelligence_proposals WHERE id = ?"
    )
    .bind(&proposal_id)
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    if proposal.status.as_deref() != Some("pending") {
        return Err("Only pending proposals can be applied".to_string());
    }

    let changes: Value = serde_json::from_str(&proposal.proposed_changes)
        .map_err(|e| format!("Invalid proposed_changes JSON: {}", e))?;
    let now = Utc::now().to_rfc3339();
    let actor = actor.unwrap_or_else(|| "user".to_string());

    match proposal.resource_type.as_str() {
        "skill" => apply_skill_changes(&proposal.resource_id, &changes, &now, &pool).await?,
        "mcp_server" => apply_mcp_changes(&proposal.resource_id, &changes, &now, &pool).await?,
        _ => return Err("Apply is only enabled for skill and mcp_server in this phase".to_string()),
    }

    sqlx::query("UPDATE intelligence_proposals SET status = 'applied', applied_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&proposal.id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO audit_logs
          (id, actor, action, resource_type, resource_id, proposal_id, before_state, after_state, created_at)
        VALUES (?, ?, 'apply_intelligence_proposal', ?, ?, ?, NULL, ?, ?)
        "#
    )
    .bind(Uuid::new_v4().to_string())
    .bind(actor)
    .bind(&proposal.resource_type)
    .bind(&proposal.resource_id)
    .bind(&proposal.id)
    .bind(&proposal.proposed_changes)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

async fn get_skill_context(resource_id: &str, pool: &SqlitePool) -> Result<HarnessResourceContext, String> {
    let row = sqlx::query(
        r#"
        SELECT id, name, description, summary, category, tags, confidence,
               manual_override, last_analyzed_at, status, path, entry_file, evidence_files
        FROM skills WHERE id = ?
        "#
    )
    .bind(resource_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(HarnessResourceContext {
        resource: HarnessResourceSummary {
            resource_type: "skill".to_string(),
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            summary: row.get("summary"),
            category: row.get("category"),
            tags: row.get("tags"),
            confidence: row.get("confidence"),
            manual_override: row.get("manual_override"),
            last_analyzed_at: row.get("last_analyzed_at"),
            status: row.get("status"),
        },
        safe_context: json!({
            "path": row.get::<String, _>("path"),
            "entry_file": row.get::<Option<String>, _>("entry_file")
        }),
        evidence_files: row.get("evidence_files"),
    })
}

async fn get_mcp_context(resource_id: &str, pool: &SqlitePool) -> Result<HarnessResourceContext, String> {
    let row = sqlx::query(
        r#"
        SELECT id, name, description, summary, category, tags, confidence,
               manual_override, last_analyzed_at, status, source_path, command, args, env, evidence_files
        FROM mcp_servers WHERE id = ?
        "#
    )
    .bind(resource_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(HarnessResourceContext {
        resource: HarnessResourceSummary {
            resource_type: "mcp_server".to_string(),
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            summary: row.get("summary"),
            category: row.get("category"),
            tags: row.get("tags"),
            confidence: row.get("confidence"),
            manual_override: row.get("manual_override"),
            last_analyzed_at: row.get("last_analyzed_at"),
            status: row.get("status"),
        },
        safe_context: json!({
            "source_path": row.get::<Option<String>, _>("source_path"),
            "command": row.get::<String, _>("command"),
            "args": row.get::<Option<String>, _>("args"),
            "env": row.get::<Option<String>, _>("env")
        }),
        evidence_files: row.get("evidence_files"),
    })
}

async fn apply_skill_changes(resource_id: &str, changes: &Value, now: &str, pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"
        UPDATE skills
        SET description = COALESCE(?, description),
            summary = COALESCE(?, summary),
            category = COALESCE(?, category),
            tags = COALESCE(?, tags),
            confidence = COALESCE(?, confidence),
            evidence_files = COALESCE(?, evidence_files),
            manual_override = 0,
            last_analyzed_at = ?,
            updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(changes.get("description").and_then(Value::as_str))
    .bind(changes.get("summary").and_then(Value::as_str))
    .bind(changes.get("category").and_then(Value::as_str))
    .bind(changes.get("tags").map(Value::to_string))
    .bind(changes.get("confidence").and_then(Value::as_str))
    .bind(changes.get("evidence_files").map(Value::to_string))
    .bind(now)
    .bind(now)
    .bind(resource_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn apply_mcp_changes(resource_id: &str, changes: &Value, now: &str, pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"
        UPDATE mcp_servers
        SET description = COALESCE(?, description),
            summary = COALESCE(?, summary),
            category = COALESCE(?, category),
            tags = COALESCE(?, tags),
            confidence = COALESCE(?, confidence),
            evidence_files = COALESCE(?, evidence_files),
            manual_override = 0,
            last_analyzed_at = ?,
            updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(changes.get("description").and_then(Value::as_str))
    .bind(changes.get("summary").and_then(Value::as_str))
    .bind(changes.get("category").and_then(Value::as_str))
    .bind(changes.get("tags").map(Value::to_string))
    .bind(changes.get("confidence").and_then(Value::as_str))
    .bind(changes.get("evidence_files").map(Value::to_string))
    .bind(now)
    .bind(now)
    .bind(resource_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
