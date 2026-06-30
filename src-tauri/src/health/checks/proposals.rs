// Proposal Health 检查 — 6 项

use super::super::types::HealthIssue;
use chrono::{DateTime, Utc};
use sqlx::{Row, SqlitePool};

pub async fn check(pool: &SqlitePool) -> Result<(usize, Vec<HealthIssue>), String> {
    let rows = sqlx::query(
        "SELECT id, resource_type, resource_id, proposal_type, status, \
         created_at, acknowledged_at, risk_level \
         FROM intelligence_proposals",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut issues = Vec::new();
    let total = rows.len();

    for row in rows {
        let id: String = row.get("id");
        let resource_type: String = row.get("resource_type");
        let resource_id: String = row.get("resource_id");
        let proposal_type: String = row.get("proposal_type");
        let status: String = row.get("status");
        let created_at: String = row.get("created_at");
        let acknowledged_at: Option<String> = row.get("acknowledged_at");
        let risk_level: Option<String> = row.get("risk_level");

        let now = Utc::now();

        // 1. pending_review 超过 7 天
        if status == "pending_review" || status == "pending" {
            if let Ok(created) = DateTime::parse_from_rfc3339(&created_at) {
                let age = now.signed_duration_since(created.with_timezone(&Utc));
                if age.num_days() > 7 {
                    issues.push(
                        HealthIssue::new(
                            "warning",
                            "Proposal",
                            "proposal",
                            "Proposal 待处理超时",
                            format!(
                                "proposal {id} 处于 {status} 已超过 7 天 ({}天)。",
                                age.num_days()
                            ),
                            "尽快审核该 proposal，应用或拒绝。",
                        )
                        .with_resource(Some(format!("proposal:{id}")), None)
                        .with_resource_id("Proposal", &id)
                        .with_evidence(&format!("status={status}, created_at={created_at}")),
                    );
                }
            }
        }

        // 2. pending_manual_review 超过 7 天
        if status == "pending_manual_review" {
            if let Ok(created) = DateTime::parse_from_rfc3339(&created_at) {
                let age = now.signed_duration_since(created.with_timezone(&Utc));
                if age.num_days() > 7 {
                    issues.push(
                        HealthIssue::new(
                            "warning",
                            "Proposal",
                            "proposal",
                            "Proposal 人工审核超时",
                            format!(
                                "proposal {id} 待人工审核已超过 7 天 ({}天)。",
                                age.num_days()
                            ),
                            "尽快完成人工审核。",
                        )
                        .with_resource(Some(format!("proposal:{id}")), None)
                        .with_resource_id("Proposal", &id),
                    );
                }
            }
        }

        // 3. blocked 且未 acknowledged
        if status == "blocked" && acknowledged_at.is_none() {
            issues.push(
                HealthIssue::new(
                    "info",
                    "Proposal",
                    "proposal",
                    "Proposal 被拦截但未确认",
                    format!("proposal {id} 被 Trust Policy 拦截，但用户尚未确认。"),
                    "查看拦截原因，确认后标记 acknowledged。",
                )
                .with_resource(Some(format!("proposal:{id}")), None)
                .with_resource_id("Proposal", &id)
                .with_evidence(&format!("risk_level={}", risk_level.unwrap_or_default())),
            );
        }

        // 4. proposal 的 resource 不存在
        let resource_exists = check_resource_exists(pool, &resource_type, &resource_id).await?;
        if !resource_exists {
            issues.push(
                HealthIssue::new(
                    "error",
                    "Proposal",
                    "index",
                    "Proposal 引用不存在的资源",
                    format!("proposal {id} → {resource_type}:{resource_id} 不存在"),
                    "删除该 proposal 或修正资源引用。",
                )
                .with_resource(Some(format!("proposal:{id}")), None)
                .with_resource_id("Proposal", &id)
                .with_evidence(&format!(
                    "resource_type={resource_type}, resource_id={resource_id}"
                )),
            );
        }

        // 5. failed / rollback_failed
        if status == "failed" || status == "rollback_failed" {
            issues.push(
                HealthIssue::new(
                    "error",
                    "Proposal",
                    "proposal",
                    "Proposal 执行失败",
                    format!("proposal {id} 状态为 {status}。"),
                    "检查日志，修复问题后重试或清除。",
                )
                .with_resource(Some(format!("proposal:{id}")), None)
                .with_resource_id("Proposal", &id),
            );
        }
    }

    Ok((total, issues))
}

/// 检查资源是否在对应表中存在
async fn check_resource_exists(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
) -> Result<bool, String> {
    let query: &'static str = match resource_type {
        "Skill" => "SELECT COUNT(*) FROM skills WHERE id = ?",
        "Agent" => "SELECT COUNT(*) FROM agents WHERE id = ?",
        "MCP" => "SELECT COUNT(*) FROM mcp_servers WHERE id = ?",
        "Memory" => "SELECT COUNT(*) FROM memory_sources WHERE id = ?",
        "Knowledge" => "SELECT COUNT(*) FROM knowledge_bases WHERE id = ?",
        _ => return Ok(true), // 未知类型不做检查
    };

    let result: Option<(i64,)> = sqlx::query_as(query)
        .bind(resource_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(matches!(result, Some((n,)) if n > 0))
}
