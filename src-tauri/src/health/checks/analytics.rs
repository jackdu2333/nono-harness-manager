// Analytics Health 检查
// 使用 scan_logs 表（非 analytics_scan_log）和内存扫描状态

use super::super::types::HealthIssue;
use sqlx::SqlitePool;

pub async fn check(pool: &SqlitePool) -> Result<(usize, Vec<HealthIssue>), String> {
    let mut issues = Vec::new();
    let mut checked = 0usize;

    // 检查是否有资源存在
    let total_resources: (i64,) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM skills) + (SELECT COUNT(*) FROM agents) + (SELECT COUNT(*) FROM mcp_servers)",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    let has_resources = total_resources.0 > 0;

    // 1. scan_logs 中最近的扫描状态为 failed
    // 表名是 scan_logs，状态列是 status
    let last_scan: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT status FROM scan_logs ORDER BY started_at DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if matches!(last_scan, Some((Some(ref s),)) if s == "failed") {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "error", "Analytics", "analytics",
                "日志扫描失败",
                "最近一次扫描状态为 failed。",
                "检查扫描错误日志，确认权限和路径后重试。",
            )
            .with_resource(Some("scan_logs".to_string()), None),
        );
    }

    // 2. 有资源但从未完成扫描
    if has_resources {
        let last_finished: Option<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM scan_logs WHERE status = 'completed' OR status = 'success'",
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

        let no_finished = match last_finished {
            Some((0,)) => true,
            None => true,
            _ => false,
        };

        if no_finished {
            checked += 1;
            issues.push(
                HealthIssue::new(
                    "warning", "Analytics", "analytics",
                    "日志扫描未完成",
                    "系统中有已索引的资源，但从未完成过日志扫描。",
                    "执行 Agent 日志扫描以生成使用统计数据。",
                )
                .with_resource(Some("scan_logs".to_string()), None),
            );
        }
    }

    // 3. 超过 7 天没有成功扫描
    if has_resources {
        let stale_scan: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT finished_at FROM scan_logs \
             WHERE status IN ('completed', 'success') \
             ORDER BY finished_at DESC LIMIT 1",
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

        if let Some((Some(ref lfa),)) = stale_scan {
            if !lfa.is_empty() {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(lfa) {
                    let age = chrono::Utc::now().signed_duration_since(dt.with_timezone(&chrono::Utc));
                    if age.num_days() > 7 {
                        checked += 1;
                        issues.push(
                            HealthIssue::new(
                                "info", "Analytics", "analytics",
                                "日志扫描数据过旧",
                                format!("上次成功扫描距今已超过 7 天 ({}天)。", age.num_days()),
                                "重新执行日志扫描以刷新使用数据。",
                            )
                            .with_resource(Some("scan_logs".to_string()), None),
                        );
                    }
                }
            }
        }
    }

    // 4. 低置信度事件占比过高
    let low_confidence: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM agent_resource_usage_events WHERE confidence = 'low'",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;
    let total_events: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM agent_resource_usage_events",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let (Some((low,)), Some((total,))) = (low_confidence, total_events) {
        if total > 10 && low * 3 > total {
            checked += 1;
            let pct = low * 100 / total;
            issues.push(
                HealthIssue::new(
                    "info", "Analytics", "analytics",
                    "低置信度事件占比过高",
                    format!("low confidence events: {low}/{total} ({pct}%)"),
                    "检查日志适配器配置，提升解析准确度。",
                )
                .with_resource(Some("agent_resource_usage_events".to_string()), None)
                .with_evidence(format!("low={low}, total={total}, pct={pct}%")),
            );
        }
    }

    // 5. event_hash 重复
    let dup_hash: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM (SELECT event_hash FROM agent_resource_usage_events \
         GROUP BY event_hash HAVING COUNT(*) > 1)",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((n,)) = dup_hash {
        if n > 0 {
            checked += 1;
            issues.push(
                HealthIssue::new(
                    "error", "Analytics", "analytics",
                    "event_hash 重复",
                    format!("发现 {n} 个重复的 event_hash。"),
                    "检查日志去重逻辑，清理重复事件。",
                )
                .with_resource(Some("agent_resource_usage_events".to_string()), None),
            );
        }
    }

    // 6. event_time 为空或非法
    let bad_time: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM agent_resource_usage_events \
         WHERE event_time IS NULL OR event_time = ''",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((n,)) = bad_time {
        if n > 0 {
            checked += 1;
            issues.push(
                HealthIssue::new(
                    "warning", "Analytics", "analytics",
                    "存在无时间戳的使用事件",
                    format!("{n} 条事件缺少 event_time。"),
                    "检查日志解析逻辑，确保提取事件时间。",
                )
                .with_resource(Some("agent_resource_usage_events".to_string()), None),
            );
        }
    }

    // 7. resource_type 不在合法范围
    let bad_type: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM agent_resource_usage_events \
         WHERE resource_type NOT IN ('skill', 'mcp_server', 'mcp_tool', 'agent')",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((n,)) = bad_type {
        if n > 0 {
            checked += 1;
            issues.push(
                HealthIssue::new(
                    "warning", "Analytics", "analytics",
                    "存在非法 resource_type 的使用事件",
                    format!("{n} 条事件的 resource_type 不在合法范围内。"),
                    "检查日志适配器，确保 resource_type 正确映射。",
                )
                .with_resource(Some("agent_resource_usage_events".to_string()), None),
            );
        }
    }

    Ok((checked, issues))
}
