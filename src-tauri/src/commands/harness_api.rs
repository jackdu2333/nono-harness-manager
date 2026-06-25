use crate::models::intelligence::{
    HarnessResourceContext, HarnessResourceSummary, IntelligenceProposal,
};
use crate::trust_policy;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::path::{Path, PathBuf};
use tauri::{command, State};
use uuid::Uuid;

const SAFE_CONTEXT_MAX_CHARS: usize = 2048;
const SAFE_CONTEXT_FILES: &[&str] = &[
    "README.md",
    "readme.md",
    "SKILL.md",
    "skill.md",
    "skill.yaml",
    "skill.json",
];


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
            "#,
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
            "#,
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
    if !matches!(
        resource_type.as_str(),
        "skill" | "mcp_server" | "memory_source" | "knowledge_base" | "project"
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

#[command]
pub async fn rollback_intelligence_proposal(
    proposal_id: String,
    actor: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let actor = actor.unwrap_or_else(|| "user".to_string());
    trust_policy::rollback_proposal(&pool, &proposal_id, &actor).await
}

async fn get_skill_context(
    resource_id: &str,
    pool: &SqlitePool,
) -> Result<HarnessResourceContext, String> {
    let row = sqlx::query(
        r#"
        SELECT id, name, description, summary, category, tags, confidence,
               manual_override, last_analyzed_at, status, path, entry_file, evidence_files
        FROM skills WHERE id = ?
        "#,
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
            "path": path,
            "entry_file": entry_file,
            "safe_content_excerpt": safe_excerpt.as_ref().map(|excerpt| excerpt.content.clone()),
            "excerpt_evidence_files": safe_excerpt.as_ref().map(|excerpt| excerpt.evidence_files.clone())
        }),
        evidence_files,
    })
}

async fn get_mcp_context(
    resource_id: &str,
    pool: &SqlitePool,
) -> Result<HarnessResourceContext, String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::trust_policy::{assess_proposal_risk, RiskLevel, TrustPolicySettings};
    use serde_json::json;

    #[test]
    fn proposal_changes_reject_unknown_fields() {
        let changes = json!({
            "description": "Useful description",
            "launch_command": "rm -rf ~"
        });

        assert!(validate_proposed_changes(&changes).is_err());
    }

    #[test]
    fn proposal_changes_accept_ai_metadata_fields() {
        let changes = json!({
            "description": "Useful description",
            "summary": "Short summary",
            "category": "编程开发",
            "tags": ["rust", "tauri"],
            "confidence": "medium",
            "evidence_files": ["SKILL.md"]
        });

        assert!(validate_proposed_changes(&changes).is_ok());
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
