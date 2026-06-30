// Agent Health 检查 — 12 项

use super::super::types::HealthIssue;
use chrono::{DateTime, Utc};
use sqlx::{Row, SqlitePool};
use std::path::Path;

/// 已知支持日志适配的 agent_key
const LOG_ADAPTER_KEYS: &[&str] = &["codex", "claude", "workbuddy", "newmax", "antigravity"];

pub async fn check(pool: &SqlitePool) -> Result<(usize, Vec<HealthIssue>), String> {
    let rows = sqlx::query(
        "SELECT id, name, agent_key, type, status, app_path, cli_path, config_path, \
         log_path, bundle_id, confidence, is_user_confirmed, is_ignored, last_detected_at \
         FROM agents",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut issues = Vec::new();
    let total = rows.len();

    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let agent_key: Option<String> = row.get("agent_key");
        let agent_type: Option<String> = row.get("type");
        let status: Option<String> = row.get("status");
        let app_path: Option<String> = row.get("app_path");
        let cli_path: Option<String> = row.get("cli_path");
        let config_path: Option<String> = row.get("config_path");
        let log_path: Option<String> = row.get("log_path");
        let bundle_id: Option<String> = row.get("bundle_id");
        let confidence: Option<String> = row.get("confidence");
        let is_user_confirmed: i64 = row.get("is_user_confirmed");
        let is_ignored: i64 = row.get("is_ignored");
        let last_detected_at: Option<String> = row.get("last_detected_at");

        // 0. ignored 跳过
        if is_ignored == 1 {
            continue;
        }

        let atype = agent_type.as_deref().unwrap_or("");

        // --- 路径类检查 ---

        // 1. App 类型 app_path 为空
        if atype == "App" && app_path.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "error", "Agent", "path",
                    "Agent App 路径为空",
                    "该 Agent 标记为 App 类型，但 app_path 缺失。",
                    "重新扫描 Applications，或手动更新 Agent App 路径。",
                )
                .with_resource(Some(name.clone()), app_path.clone())
                .with_resource_id("Agent", &id),
            );
        }

        // 2. App 类型 app_path 不存在
        if atype == "App" {
            if let Some(ref ap) = app_path {
                if !ap.is_empty() && !Path::new(ap).exists() {
                    issues.push(
                        HealthIssue::new(
                            "error", "Agent", "path",
                            "Agent App 路径不存在",
                            format!("app_path 指向的路径不存在: {ap}"),
                            "确认应用是否已卸载或移动，重新扫描或更新路径。",
                        )
                        .with_resource(Some(name.clone()), Some(ap.clone()))
                        .with_resource_id("Agent", &id),
                    );
                }
            }
        }

        // 3. App 类型 app_path 存在但不是 .app
        if atype == "App" {
            if let Some(ref ap) = app_path {
                if Path::new(ap).exists() && !ap.ends_with(".app") {
                    issues.push(
                        HealthIssue::new(
                            "warning", "Agent", "path",
                            "Agent App 路径不是 .app",
                            format!("app_path 存在但不是标准 macOS .app 包: {ap}"),
                            "确认路径是否指向正确的应用包。",
                        )
                        .with_resource(Some(name.clone()), Some(ap.clone()))
                        .with_resource_id("Agent", &id),
                    );
                }
            }
        }

        // 4. CLI 类型 cli_path 为空
        if atype == "CLI" && cli_path.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "warning", "Agent", "path",
                    "Agent CLI 路径为空",
                    "该 Agent 标记为 CLI 类型，但 cli_path 缺失。",
                    "确认 CLI 二进制路径，补充 cli_path 字段。",
                )
                .with_resource(Some(name.clone()), cli_path.clone())
                .with_resource_id("Agent", &id),
            );
        }

        // 5. CLI 类型 cli_path 不存在
        if atype == "CLI" {
            if let Some(ref cp) = cli_path {
                if !cp.is_empty() && !Path::new(cp).exists() {
                    issues.push(
                        HealthIssue::new(
                            "error", "Agent", "path",
                            "Agent CLI 路径不存在",
                            format!("cli_path 指向的路径不存在: {cp}"),
                            "确认 CLI 工具是否已安装或路径已变更。",
                        )
                        .with_resource(Some(name.clone()), Some(cp.clone()))
                        .with_resource_id("Agent", &id),
                    );
                }
            }
        }

        // 6. CLI 类型 cli_path 存在但不可执行
        if atype == "CLI" {
            if let Some(ref cp) = cli_path {
                let p = Path::new(cp);
                if p.exists() && !is_executable(p) {
                    issues.push(
                        HealthIssue::new(
                            "warning", "Agent", "path",
                            "Agent CLI 不可执行",
                            format!("cli_path 存在但没有执行权限: {cp}"),
                            "通过 chmod +x 或重新安装 CLI 工具修复。",
                        )
                        .with_resource(Some(name.clone()), Some(cp.clone()))
                        .with_resource_id("Agent", &id),
                    );
                }
            }
        }

        // 7. config_path 非空但不存在
        if let Some(ref cp) = config_path {
            if !cp.is_empty() && !Path::new(cp).exists() {
                issues.push(
                    HealthIssue::new(
                        "warning", "Agent", "path",
                        "Agent 配置目录不可访问",
                        format!("config_path 不存在: {cp}"),
                        "重新扫描 Agent 配置目录，或移除失效索引。",
                    )
                    .with_resource(Some(name.clone()), Some(cp.clone()))
                    .with_resource_id("Agent", &id),
                );
            }
        }

        // 8. log_path 非空但不存在
        if let Some(ref lp) = log_path {
            if !lp.is_empty() && !Path::new(lp).exists() {
                issues.push(
                    HealthIssue::new(
                        "warning", "Agent", "path",
                        "Agent 日志路径不存在",
                        format!("log_path 不存在: {lp}"),
                        "确认日志目录是否已变更，或清理失效引用。",
                    )
                    .with_resource(Some(name.clone()), Some(lp.clone()))
                    .with_resource_id("Agent", &id),
                );
            }
        }

        // --- 状态类检查 ---

        // 9. status = broken / error
        if matches!(status.as_deref(), Some("broken") | Some("error")) {
            issues.push(
                HealthIssue::new(
                    "error", "Agent", "status",
                    "Agent 状态异常",
                    format!("Agent status = {}，需要诊断。", status.as_deref().unwrap_or("?")),
                    "检查 Agent 路径、配置和依赖，修复后重新扫描确认。",
                )
                .with_resource(Some(name.clone()), app_path.clone())
                .with_resource_id("Agent", &id),
            );
        }

        // --- 日志适配检查 ---

        // 10. 支持日志适配但 log_path 为空
        let supports_log = agent_key
            .as_deref()
            .map(|k| LOG_ADAPTER_KEYS.contains(&k.to_lowercase().as_str()))
            .unwrap_or(false);
        if supports_log && log_path.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "info", "Agent", "metadata",
                    "Agent 支持日志但缺少 log_path",
                    format!("{} 已知支持日志适配，但 log_path 为空。", agent_key.as_deref().unwrap_or("?")),
                    "补充 log_path 以启用使用统计和分析功能。",
                )
                .with_resource(Some(name.clone()), None)
                .with_resource_id("Agent", &id),
            );
        }

        // --- 置信度检查 ---

        // 11. confidence = candidate 且未确认
        if confidence.as_deref() == Some("candidate") && is_user_confirmed == 0 {
            issues.push(
                HealthIssue::new(
                    "warning", "Agent", "status",
                    "Agent 待确认 (candidate)",
                    "该 Agent 识别置信度为 candidate，尚未经用户确认。",
                    "在 Agents 页面确认或忽略该 Agent。",
                )
                .with_resource(Some(name.clone()), app_path.clone())
                .with_resource_id("Agent", &id),
            );
        } else if confidence.as_deref() == Some("probable") && is_user_confirmed == 0 {
            issues.push(
                HealthIssue::new(
                    "info", "Agent", "status",
                    "Agent 待确认 (probable)",
                    "该 Agent 识别置信度为 probable，尚未经用户确认。",
                    "在 Agents 页面确认或忽略该 Agent。",
                )
                .with_resource(Some(name.clone()), app_path.clone())
                .with_resource_id("Agent", &id),
            );
        }

        // --- 元数据检查 ---

        // 12. App 类型 bundle_id 为空
        if atype == "App" && bundle_id.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "info", "Agent", "metadata",
                    "Agent 缺少 bundle_id",
                    "App 类型 Agent 未记录 bundle_id，可能影响精确识别。",
                    "通过重新扫描补充 bundle_id。",
                )
                .with_resource(Some(name.clone()), app_path.clone())
                .with_resource_id("Agent", &id),
            );
        }

        // 13. last_detected_at 超过 30 天
        if let Some(ref ldt) = last_detected_at {
            if let Ok(dt) = DateTime::parse_from_rfc3339(ldt) {
                let age = Utc::now().signed_duration_since(dt.with_timezone(&Utc));
                if age.num_days() > 30 {
                    issues.push(
                        HealthIssue::new(
                            "info", "Agent", "metadata",
                            "Agent 检测时间过旧",
                            format!("last_detected_at 距今已超过 30 天 ({}天)。", age.num_days()),
                            "重新执行 Agent 扫描以刷新检测状态。",
                        )
                        .with_resource(Some(name.clone()), None)
                        .with_resource_id("Agent", &id),
                    );
                }
            }
        }
    }

    Ok((total, issues))
}

/// 检查路径是否可执行
fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = path.metadata() {
            return meta.permissions().mode() & 0o111 != 0;
        }
        false
    }
    #[cfg(not(unix))]
    {
        path.exists()
    }
}
