// MCP Health 检查 — 8 项（tools_json 列尚未存在于 DB，暂跳过）

use super::super::types::HealthIssue;
use sqlx::{Row, SqlitePool};
use std::path::Path;

pub async fn check(pool: &SqlitePool) -> Result<(usize, Vec<HealthIssue>), String> {
    // 注意: mcp_servers 表当前没有 tools_json 列，不查询该字段
    let rows = sqlx::query(
        "SELECT id, name, command, source_path, description, summary, \
         category, tags, status \
         FROM mcp_servers",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut issues = Vec::new();
    let total = rows.len();

    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let command: Option<String> = row.get("command");
        let source_path: Option<String> = row.get("source_path");
        let description: Option<String> = row.get("description");
        let _summary: Option<String> = row.get("summary");
        let category: Option<String> = row.get("category");
        let tags: Option<String> = row.get("tags");
        let status: Option<String> = row.get("status");

        // 1. status = error
        if status.as_deref() == Some("error") {
            issues.push(
                HealthIssue::new(
                    "error", "MCP", "status",
                    "MCP Server 状态异常",
                    "该 MCP Server 已被标记为 error。",
                    "检查配置文件、command、args 和环境变量。",
                )
                .with_resource(Some(name.clone()), source_path.clone())
                .with_resource_id("MCP", &id),
            );
        }

        // 2. command 为空
        if command.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "warning", "MCP", "path",
                    "MCP Server 缺少启动命令",
                    "该 MCP 记录没有 command。",
                    "重新扫描来源配置，或补充 command 字段。",
                )
                .with_resource(Some(name.clone()), source_path.clone())
                .with_resource_id("MCP", &id),
            );
        }

        // 3. command 是绝对路径但不存在
        if let Some(ref cmd) = command {
            if !cmd.is_empty() && cmd.starts_with('/') {
                let binary = cmd.split_whitespace().next().unwrap_or(cmd);
                if !Path::new(binary).exists() {
                    issues.push(
                        HealthIssue::new(
                            "error", "MCP", "path",
                            "MCP command 绝对路径不存在",
                            format!("command 指向的路径不存在: {binary}"),
                            "确认二进制路径或更新 command。",
                        )
                        .with_resource(Some(name.clone()), source_path.clone())
                        .with_resource_id("MCP", &id)
                        .with_evidence(format!("command={binary}")),
                    );
                }
            }
        }

        // 4. command 是短命令但 PATH 中找不到
        if let Some(ref cmd) = command {
            if !cmd.is_empty() && !cmd.starts_with('/') {
                let binary = cmd.split_whitespace().next().unwrap_or(cmd);
                if !command_in_path(binary) {
                    issues.push(
                        HealthIssue::new(
                            "warning", "MCP", "path",
                            "MCP command 在 PATH 中找不到",
                            format!("command '{binary}' 在当前 PATH 中未找到。"),
                            "确认依赖是否已安装，或使用绝对路径。",
                        )
                        .with_resource(Some(name.clone()), source_path.clone())
                        .with_resource_id("MCP", &id)
                        .with_evidence(format!("command={binary}")),
                    );
                }
            }
        }

        // 5. source_path 非空但不存在
        if let Some(ref sp) = source_path {
            if !sp.is_empty() && !Path::new(sp).exists() {
                issues.push(
                    HealthIssue::new(
                        "warning", "MCP", "path",
                        "MCP source_path 不存在",
                        format!("source_path 不存在: {sp}"),
                        "确认配置文件是否已移动。",
                    )
                    .with_resource(Some(name.clone()), Some(sp.clone()))
                    .with_resource_id("MCP", &id),
                );
            }
        }

        // 6. description 为空
        if description.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "warning", "MCP", "metadata",
                    "MCP 缺少 description",
                    "该 MCP Server 没有 description。",
                    "补充描述以改善检索和理解。",
                )
                .with_resource(Some(name.clone()), source_path.clone())
                .with_resource_id("MCP", &id),
            );
        }

        // 7. category 为空
        if category.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "info", "MCP", "metadata",
                    "MCP 缺少 category",
                    "该 MCP Server 没有分类信息。",
                    "设置 category 字段。",
                )
                .with_resource(Some(name.clone()), source_path.clone())
                .with_resource_id("MCP", &id),
            );
        }

        // 8. tags 为空
        if tags.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "info", "MCP", "metadata",
                    "MCP 缺少 tags",
                    "该 MCP Server 没有标签。",
                    "补充标签以改善筛选。",
                )
                .with_resource(Some(name.clone()), source_path.clone())
                .with_resource_id("MCP", &id),
            );
        }

        // TODO: tools_json 检查暂未实现 — 该列尚未在 DB schema 中创建
        // 等 migration 添加 tools_json 列后再恢复此项检查
    }

    Ok((total, issues))
}

/// 检查命令是否在 PATH 中可找到
fn command_in_path(binary: &str) -> bool {
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in path_var.split(':') {
            if Path::new(dir).join(binary).exists() {
                return true;
            }
        }
    }
    false
}
