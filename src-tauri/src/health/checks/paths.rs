// Path Health 检查 — Memory / Knowledge / Project
// 复用深度路径检查逻辑

use super::super::types::HealthIssue;
use sqlx::{Row, SqlitePool};
use std::path::Path;

/// 通用路径检查
pub async fn check(pool: &SqlitePool) -> Result<(usize, Vec<HealthIssue>), String> {
    let mut issues = Vec::new();
    let mut total = 0usize;

    let (n, mut mem_issues) = check_table(pool, "memory_sources", "Memory").await?;
    total += n;
    issues.append(&mut mem_issues);

    let (n, mut kb_issues) = check_table(pool, "knowledge_bases", "Knowledge").await?;
    total += n;
    issues.append(&mut kb_issues);

    let (n, mut proj_issues) = check_table(pool, "projects", "Project").await?;
    total += n;
    issues.append(&mut proj_issues);

    Ok((total, issues))
}

/// 对单个表做深度路径检查
async fn check_table(
    pool: &SqlitePool,
    table: &str,
    label: &str,
) -> Result<(usize, Vec<HealthIssue>), String> {
    // 表名是内部硬编码传入，非用户输入，安全使用动态 SQL
    let query = match table {
        "memory_sources" => "SELECT id, name, path FROM memory_sources",
        "knowledge_bases" => "SELECT id, name, path FROM knowledge_bases",
        "projects" => "SELECT id, name, path FROM projects",
        _ => return Err(format!("unsupported table: {table}")),
    };
    let rows = sqlx::query(query)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut issues = Vec::new();
    let total = rows.len();

    for row in rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let path: Option<String> = row.get("path");

        // 1. path 为空
        if path.as_deref().is_none_or(str::is_empty) {
            issues.push(
                HealthIssue::new(
                    "warning", label, "path",
                    format!("{label} 路径为空"),
                    format!("{label} '{name}' 没有 path。"),
                    "补充 path 字段。",
                )
                .with_resource(Some(name.clone()), None)
                .with_resource_id(label, &id),
            );
            continue;
        }

        let p = path.as_deref().unwrap();
        let dir = Path::new(p);

        // 2. path 不存在
        if !dir.exists() {
            issues.push(
                HealthIssue::new(
                    "error", label, "path",
                    format!("{label} 路径不存在"),
                    format!("路径不存在: {p}"),
                    "确认路径是否已移动；如已废弃则更新或移除索引。",
                )
                .with_resource(Some(name.clone()), Some(p.to_string()))
                .with_resource_id(label, &id),
            );
            continue;
        }

        // 3. path 存在但不是目录
        if !dir.is_dir() {
            issues.push(
                HealthIssue::new(
                    "warning", label, "path",
                    format!("{label} 路径不是目录"),
                    format!("path 指向的不是目录: {p}"),
                    "确认是否应指向文件而非目录。",
                )
                .with_resource(Some(name.clone()), Some(p.to_string()))
                .with_resource_id(label, &id),
            );
            continue;
        }

        // 4. 目录为空
        if let Ok(mut entries) = dir.read_dir() {
            if entries.next().is_none() {
                issues.push(
                    HealthIssue::new(
                        "warning", label, "path",
                        format!("{label} 目录为空"),
                        format!("路径存在但目录内没有文件: {p}"),
                        "确认资源是否已迁移，或补充内容。",
                    )
                    .with_resource(Some(name.clone()), Some(p.to_string()))
                    .with_resource_id(label, &id),
                );
            }
        }
    }

    Ok((total, issues))
}
