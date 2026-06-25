use crate::models::intelligence::IntelligenceProposal;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

pub const TRUST_POLICY_VERSION: &str = "trust_policy_v1";

pub const ALLOWED_AUTO_APPLY_FIELDS: &[&str] = &[
    "description",
    "summary",
    "category",
    "tags",
    "confidence",
    "evidence_files",
];

pub const FORBIDDEN_AUTO_APPLY_FIELDS: &[&str] = &[
    "path",
    "app_path",
    "config_path",
    "default_workspace",
    "launch_command",
    "command",
    "args",
    "env",
    "source_path",
    "status",
    "enabled",
    "scan_depth",
    "delete",
    "execute",
];

const ALLOWED_PROPOSAL_TYPES: &[&str] = &[
    "ai_metadata_update",
    "description_update",
    "classification_update",
    "mcp_description_update",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

impl RiskLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }
}

#[derive(Debug, Clone)]
pub struct TrustPolicySettings {
    pub auto_apply_low_risk: bool,
    pub require_evidence_files: bool,
    pub allowed_auto_apply_resource_types: Vec<String>,
    pub allowed_auto_apply_fields: Vec<String>,
    pub min_confidence_for_auto_apply: String,
    pub max_auto_apply_batch_size: usize,
}

impl Default for TrustPolicySettings {
    fn default() -> Self {
        Self {
            auto_apply_low_risk: true,
            require_evidence_files: true,
            allowed_auto_apply_resource_types: vec!["skill".to_string(), "mcp_server".to_string()],
            allowed_auto_apply_fields: ALLOWED_AUTO_APPLY_FIELDS
                .iter()
                .map(|field| field.to_string())
                .collect(),
            min_confidence_for_auto_apply: "medium".to_string(),
            max_auto_apply_batch_size: 20,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TrustPolicyDecision {
    pub risk_level: RiskLevel,
    pub reasons: Vec<String>,
    pub can_auto_apply: bool,
}

pub fn assess_proposal_risk(
    resource_type: &str,
    proposal_type: &str,
    changes: &Value,
    rollback_available: bool,
    settings: &TrustPolicySettings,
) -> TrustPolicyDecision {
    let Some(object) = changes.as_object() else {
        return TrustPolicyDecision {
            risk_level: RiskLevel::High,
            reasons: vec!["proposed_changes must be a JSON object".to_string()],
            can_auto_apply: false,
        };
    };

    let mut reasons = Vec::new();
    let keys = object.keys().map(String::as_str).collect::<Vec<_>>();

    if !settings
        .allowed_auto_apply_resource_types
        .iter()
        .any(|allowed| allowed == resource_type)
    {
        reasons.push(format!(
            "resource_type is not allowed for auto apply: {resource_type}"
        ));
    }

    if !ALLOWED_PROPOSAL_TYPES.contains(&proposal_type) {
        reasons.push(format!(
            "proposal_type is not allowed for auto apply: {proposal_type}"
        ));
    }

    for key in &keys {
        if FORBIDDEN_AUTO_APPLY_FIELDS.contains(key) {
            return TrustPolicyDecision {
                risk_level: RiskLevel::High,
                reasons: vec![format!("forbidden field blocks auto apply: {key}")],
                can_auto_apply: false,
            };
        }
    }

    for key in &keys {
        if !settings
            .allowed_auto_apply_fields
            .iter()
            .any(|allowed| allowed == key)
        {
            return TrustPolicyDecision {
                risk_level: RiskLevel::High,
                reasons: vec![format!("unsupported proposed_changes field: {key}")],
                can_auto_apply: false,
            };
        }
    }

    let confidence = changes
        .get("confidence")
        .and_then(Value::as_str)
        .map(str::to_lowercase);
    if !confidence_meets_minimum(
        confidence.as_deref(),
        &settings.min_confidence_for_auto_apply,
    ) {
        reasons.push("confidence is below auto apply threshold".to_string());
    }

    let evidence_files = extract_evidence_files(changes);
    if settings.require_evidence_files && evidence_files.is_empty() {
        reasons.push("evidence_files is required for auto apply".to_string());
    }

    if !rollback_available {
        reasons
            .push("before_state snapshot is unavailable, rollback is not guaranteed".to_string());
    }

    if settings.max_auto_apply_batch_size == 0 {
        reasons.push("max_auto_apply_batch_size disables auto apply".to_string());
    }

    let risk_level = if reasons.is_empty() {
        RiskLevel::Low
    } else {
        RiskLevel::Medium
    };
    let can_auto_apply = risk_level == RiskLevel::Low && settings.auto_apply_low_risk;

    TrustPolicyDecision {
        risk_level,
        reasons,
        can_auto_apply,
    }
}

pub async fn load_trust_policy_settings(pool: &SqlitePool) -> TrustPolicySettings {
    let mut settings = TrustPolicySettings::default();
    let rows = sqlx::query(
        r#"
        SELECT key, value FROM settings
        WHERE key IN (
          'auto_apply_low_risk',
          'require_evidence_files',
          'allowed_auto_apply_resource_types',
          'allowed_auto_apply_fields',
          'min_confidence_for_auto_apply',
          'max_auto_apply_batch_size'
        )
        "#,
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for row in rows {
        let key = row.get::<String, _>("key");
        let value = row.get::<Option<String>, _>("value").unwrap_or_default();
        match key.as_str() {
            "auto_apply_low_risk" => settings.auto_apply_low_risk = parse_bool(&value, true),
            "require_evidence_files" => settings.require_evidence_files = parse_bool(&value, true),
            "allowed_auto_apply_resource_types" => {
                settings.allowed_auto_apply_resource_types = parse_list(&value)
            }
            "allowed_auto_apply_fields" => settings.allowed_auto_apply_fields = parse_list(&value),
            "min_confidence_for_auto_apply" => {
                settings.min_confidence_for_auto_apply = value.to_lowercase()
            }
            "max_auto_apply_batch_size" => {
                settings.max_auto_apply_batch_size = value.parse::<usize>().unwrap_or(20)
            }
            _ => {}
        }
    }

    settings
}

pub async fn run_trust_policy_for_proposal(
    pool: &SqlitePool,
    proposal_id: &str,
) -> Result<IntelligenceProposal, String> {
    let proposal = fetch_proposal(pool, proposal_id).await?;
    let changes: Value = serde_json::from_str(&proposal.proposed_changes)
        .map_err(|e| format!("Invalid proposed_changes JSON: {e}"))?;
    let settings = load_trust_policy_settings(pool).await;
    let rollback_available =
        get_resource_snapshot(&proposal.resource_type, &proposal.resource_id, pool)
            .await
            .is_ok();
    let mut decision = assess_proposal_risk(
        &proposal.resource_type,
        &proposal.proposal_type,
        &changes,
        rollback_available,
        &settings,
    );

    if decision.risk_level != RiskLevel::High && settings.require_evidence_files {
        let evidence_files = extract_evidence_files(&changes);
        if !evidence_files_are_verifiable(
            pool,
            &proposal.resource_type,
            &proposal.resource_id,
            &evidence_files,
        )
        .await?
        {
            decision.risk_level = RiskLevel::Medium;
            decision.can_auto_apply = false;
            decision
                .reasons
                .push("evidence_files could not be verified locally".to_string());
        }
    }

    let status = match decision.risk_level {
        RiskLevel::Low if decision.can_auto_apply => "pending",
        RiskLevel::Low | RiskLevel::Medium => "pending_review",
        RiskLevel::High => "blocked",
    };
    update_policy_columns(pool, proposal_id, status, &decision, false).await?;

    if decision.can_auto_apply {
        apply_proposal(pool, proposal_id, "trust_policy", true).await?;
    }

    fetch_proposal(pool, proposal_id).await
}

pub async fn apply_proposal(
    pool: &SqlitePool,
    proposal_id: &str,
    actor: &str,
    auto_applied: bool,
) -> Result<(), String> {
    let proposal = fetch_proposal(pool, proposal_id).await?;
    if !matches!(
        proposal.status.as_deref(),
        Some("pending") | Some("pending_review")
    ) {
        return Err("Only pending or pending_review proposals can be applied".to_string());
    }

    let changes: Value = serde_json::from_str(&proposal.proposed_changes)
        .map_err(|e| format!("Invalid proposed_changes JSON: {e}"))?;
    ensure_applyable_changes(&changes)?;

    let now = Utc::now().to_rfc3339();
    let before_state = get_resource_snapshot(&proposal.resource_type, &proposal.resource_id, pool)
        .await
        .map_err(|e| format!("Unable to capture before_state: {e}"))?;

    match proposal.resource_type.as_str() {
        "skill" => apply_skill_changes(&proposal.resource_id, &changes, &now, pool).await?,
        "mcp_server" => apply_mcp_changes(&proposal.resource_id, &changes, &now, pool).await?,
        _ => return Err("Apply is only enabled for skill and mcp_server".to_string()),
    }

    let after_state = get_resource_snapshot(&proposal.resource_type, &proposal.resource_id, pool)
        .await
        .map_err(|e| format!("Unable to capture after_state: {e}"))?;

    sqlx::query(
        r#"
        UPDATE intelligence_proposals
        SET status = 'applied',
            applied_at = ?,
            auto_applied = ?,
            risk_level = COALESCE(risk_level, 'low'),
            trust_policy_version = COALESCE(trust_policy_version, ?)
        WHERE id = ?
        "#,
    )
    .bind(&now)
    .bind(if auto_applied { 1 } else { 0 })
    .bind(TRUST_POLICY_VERSION)
    .bind(proposal_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO audit_logs
          (id, actor, action, resource_type, resource_id, proposal_id, before_state, after_state, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(actor)
    .bind(if auto_applied {
        "auto_apply_intelligence_proposal"
    } else {
        "apply_intelligence_proposal"
    })
    .bind(&proposal.resource_type)
    .bind(&proposal.resource_id)
    .bind(proposal_id)
    .bind(before_state.to_string())
    .bind(after_state.to_string())
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn reject_proposal(
    pool: &SqlitePool,
    proposal_id: &str,
    actor: &str,
) -> Result<(), String> {
    let proposal = fetch_proposal(pool, proposal_id).await?;
    if matches!(
        proposal.status.as_deref(),
        Some("applied") | Some("rolled_back")
    ) {
        return Err("Applied proposals cannot be rejected".to_string());
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE intelligence_proposals SET status = 'rejected' WHERE id = ?")
        .bind(proposal_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO audit_logs
          (id, actor, action, resource_type, resource_id, proposal_id, before_state, after_state, created_at)
        VALUES (?, ?, 'reject_intelligence_proposal', ?, ?, ?, NULL, NULL, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(actor)
    .bind(&proposal.resource_type)
    .bind(&proposal.resource_id)
    .bind(proposal_id)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn rollback_proposal(
    pool: &SqlitePool,
    proposal_id: &str,
    actor: &str,
) -> Result<(), String> {
    let proposal = fetch_proposal(pool, proposal_id).await?;
    if proposal.status.as_deref() != Some("applied") {
        return Err("Only applied proposals can be rolled back".to_string());
    }

    let audit = sqlx::query(
        r#"
        SELECT before_state FROM audit_logs
        WHERE proposal_id = ?
          AND action IN ('apply_intelligence_proposal', 'auto_apply_intelligence_proposal')
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(proposal_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Unable to find apply audit log: {e}"))?;
    let before_state_raw = audit
        .get::<Option<String>, _>("before_state")
        .ok_or_else(|| "Apply audit log does not contain before_state".to_string())?;
    let before_state: Value = serde_json::from_str(&before_state_raw)
        .map_err(|e| format!("Invalid before_state JSON: {e}"))?;

    let now = Utc::now().to_rfc3339();
    let current_state = get_resource_snapshot(&proposal.resource_type, &proposal.resource_id, pool)
        .await
        .map_err(|e| format!("Unable to capture rollback before_state: {e}"))?;

    restore_resource_snapshot(
        &proposal.resource_type,
        &proposal.resource_id,
        &before_state,
        &now,
        pool,
    )
    .await?;

    let restored_state =
        get_resource_snapshot(&proposal.resource_type, &proposal.resource_id, pool)
            .await
            .map_err(|e| format!("Unable to capture rollback after_state: {e}"))?;

    sqlx::query("UPDATE intelligence_proposals SET status = 'rolled_back' WHERE id = ?")
        .bind(proposal_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO audit_logs
          (id, actor, action, resource_type, resource_id, proposal_id, before_state, after_state, created_at)
        VALUES (?, ?, 'rollback_intelligence_proposal', ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(actor)
    .bind(&proposal.resource_type)
    .bind(&proposal.resource_id)
    .bind(proposal_id)
    .bind(current_state.to_string())
    .bind(restored_state.to_string())
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn fetch_proposal(
    pool: &SqlitePool,
    proposal_id: &str,
) -> Result<IntelligenceProposal, String> {
    sqlx::query_as::<_, IntelligenceProposal>("SELECT * FROM intelligence_proposals WHERE id = ?")
        .bind(proposal_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}

pub async fn resource_exists(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
) -> Result<bool, String> {
    let query = match resource_type {
        "skill" => "SELECT COUNT(*) as count FROM skills WHERE id = ?",
        "mcp_server" => "SELECT COUNT(*) as count FROM mcp_servers WHERE id = ?",
        "memory_source" => "SELECT COUNT(*) as count FROM memory_sources WHERE id = ?",
        "knowledge_base" => "SELECT COUNT(*) as count FROM knowledge_bases WHERE id = ?",
        "project" => "SELECT COUNT(*) as count FROM projects WHERE id = ?",
        _ => return Err("Unsupported resource type".to_string()),
    };

    let count: i64 = sqlx::query(query)
        .bind(resource_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?
        .get("count");

    Ok(count > 0)
}

pub fn ensure_json_object(changes: &Value) -> Result<(), String> {
    if changes.is_object() {
        Ok(())
    } else {
        Err("proposed_changes must be a JSON object".to_string())
    }
}

fn ensure_applyable_changes(changes: &Value) -> Result<(), String> {
    ensure_json_object(changes)?;
    for key in changes.as_object().expect("checked object").keys() {
        if !ALLOWED_AUTO_APPLY_FIELDS.contains(&key.as_str()) {
            return Err(format!("Unsupported proposed_changes field: {key}"));
        }
    }
    Ok(())
}

async fn update_policy_columns(
    pool: &SqlitePool,
    proposal_id: &str,
    status: &str,
    decision: &TrustPolicyDecision,
    auto_applied: bool,
) -> Result<(), String> {
    sqlx::query(
        r#"
        UPDATE intelligence_proposals
        SET status = ?,
            risk_level = ?,
            risk_reasons = ?,
            auto_applied = ?,
            trust_policy_version = ?
        WHERE id = ?
        "#,
    )
    .bind(status)
    .bind(decision.risk_level.as_str())
    .bind(json!(decision.reasons).to_string())
    .bind(if auto_applied { 1 } else { 0 })
    .bind(TRUST_POLICY_VERSION)
    .bind(proposal_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn get_resource_snapshot(
    resource_type: &str,
    resource_id: &str,
    pool: &SqlitePool,
) -> Result<Value, String> {
    let query = match resource_type {
        "skill" => {
            r#"
            SELECT description, summary, category, tags, confidence, evidence_files,
                   manual_override, last_analyzed_at
            FROM skills WHERE id = ?
            "#
        }
        "mcp_server" => {
            r#"
            SELECT description, summary, category, tags, confidence, evidence_files,
                   manual_override, last_analyzed_at
            FROM mcp_servers WHERE id = ?
            "#
        }
        _ => return Err("Snapshots are only enabled for skill and mcp_server".to_string()),
    };

    let row = sqlx::query(query)
        .bind(resource_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "description": row.get::<Option<String>, _>("description"),
        "summary": row.get::<Option<String>, _>("summary"),
        "category": row.get::<Option<String>, _>("category"),
        "tags": row.get::<Option<String>, _>("tags"),
        "confidence": row.get::<Option<String>, _>("confidence"),
        "evidence_files": row.get::<Option<String>, _>("evidence_files"),
        "manual_override": row.get::<Option<i64>, _>("manual_override"),
        "last_analyzed_at": row.get::<Option<String>, _>("last_analyzed_at"),
    }))
}

async fn apply_skill_changes(
    resource_id: &str,
    changes: &Value,
    now: &str,
    pool: &SqlitePool,
) -> Result<(), String> {
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
        "#,
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

async fn apply_mcp_changes(
    resource_id: &str,
    changes: &Value,
    now: &str,
    pool: &SqlitePool,
) -> Result<(), String> {
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
        "#,
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

async fn restore_resource_snapshot(
    resource_type: &str,
    resource_id: &str,
    snapshot: &Value,
    now: &str,
    pool: &SqlitePool,
) -> Result<(), String> {
    let query = match resource_type {
        "skill" => {
            r#"
            UPDATE skills
            SET description = ?,
                summary = ?,
                category = ?,
                tags = ?,
                confidence = ?,
                evidence_files = ?,
                manual_override = ?,
                last_analyzed_at = ?,
                updated_at = ?
            WHERE id = ?
            "#
        }
        "mcp_server" => {
            r#"
            UPDATE mcp_servers
            SET description = ?,
                summary = ?,
                category = ?,
                tags = ?,
                confidence = ?,
                evidence_files = ?,
                manual_override = ?,
                last_analyzed_at = ?,
                updated_at = ?
            WHERE id = ?
            "#
        }
        _ => return Err("Rollback is only enabled for skill and mcp_server".to_string()),
    };

    sqlx::query(query)
        .bind(snapshot.get("description").and_then(Value::as_str))
        .bind(snapshot.get("summary").and_then(Value::as_str))
        .bind(snapshot.get("category").and_then(Value::as_str))
        .bind(snapshot.get("tags").and_then(Value::as_str))
        .bind(snapshot.get("confidence").and_then(Value::as_str))
        .bind(snapshot.get("evidence_files").and_then(Value::as_str))
        .bind(snapshot.get("manual_override").and_then(Value::as_i64))
        .bind(snapshot.get("last_analyzed_at").and_then(Value::as_str))
        .bind(now)
        .bind(resource_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn evidence_files_are_verifiable(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
    evidence_files: &[String],
) -> Result<bool, String> {
    if evidence_files.is_empty() {
        return Ok(false);
    }

    match resource_type {
        "skill" => {
            let row = sqlx::query("SELECT path FROM skills WHERE id = ?")
                .bind(resource_id)
                .fetch_one(pool)
                .await
                .map_err(|e| e.to_string())?;
            let path = row.get::<String, _>("path");
            let skill_path = std::path::Path::new(&path);
            let skill_dir = if skill_path.is_dir() {
                skill_path.to_path_buf()
            } else {
                skill_path
                    .parent()
                    .ok_or_else(|| "Skill path has no parent directory".to_string())?
                    .to_path_buf()
            };
            Ok(evidence_files.iter().all(|file| {
                let relative_only = !file.contains('/') && !file.contains('\\');
                relative_only && skill_dir.join(file).is_file()
            }))
        }
        "mcp_server" => {
            let row = sqlx::query("SELECT source_path FROM mcp_servers WHERE id = ?")
                .bind(resource_id)
                .fetch_one(pool)
                .await
                .map_err(|e| e.to_string())?;
            let source_path = row.get::<Option<String>, _>("source_path");
            let Some(source_path) = source_path else {
                return Ok(false);
            };
            let path = std::path::Path::new(&source_path);
            let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
                return Ok(false);
            };
            Ok(path.is_file()
                && evidence_files
                    .iter()
                    .any(|file| file == file_name || file == &source_path))
        }
        _ => Ok(false),
    }
}

fn extract_evidence_files(changes: &Value) -> Vec<String> {
    match changes.get("evidence_files") {
        Some(Value::Array(files)) => files
            .iter()
            .filter_map(Value::as_str)
            .filter(|file| !file.trim().is_empty())
            .map(|file| file.to_string())
            .collect(),
        Some(Value::String(file)) if !file.trim().is_empty() => vec![file.to_string()],
        _ => Vec::new(),
    }
}

fn confidence_meets_minimum(confidence: Option<&str>, minimum: &str) -> bool {
    let Some(confidence) = confidence else {
        return false;
    };
    confidence_rank(confidence) >= confidence_rank(minimum)
}

fn confidence_rank(value: &str) -> i32 {
    match value.to_lowercase().as_str() {
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        _ => 0,
    }
}

fn parse_bool(value: &str, default: bool) -> bool {
    match value.to_lowercase().as_str() {
        "true" | "1" | "yes" => true,
        "false" | "0" | "no" => false,
        _ => default,
    }
}

fn parse_list(value: &str) -> Vec<String> {
    let items = value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    if items.is_empty() {
        Vec::new()
    } else {
        items
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn low_risk_auto_apply_can_be_rolled_back() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory sqlite should connect");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrations should run");

        let skill_dir = std::env::temp_dir().join(format!("harness-trust-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&skill_dir).expect("skill dir should be created");
        let skill_file = skill_dir.join("SKILL.md");
        std::fs::write(&skill_file, "# Test Skill\n").expect("skill file should be written");

        sqlx::query(
            r#"
            INSERT INTO skills
              (id, name, path, skill_type, status, entry_file, created_at, updated_at)
            VALUES
              ('skill-rollback-1', 'Rollback Skill', ?, 'Prompt', 'active', 'SKILL.md', 'now', 'now')
            "#,
        )
        .bind(skill_file.to_string_lossy().to_string())
        .execute(&pool)
        .await
        .expect("skill should be inserted");

        let proposal_id = Uuid::new_v4().to_string();
        let changes = json!({
            "description": "自动应用简介",
            "summary": "自动应用摘要",
            "category": "开发测试",
            "tags": ["rollback"],
            "confidence": "high",
            "evidence_files": ["SKILL.md"]
        });
        sqlx::query(
            r#"
            INSERT INTO intelligence_proposals
              (id, resource_type, resource_id, proposal_type, proposed_changes, status, created_by, created_at)
            VALUES
              (?, 'skill', 'skill-rollback-1', 'description_update', ?, 'pending', 'test', 'now')
            "#,
        )
        .bind(&proposal_id)
        .bind(changes.to_string())
        .execute(&pool)
        .await
        .expect("proposal should be inserted");

        let proposal = run_trust_policy_for_proposal(&pool, &proposal_id)
            .await
            .expect("trust policy should run");
        assert_eq!(proposal.status.as_deref(), Some("applied"));
        assert_eq!(proposal.auto_applied, Some(1));

        let description: Option<String> =
            sqlx::query_scalar("SELECT description FROM skills WHERE id = 'skill-rollback-1'")
                .fetch_one(&pool)
                .await
                .expect("description should be readable");
        assert_eq!(description.as_deref(), Some("自动应用简介"));

        rollback_proposal(&pool, &proposal_id, "test")
            .await
            .expect("rollback should succeed");

        let description: Option<String> =
            sqlx::query_scalar("SELECT description FROM skills WHERE id = 'skill-rollback-1'")
                .fetch_one(&pool)
                .await
                .expect("description should be readable after rollback");
        assert_eq!(description, None);

        let status: String =
            sqlx::query_scalar("SELECT status FROM intelligence_proposals WHERE id = ?")
                .bind(&proposal_id)
                .fetch_one(&pool)
                .await
                .expect("proposal status should be readable");
        assert_eq!(status, "rolled_back");

        let audit_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_logs WHERE proposal_id = ? AND before_state IS NOT NULL AND after_state IS NOT NULL",
        )
        .bind(&proposal_id)
        .fetch_one(&pool)
        .await
        .expect("audit count should be readable");
        assert_eq!(audit_count, 2);
    }
}
