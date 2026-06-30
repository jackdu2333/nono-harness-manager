// Skill Health 检查 — 13 项

use super::super::types::HealthIssue;
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use std::path::Path;
pub async fn check(pool: &SqlitePool) -> Result<(usize, Vec<HealthIssue>), String> {
    let rows = sqlx::query(
        "SELECT id, name, path, description, summary, category, tags, \
         source_id, status, is_archived, needs_review, needs_improvement \
         FROM skills",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut issues = Vec::new();
    let total = rows.len();

    // 收集重复路径
    let mut path_count: HashMap<String, usize> = HashMap::new();

    for row in &rows {
        let path: String = row.get("path");
        *path_count.entry(path.clone()).or_default() += 1;
    }

    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let path: String = row.get("path");
        let description: Option<String> = row.get("description");
        let summary: Option<String> = row.get("summary");
        let category: Option<String> = row.get("category");
        let tags: Option<String> = row.get("tags");
        let source_id: Option<String> = row.get("source_id");
        let status: String = row.get("status");
        let is_archived: i64 = row.get("is_archived");
        let needs_review: i64 = row.get("needs_review");
        let needs_improvement: i64 = row.get("needs_improvement");

        let p = Path::new(&path);

        // 1. path 不存在
        if !p.exists() {
            issues.push(
                HealthIssue::new(
                    "error",
                    "Skill",
                    "path",
                    "Skill 入口路径不存在",
                    format!("索引中的路径已移动或删除: {path}"),
                    "重新扫描技能库，或删除失效索引。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 2. path 存在但不是文件（可能预期是文件）
        if p.exists() && !p.is_file() {
            issues.push(
                HealthIssue::new(
                    "warning",
                    "Skill",
                    "path",
                    "Skill 路径不是文件",
                    format!("path 指向的不是文件（可能是目录）: {path}"),
                    "确认 entry_file 配置是否正确。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 3. status = broken
        if status == "broken" {
            issues.push(
                HealthIssue::new(
                    "error",
                    "Skill",
                    "status",
                    "Skill 状态为 broken",
                    "该 Skill 已标记为 broken。",
                    "检查 SKILL.md 或入口文件，修复后清除标记。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 4. needs_review
        if needs_review == 1 {
            issues.push(
                HealthIssue::new(
                    "warning",
                    "Skill",
                    "status",
                    "Skill 待复核",
                    "needs_review = 1，该 Skill 需要人工复核。",
                    "在 Skills 页面查看复核备注并完成整理。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 5. needs_improvement
        if needs_improvement == 1 {
            issues.push(
                HealthIssue::new(
                    "warning",
                    "Skill",
                    "status",
                    "Skill 待改进",
                    "needs_improvement = 1，该 Skill 需要改进。",
                    "在 Skills 页面查看改进备注并完成整理。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 6. description 为空
        if description.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "warning",
                    "Skill",
                    "metadata",
                    "Skill 缺少 description",
                    "该 Skill 没有 description，影响搜索和 AI 分析。",
                    "补充 description 或通过 AI 分析自动生成。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 7. summary 为空
        if summary.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "info",
                    "Skill",
                    "metadata",
                    "Skill 缺少 summary",
                    "该 Skill 没有 summary。",
                    "通过 AI 分析生成或手动补充摘要。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 8. category 为空
        if category.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "info",
                    "Skill",
                    "metadata",
                    "Skill 缺少 category",
                    "该 Skill 没有分类信息。",
                    "手动设置或通过 AI 分析推断分类。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 9. tags 为空
        if tags.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "info",
                    "Skill",
                    "metadata",
                    "Skill 缺少 tags",
                    "该 Skill 没有标签。",
                    "补充标签以改善筛选和检索。",
                )
                .with_resource(Some(name.clone()), Some(path.clone()))
                .with_resource_id("Skill", &id),
            );
        }

        // 10. source_id 悬空引用
        if let Some(ref sid) = source_id {
            if !sid.is_empty() {
                let exists: Option<(i64,)> =
                    sqlx::query_as("SELECT COUNT(*) FROM skill_sources WHERE id = ?")
                        .bind(sid)
                        .fetch_optional(pool)
                        .await
                        .map_err(|e| e.to_string())?;
                if matches!(exists, Some((0,))) {
                    issues.push(
                        HealthIssue::new(
                            "error",
                            "Skill",
                            "index",
                            "Skill source_id 悬空引用",
                            format!("source_id = {sid} 在 skill_sources 中不存在。"),
                            "修正 source_id 或清除失效引用。",
                        )
                        .with_resource(Some(name.clone()), Some(path.clone()))
                        .with_resource_id("Skill", &id)
                        .with_evidence(&format!("source_id={sid}")),
                    );
                }
            }
        }

        // 11. 重复路径
        if let Some(&count) = path_count.get(&path) {
            if count > 1 {
                issues.push(
                    HealthIssue::new(
                        "warning",
                        "Skill",
                        "index",
                        "Skill 路径重复",
                        format!("路径被 {count} 个 Skill 记录引用: {path}"),
                        "清理重复索引，保留唯一记录。",
                    )
                    .with_resource(Some(name.clone()), Some(path.clone()))
                    .with_resource_id("Skill", &id),
                );
            }
        }

        // 12. archived 但有近期使用
        if is_archived == 1 {
            let recent_count: Option<(i64,)> = sqlx::query_as(
                "SELECT COUNT(*) FROM agent_resource_usage_events \
                 WHERE resource_id = ? AND event_time > datetime('now', '-30 days')",
            )
            .bind(&id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
            if let Some((n,)) = recent_count {
                if n > 0 {
                    issues.push(
                        HealthIssue::new(
                            "warning",
                            "Skill",
                            "status",
                            "归档 Skill 仍有近期使用",
                            format!("is_archived = 1，但近 30 天有 {n} 条使用记录。"),
                            "确认是否应取消归档，或更新使用方不再引用。",
                        )
                        .with_resource(Some(name.clone()), Some(path.clone()))
                        .with_resource_id("Skill", &id),
                    );
                }
            }
        }

        // 13. 空模板检测（文件 < 50 bytes）
        if p.exists() && p.is_file() {
            if let Ok(meta) = p.metadata() {
                if meta.len() < 50 {
                    issues.push(
                        HealthIssue::new(
                            "info",
                            "Skill",
                            "metadata",
                            "Skill 文件可能是空模板",
                            format!("入口文件仅 {} bytes，疑似空模板。", meta.len()),
                            "填充内容或移除空模板 Skill。",
                        )
                        .with_resource(Some(name.clone()), Some(path.clone()))
                        .with_resource_id("Skill", &id),
                    );
                }
            }
        }
    }

    Ok((total, issues))
}
