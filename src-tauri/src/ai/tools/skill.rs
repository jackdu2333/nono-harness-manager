use crate::ai::safe_tools::{sanitize_output, ToolContext, ToolOutput};
use serde_json::json;
use sqlx::Row;

pub async fn get_skill_analysis(ctx: &ToolContext<'_>) -> Result<ToolOutput, String> {
    // 1. Fetch counts
    let total = sqlx::query("SELECT COUNT(*) as cnt FROM skills")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let needs_review_cnt = sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE needs_review = 1")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let needs_improvement_cnt =
        sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE needs_improvement = 1")
            .fetch_one(ctx.pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>("cnt");

    let duplicate_cnt =
        sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE duplicate_group_id IS NOT NULL")
            .fetch_one(ctx.pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>("cnt");

    let archived_cnt = sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE is_archived = 1")
        .fetch_one(ctx.pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    // 2. Fetch lists (with limits)
    let needs_review_rows = sqlx::query(
        "SELECT id, name, category, status, review_note FROM skills WHERE needs_review = 1 LIMIT 10"
    )
    .fetch_all(ctx.pool).await.map_err(|e| e.to_string())?;

    let mut needs_review_list = Vec::new();
    for r in needs_review_rows {
        needs_review_list.push(json!({
            "id": r.get::<String, _>("id"),
            "name": r.get::<String, _>("name"),
            "category": r.get::<Option<String>, _>("category"),
            "status": r.get::<String, _>("status"),
            "review_note": r.get::<Option<String>, _>("review_note")
        }));
    }

    let needs_improvement_rows = sqlx::query(
        "SELECT id, name, category, status, improvement_note FROM skills WHERE needs_improvement = 1 LIMIT 10"
    )
    .fetch_all(ctx.pool).await.map_err(|e| e.to_string())?;

    let mut needs_improvement_list = Vec::new();
    for r in needs_improvement_rows {
        needs_improvement_list.push(json!({
            "id": r.get::<String, _>("id"),
            "name": r.get::<String, _>("name"),
            "category": r.get::<Option<String>, _>("category"),
            "status": r.get::<String, _>("status"),
            "improvement_note": r.get::<Option<String>, _>("improvement_note")
        }));
    }

    let duplicate_rows = sqlx::query(
        "SELECT id, name, category, duplicate_group_id FROM skills WHERE duplicate_group_id IS NOT NULL LIMIT 15"
    )
    .fetch_all(ctx.pool).await.map_err(|e| e.to_string())?;

    let mut duplicate_list = Vec::new();
    for r in duplicate_rows {
        duplicate_list.push(json!({
            "id": r.get::<String, _>("id"),
            "name": r.get::<String, _>("name"),
            "category": r.get::<Option<String>, _>("category"),
            "duplicate_group_id": r.get::<Option<String>, _>("duplicate_group_id")
        }));
    }

    let analysis = json!({
        "stats": {
            "total_skills": total,
            "needs_review": needs_review_cnt,
            "needs_improvement": needs_improvement_cnt,
            "duplicates": duplicate_cnt,
            "archived": archived_cnt
        },
        "sample_needs_review": needs_review_list,
        "sample_needs_improvement": needs_improvement_list,
        "sample_duplicates": duplicate_list
    });

    Ok(sanitize_output(analysis))
}
