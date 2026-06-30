use crate::ai::safe_tools::{sanitize_output, ToolContext, ToolOutput};
use serde_json::json;
use sqlx::Row;

pub async fn get_dashboard_summary(ctx: &ToolContext<'_>) -> Result<ToolOutput, String> {
    let skills_total = sqlx::query("SELECT COUNT(*) as cnt FROM skills")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let skills_active = sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE is_archived = 0")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let skills_favorite = sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE is_favorite = 1")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let skills_needs_review =
        sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE needs_review = 1")
            .fetch_one(ctx.pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>("cnt");

    let skills_needs_improvement =
        sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE needs_improvement = 1")
            .fetch_one(ctx.pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>("cnt");

    let agents_total = sqlx::query("SELECT COUNT(*) as cnt FROM agents")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let agents_active = sqlx::query("SELECT COUNT(*) as cnt FROM agents WHERE status = 'active'")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let agents_broken = sqlx::query("SELECT COUNT(*) as cnt FROM agents WHERE status = 'broken'")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let agents_candidate = sqlx::query(
        "SELECT COUNT(*) as cnt FROM agents WHERE is_user_confirmed = 0 AND is_ignored = 0",
    )
    .fetch_one(ctx.pool)
    .await
    .map_err(|e| e.to_string())?
    .get::<i64, _>("cnt");

    let mcp_total = sqlx::query("SELECT COUNT(*) as cnt FROM mcp_servers")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let mcp_active = sqlx::query("SELECT COUNT(*) as cnt FROM mcp_servers WHERE status = 'active'")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let proposals_pending =
        sqlx::query("SELECT COUNT(*) as cnt FROM intelligence_proposals WHERE status = 'pending'")
            .fetch_one(ctx.pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>("cnt");

    let proposals_applied =
        sqlx::query("SELECT COUNT(*) as cnt FROM intelligence_proposals WHERE status = 'applied'")
            .fetch_one(ctx.pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>("cnt");

    let proposals_rejected =
        sqlx::query("SELECT COUNT(*) as cnt FROM intelligence_proposals WHERE status = 'rejected'")
            .fetch_one(ctx.pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>("cnt");

    let summary = json!({
        "skills": {
            "total": skills_total,
            "active": skills_active,
            "favorite": skills_favorite,
            "needs_review": skills_needs_review,
            "needs_improvement": skills_needs_improvement
        },
        "agents": {
            "total": agents_total,
            "active": agents_active,
            "broken": agents_broken,
            "candidate": agents_candidate
        },
        "mcp_servers": {
            "total": mcp_total,
            "active": mcp_active
        },
        "proposals": {
            "pending": proposals_pending,
            "applied": proposals_applied,
            "rejected": proposals_rejected
        }
    });

    Ok(sanitize_output(summary))
}
