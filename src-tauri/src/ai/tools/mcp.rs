use crate::ai::safe_tools::{sanitize_output, ToolContext, ToolOutput};
use serde_json::{json, Value, Map};
use sqlx::Row;

pub fn sanitize_env_value(env_str: Option<&str>) -> Option<String> {
    let env_str = env_str?;
    if env_str.is_empty() {
        return Some(env_str.to_string());
    }
    if let Ok(mut obj) = serde_json::from_str::<Map<String, Value>>(env_str) {
        for val in obj.values_mut() {
            *val = Value::String("***".to_string());
        }
        serde_json::to_string(&obj).ok()
    } else {
        Some("***".to_string())
    }
}

pub async fn get_mcp_analysis(ctx: &ToolContext<'_>) -> Result<ToolOutput, String> {
    let total = sqlx::query("SELECT COUNT(*) as cnt FROM mcp_servers")
        .fetch_one(ctx.pool).await.map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let active_cnt = sqlx::query("SELECT COUNT(*) as cnt FROM mcp_servers WHERE status = 'active'")
        .fetch_one(ctx.pool).await.map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");

    let rows = sqlx::query(
        "SELECT id, name, description, command, args, env, status FROM mcp_servers LIMIT 15"
    )
    .fetch_all(ctx.pool).await.map_err(|e| e.to_string())?;

    let mut servers = Vec::new();
    for r in rows {
        let env_raw = r.get::<Option<String>, _>("env");
        let env_sanitized = sanitize_env_value(env_raw.as_deref());
        
        servers.push(json!({
            "id": r.get::<String, _>("id"),
            "name": r.get::<String, _>("name"),
            "description": r.get::<Option<String>, _>("description"),
            "command": r.get::<String, _>("command"),
            "args": r.get::<Option<String>, _>("args"),
            "env": env_sanitized,
            "status": r.get::<Option<String>, _>("status")
        }));
    }

    let analysis = json!({
        "stats": {
            "total_mcp_servers": total,
            "active_mcp_servers": active_cnt
        },
        "mcp_servers": servers
    });

    Ok(sanitize_output(analysis))
}
