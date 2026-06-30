use crate::ai::safe_tools::{sanitize_output, ToolContext, ToolOutput};
use serde_json::json;
use sqlx::Row;

pub async fn get_agent_analysis(ctx: &ToolContext<'_>) -> Result<ToolOutput, String> {
    let total = sqlx::query("SELECT COUNT(*) as cnt FROM agents")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let active_cnt = sqlx::query("SELECT COUNT(*) as cnt FROM agents WHERE status = 'active'")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let broken_cnt = sqlx::query("SELECT COUNT(*) as cnt FROM agents WHERE status = 'broken'")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let candidate_cnt = sqlx::query(
        "SELECT COUNT(*) as cnt FROM agents WHERE is_user_confirmed = 0 AND is_ignored = 0",
    )
    .fetch_one(ctx.pool)
    .await
    .map_err(|e| e.to_string())?
    .get::<i64, _>("cnt");

    let ignored_cnt = sqlx::query("SELECT COUNT(*) as cnt FROM agents WHERE is_ignored = 1")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    // Fetch lists with limit
    let broken_rows = sqlx::query(
        "SELECT id, name, agent_key, type, status, detection_source FROM agents WHERE status = 'broken' LIMIT 10"
    )
    .fetch_all(ctx.pool).await.map_err(|e| e.to_string())?;

    let mut broken_list = Vec::new();
    for r in broken_rows {
        broken_list.push(json!({
            "id": r.get::<String, _>("id"),
            "name": r.get::<String, _>("name"),
            "agent_key": r.get::<Option<String>, _>("agent_key"),
            "type": r.get::<Option<String>, _>("type"),
            "status": r.get::<Option<String>, _>("status"),
            "detection_source": r.get::<Option<String>, _>("detection_source")
        }));
    }

    let candidate_rows = sqlx::query(
        "SELECT id, name, agent_key, type, status, detection_source FROM agents WHERE is_user_confirmed = 0 AND is_ignored = 0 LIMIT 10"
    )
    .fetch_all(ctx.pool).await.map_err(|e| e.to_string())?;

    let mut candidate_list = Vec::new();
    for r in candidate_rows {
        candidate_list.push(json!({
            "id": r.get::<String, _>("id"),
            "name": r.get::<String, _>("name"),
            "agent_key": r.get::<Option<String>, _>("agent_key"),
            "type": r.get::<Option<String>, _>("type"),
            "status": r.get::<Option<String>, _>("status"),
            "detection_source": r.get::<Option<String>, _>("detection_source")
        }));
    }

    let analysis = json!({
        "stats": {
            "total_agents": total,
            "active_agents": active_cnt,
            "broken_agents": broken_cnt,
            "candidate_agents": candidate_cnt,
            "ignored_agents": ignored_cnt
        },
        "broken_agents": broken_list,
        "candidate_agents": candidate_list
    });

    Ok(sanitize_output(analysis))
}
