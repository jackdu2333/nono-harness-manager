use crate::db::repositories::{skill_repository, source_repository};
use crate::models::skill::Skill;
use crate::models::source::SkillSource;
use crate::scanner::skill_scanner::scan_directory;
use crate::security::path_guard::{validate_scan_root, validate_delete_target, is_skill_directory};
use chrono::Utc;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use tauri::{command, State};
use uuid::Uuid;

#[command]
pub async fn list_skill_sources(pool: State<'_, SqlitePool>) -> Result<Vec<SkillSource>, String> {
    source_repository::list_sources(&*pool)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn add_skill_source(
    name: String,
    path: String,
    source_type: Option<String>,
    scan_depth: i64,
    pool: State<'_, SqlitePool>,
) -> Result<SkillSource, String> {
    let now = Utc::now().to_rfc3339();

    let expanded_path = validate_scan_root(&path)?.to_string_lossy().to_string();

    // Check if a source with this path already exists
    let existing_sources = source_repository::list_sources(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(mut existing) = existing_sources
        .into_iter()
        .find(|s| s.path == expanded_path)
    {
        existing.name = name;
        existing.source_type = source_type;
        existing.scan_depth = scan_depth;
        existing.updated_at = Utc::now().to_rfc3339();
        source_repository::update_source(&*pool, &existing)
            .await
            .map_err(|e| e.to_string())?;
        return Ok(existing);
    }

    let source = SkillSource {
        id: Uuid::new_v4().to_string(),
        name,
        path: expanded_path,
        source_type,
        enabled: 1,
        scan_depth,
        last_scanned_at: None,
        created_at: now.clone(),
        updated_at: now,
    };
    source_repository::add_source(&*pool, &source)
        .await
        .map_err(|e| e.to_string())?;
    Ok(source)
}

#[command]
pub async fn delete_skill_source(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    source_repository::delete_source(&*pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn scan_skill_source(id: String, pool: State<'_, SqlitePool>) -> Result<usize, String> {
    log::info!("Scanning skill source: {}", id);
    let sources = source_repository::list_sources(&*pool).await.map_err(|e| {
        log::error!("Failed to list sources: {}", e);
        e.to_string()
    })?;
    let source = sources.into_iter().find(|s| s.id == id).ok_or_else(|| {
        log::error!("Source not found: {}", id);
        "Source not found".to_string()
    })?;
    validate_scan_root(&source.path)?;

    log::info!("Found source to scan: {:?}", source);
    let skills = scan_directory(&source);
    let count = skills.len();
    log::info!("Discovered {} skills", count);

    for skill in skills {
        if let Err(e) = skill_repository::insert_skill(&*pool, &skill).await {
            log::error!("Failed to insert skill {}: {}", skill.name, e);
            return Err(e.to_string());
        }
    }

    log::info!("Successfully inserted {} skills", count);
    Ok(count)
}

#[command]
pub async fn list_skills(pool: State<'_, SqlitePool>) -> Result<Vec<Skill>, String> {
    skill_repository::list_skills(&*pool)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn generate_skill_description(_skill_id: String) -> Result<String, String> {
    // Placeholder for future AI feature
    Ok("AI 描述生成尚未启用".to_string())
}

#[command]
pub async fn update_skill_description(
    skill_id: String,
    description: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query(
        r#"
        UPDATE skills SET
            description = ?, description_source = 'manual', description_confidence = 'high', 
            description_is_manual = 1, description_updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&description)
    .bind(Utc::now().to_rfc3339())
    .bind(&skill_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ===== Curation & lifecycle commands (migration 0007) =====
// 需求 §四/§五/§六：状态体系 + 整理动作 + 进化字段

#[command]
pub async fn set_skill_category(
    skill_id: String,
    category: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE skills SET category = ?, updated_at = ? WHERE id = ?")
        .bind(&category)
        .bind(Utc::now().to_rfc3339())
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Lifecycle status — single-choice among draft/active/deprecated/broken.
/// favorite/review/improvement/archived/duplicate are orthogonal tags handled
/// by their own commands below (§四).
#[command]
pub async fn set_skill_status(
    skill_id: String,
    status: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    const ALLOWED: &[&str] = &["draft", "active", "deprecated", "broken"];
    if !ALLOWED.contains(&status.as_str()) {
        return Err(format!("invalid lifecycle status: {}", status));
    }
    sqlx::query("UPDATE skills SET status = ?, updated_at = ? WHERE id = ?")
        .bind(&status)
        .bind(Utc::now().to_rfc3339())
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn toggle_favorite(
    skill_id: String,
    value: bool,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE skills SET is_favorite = ?, updated_at = ? WHERE id = ?")
        .bind(value as i64)
        .bind(Utc::now().to_rfc3339())
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn toggle_needs_review(
    skill_id: String,
    value: bool,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE skills SET needs_review = ?, updated_at = ? WHERE id = ?")
        .bind(value as i64)
        .bind(Utc::now().to_rfc3339())
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn toggle_needs_improvement(
    skill_id: String,
    value: bool,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE skills SET needs_improvement = ?, updated_at = ? WHERE id = ?")
        .bind(value as i64)
        .bind(Utc::now().to_rfc3339())
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn archive_skill(
    skill_id: String,
    archived: bool,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE skills SET is_archived = ?, updated_at = ? WHERE id = ?")
        .bind(archived as i64)
        .bind(Utc::now().to_rfc3339())
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a skill from the Harness index only. NEVER touches the local file.
/// 需求 §五 / 验收 7：删索引不删本地文件
#[command]
pub async fn delete_skill_index(
    skill_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM skills WHERE id = ?")
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Improvement note + status (e.g. planned / in_progress / done) + last-improved timestamp.
/// 需求 §六
#[command]
pub async fn update_improvement_note(
    skill_id: String,
    note: Option<String>,
    status: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE skills SET improvement_note = ?, improvement_status = ?, last_improved_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&note)
    .bind(&status)
    .bind(&now)
    .bind(&now)
    .bind(&skill_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn update_review_note(
    skill_id: String,
    note: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE skills SET review_note = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&note)
    .bind(&now)
    .bind(&now)
    .bind(&skill_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Persist a duplicate-group id computed by the frontend detector.
/// 需求 §七：只标记"疑似重复"，不自动合并。
#[command]
pub async fn mark_duplicate(
    skill_id: String,
    group_id: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE skills SET duplicate_group_id = ?, updated_at = ? WHERE id = ?")
        .bind(&group_id)
        .bind(Utc::now().to_rfc3339())
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Record a Harness-panel action against a skill (open detail / copy path /
/// edit description / set status / archive ...). Source is pinned to
/// "harness_panel" — this is a panel-operation count, NOT a Codex invocation
/// count. 需求 §八 / 验收 8.
#[command]
pub async fn record_skill_usage(
    skill_id: String,
    action: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    // §六 action 命名契约：保持稳定，为 Analytics 统计打基础。
    // 不在白名单的 action 仍记录，但打 warn 以暴露命名漂移。
    const PANEL_ACTIONS: &[&str] = &[
        "view_detail", "copy_path", "open_dir", "copy_ref",
        "edit_description", "set_category", "set_status", "archive", "delete_index",
        "remove_index", "delete_source_file", "move_source_to_trash",
        "toggle_favorite", "toggle_needs_review", "toggle_needs_improvement",
        "update_improvement_note", "update_review_note",
    ];
    if !PANEL_ACTIONS.contains(&action.as_str()) {
        return Err(format!(
            "unknown panel action '{}': allowed actions are {:?}",
            action, PANEL_ACTIONS
        ));
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"
        INSERT INTO resource_usage_events
            (id, resource_type, resource_id, action, source, created_at)
        VALUES (?, 'skill', ?, ?, 'harness_panel', ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&skill_id)
    .bind(&action)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    // Keep skills.total_usage_count in sync as the panel-action counter.
    sqlx::query(
        "UPDATE skills SET total_usage_count = total_usage_count + 1, last_used_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(&now)
    .bind(&skill_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ===== Skill source file deletion (子需求 skill删除需求.md) =====

/// Delete the local source file or directory for a Skill, then remove the
/// Harness index. 子需求 §四 / §三.
///
/// mode: "trash" (move to Trash) or "permanent" (rm -rf / unlink).
/// First phase implements "permanent" with clear UI; trash is preferred but
/// requires platform APIs — implemented if available, falls back to permanent.
///
/// Safety: uses validate_delete_target with all authorized skill_source paths.
/// If file deletion fails, the index is NOT removed. 子需求 §八.5.
#[derive(serde::Serialize)]
pub struct DeleteSourceResult {
    pub deleted_path: String,
    pub deleted_type: String, // "file" or "directory"
    pub mode: String,
    pub index_removed: bool,
}

#[command]
pub async fn delete_skill_source_file(
    skill_id: String,
    mode: String,
    pool: State<'_, SqlitePool>,
) -> Result<DeleteSourceResult, String> {
    if mode != "trash" && mode != "permanent" {
        return Err(format!("unsupported delete mode: {mode} (expected 'trash' or 'permanent')"));
    }

    // Fetch skill to get its path.
    let skills = skill_repository::list_skills(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    let skill = skills
        .into_iter()
        .find(|s| s.id == skill_id)
        .ok_or("Skill not found")?;

    // Fetch all authorized source roots.
    let sources = source_repository::list_sources(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    let authorized_roots: Vec<String> = sources
        .iter()
        .filter(|s| s.enabled == 1)
        .map(|s| s.path.clone())
        .collect();

    // Determine deletion target: prefer the Skill directory, fall back to entry_file.
    let skill_path = PathBuf::from(&skill.path);
    let target = determine_delete_target(&skill_path)?;
    let target_str = target.to_string_lossy().to_string();

    // Strict validation — rejects symlinks, sensitive dirs, unauthorized paths.
    let validated = validate_delete_target(&target_str, &authorized_roots)?;

    let deleted_type = if validated.is_dir() { "directory" } else { "file" };

    // Perform deletion.
    perform_delete(&validated, &mode)?;

    // Record usage BEFORE removing the index row. 子需求 §六/§八.10
    let action = if mode == "trash" { "move_source_to_trash" } else { "delete_source_file" };
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"
        INSERT INTO resource_usage_events
            (id, resource_type, resource_id, action, source, created_at)
        VALUES (?, 'skill', ?, ?, 'harness_panel', ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&skill_id)
    .bind(action)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    // Remove the index only after successful file deletion. 子需求 §八.4/§八.5
    sqlx::query("DELETE FROM skills WHERE id = ?")
        .bind(&skill_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(DeleteSourceResult {
        deleted_path: validated.to_string_lossy().to_string(),
        deleted_type: deleted_type.to_string(),
        mode: if mode == "trash" { "trash".to_string() } else { "permanent".to_string() },
        index_removed: true,
    })
}

/// Determine what to delete: if the skill's parent dir is a standard Skill
/// directory, delete the whole directory. Otherwise delete only the entry
/// file. 子需求 §二.
fn determine_delete_target(skill_path: &Path) -> Result<PathBuf, String> {
    // If the path itself is a directory (e.g. a skill folder), check it.
    if skill_path.is_dir() {
        if is_skill_directory(skill_path) {
            return Ok(skill_path.to_path_buf());
        }
        return Err("目标是目录但不是标准 Skill 目录，拒绝整目录删除".to_string());
    }

    // It's a file — check if parent is a Skill directory.
    if let Some(parent) = skill_path.parent() {
        if is_skill_directory(parent) {
            // Prefer deleting the whole Skill directory.
            return Ok(parent.to_path_buf());
        }
    }

    // Fall back to the entry file itself.
    Ok(skill_path.to_path_buf())
}

/// Perform the actual deletion. trash mode tries macOS Trash via NSWorkspace,
/// falling back to permanent if unavailable.
fn perform_delete(path: &Path, mode: &str) -> Result<(), String> {
    if mode == "trash" {
        // Try macOS Trash via AppleScript (move to Finder Trash).
        let script = format!(
            "tell application \"Finder\" to delete (POSIX file \"{}\" as alias)",
            path.to_string_lossy()
        );
        let result = std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match result {
            Ok(output) if output.status.success() => return Ok(()),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log::warn!("Trash via AppleScript failed ({}), falling back to permanent", stderr.trim());
            }
            Err(e) => {
                log::warn!("osascript unavailable ({}), falling back to permanent", e);
            }
        }
    }

    // Permanent deletion.
    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|e| format!("删除目录失败: {}", e))
    } else {
        std::fs::remove_file(path).map_err(|e| format!("删除文件失败: {}", e))
    }
}
