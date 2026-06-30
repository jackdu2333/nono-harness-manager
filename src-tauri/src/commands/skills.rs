use crate::db::repositories::{skill_repository, source_repository};
use crate::models::skill::Skill;
use crate::models::source::SkillSource;
use crate::scanner::skill_scanner::scan_directory;
use crate::security::path_guard::{is_skill_directory, validate_delete_target, validate_scan_root};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tauri::{command, State};
use uuid::Uuid;

const SUPPORTED_AGENT_CLIENTS: &[&str] = &[
    "Codex",
    "Claude Code",
    "WorkBuddy",
    "Newmax",
    "Antigravity",
    "Generic Agent",
    "Human Reference Only",
    "Unknown",
];
const SCENARIOS: &[&str] = &[
    "工程开发",
    "代码审查",
    "项目初始化",
    "文档办公",
    "数据分析",
    "知识管理",
    "Agent 元能力",
    "本地自动化",
    "视觉设计",
    "发布营销",
    "其他",
];
const PLACEHOLDER_MARKERS: &[&str] = &[
    "todo",
    "tbd",
    "your skill",
    "placeholder",
    "lorem",
    "暂无描述",
    "系统推测",
];
const WEAK_NAME_WORDS: &[&str] = &[
    "生成", "整理", "工具", "脚本", "助手", "模板", "skill", "技能", "the", "a", "an",
];

#[derive(Debug, Deserialize)]
pub struct SkillAnalysisFilters {
    #[serde(default)]
    pub source_ids: Vec<String>,
    #[serde(default)]
    pub agent_clients: Vec<String>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub statuses: Vec<String>,
    #[serde(default)]
    pub ai_ready_statuses: Vec<String>,
    pub time_range: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillAnalysisOverview {
    pub generated_at: String,
    pub summary: SkillAnalysisSummary,
    pub skills: Vec<SkillAnalysisItem>,
    pub usage_rankings: SkillUsageRankings,
    pub quadrants: SkillQuadrants,
    pub quality_issues: Vec<SkillQualityIssueGroup>,
    pub duplicate_groups: Vec<SkillDuplicateGroup>,
    pub agent_fit_matrix: AgentSkillFitMatrix,
    pub scenario_coverage: Vec<ScenarioCoverageGroup>,
    pub recommendations: SkillAnalysisRecommendations,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillAnalysisSummary {
    pub total_skills: usize,
    pub ai_ready: usize,
    pub needs_review: usize,
    pub needs_improvement: usize,
    pub suspected_duplicates: usize,
    pub dormant: usize,
    pub broken: usize,
    pub average_health_score: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillAnalysisItem {
    pub skill_id: String,
    pub name: String,
    pub path: String,
    pub source_id: Option<String>,
    pub source_name: Option<String>,
    pub category: Option<String>,
    pub status: String,
    pub health_score: i64,
    pub health_status: String,
    pub ai_ready_status: String,
    pub usage_7d: i64,
    pub usage_30d: i64,
    pub usage_all_time: i64,
    pub last_observed_used_at: Option<String>,
    pub agent_client_count: i64,
    pub primary_agent_client: Option<String>,
    pub agent_usage_distribution: Vec<AgentUsageCount>,
    pub usage_kind_distribution: Vec<UsageKindCount>,
    pub value_group: String,
    pub scenario: String,
    pub quality_flags: Vec<String>,
    pub compatible_agents: Vec<String>,
    pub content_excerpt_chars: usize,
    pub template_residue: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct UsageKindCount {
    pub usage_kind: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct AgentUsageCount {
    pub agent_client: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillUsageRankings {
    pub last_7_days: Vec<SkillUsageRankItem>,
    pub last_30_days: Vec<SkillUsageRankItem>,
    pub all_time: Vec<SkillUsageRankItem>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillUsageRankItem {
    pub skill_id: String,
    pub name: String,
    pub count: i64,
    pub health_score: i64,
    pub ai_ready_status: String,
    pub primary_agent_client: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillQuadrants {
    pub core_assets: Vec<SkillQuadrantItem>,
    pub priority_improvements: Vec<SkillQuadrantItem>,
    pub potential_assets: Vec<SkillQuadrantItem>,
    pub cleanup_candidates: Vec<SkillQuadrantItem>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillQuadrantItem {
    pub skill_id: String,
    pub name: String,
    pub health_score: i64,
    pub usage_30d: i64,
    pub usage_all_time: i64,
    pub reasons: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillQualityIssueGroup {
    pub issue_key: String,
    pub label: String,
    pub count: usize,
    pub skill_ids: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillDuplicateGroup {
    pub group_id: String,
    pub group_type: String,
    pub confidence: String,
    pub primary_candidate_id: Option<String>,
    pub archive_candidate_ids: Vec<String>,
    pub skills: Vec<SkillDuplicateMember>,
    pub reasons: Vec<String>,
    pub suggested_action: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillDuplicateMember {
    pub skill_id: String,
    pub name: String,
    pub health_score: i64,
    pub usage_30d: i64,
    pub usage_all_time: i64,
    pub path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct AgentSkillFitMatrix {
    pub agents: Vec<String>,
    pub fits: Vec<AgentSkillFit>,
}

#[derive(Debug, Serialize, Clone)]
pub struct AgentSkillFit {
    pub skill_id: String,
    pub agent_client: String,
    pub fit_level: String,
    pub reasons: Vec<String>,
    pub observed_usage_count: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct ScenarioCoverageGroup {
    pub scenario: String,
    pub skill_count: usize,
    pub ai_ready_count: usize,
    pub broken_count: usize,
    pub usage_30d: i64,
    pub average_health_score: i64,
    pub signals: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillAnalysisRecommendations {
    pub optimize_top: Vec<SkillRecommendationItem>,
    pub archive_top: Vec<SkillRecommendationItem>,
    pub missing_description_top: Vec<SkillRecommendationItem>,
    pub missing_example_top: Vec<SkillRecommendationItem>,
    pub missing_boundary_top: Vec<SkillRecommendationItem>,
    pub codex_analysis_top: Vec<SkillRecommendationItem>,
    pub merge_groups: Vec<SkillDuplicateGroup>,
    pub agent_binding_top: Vec<AgentBindingRecommendation>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillRecommendationItem {
    pub skill_id: String,
    pub name: String,
    pub reason: String,
    pub health_score: i64,
    pub usage_30d: i64,
    pub usage_all_time: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct AgentBindingRecommendation {
    pub skill_id: String,
    pub name: String,
    pub agent_client: String,
    pub reason: String,
}

#[derive(Debug, Clone)]
struct SkillUsageStats {
    usage_7d: i64,
    usage_30d: i64,
    usage_all_time: i64,
    last_used_at: Option<String>,
    agent_counts: HashMap<String, i64>,
    usage_kind_counts: HashMap<String, i64>,
}

impl SkillUsageStats {
    fn new() -> Self {
        Self {
            usage_7d: 0,
            usage_30d: 0,
            usage_all_time: 0,
            last_used_at: None,
            agent_counts: HashMap::new(),
            usage_kind_counts: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
struct SkillContentSignals {
    excerpt: String,
    chars: usize,
    has_safe_file: bool,
    entry_exists: bool,
    has_input_output: bool,
    has_example: bool,
    has_boundary: bool,
    template_residue: bool,
    content_too_short: bool,
    path_exists: bool,
}

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
pub async fn get_skill_analysis_overview(
    filters: Option<SkillAnalysisFilters>,
    pool: State<'_, SqlitePool>,
) -> Result<SkillAnalysisOverview, String> {
    build_skill_analysis_overview(&pool, filters.unwrap_or_else(default_analysis_filters)).await
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
    sqlx::query("UPDATE skills SET review_note = ?, reviewed_at = ?, updated_at = ? WHERE id = ?")
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
        "view_detail",
        "copy_path",
        "open_dir",
        "copy_ref",
        "edit_description",
        "set_category",
        "set_status",
        "archive",
        "delete_index",
        "remove_index",
        "delete_source_file",
        "move_source_to_trash",
        "toggle_favorite",
        "toggle_needs_review",
        "toggle_needs_improvement",
        "update_improvement_note",
        "update_review_note",
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
        return Err(format!(
            "unsupported delete mode: {mode} (expected 'trash' or 'permanent')"
        ));
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

    let deleted_type = if validated.is_dir() {
        "directory"
    } else {
        "file"
    };

    // Perform deletion.
    perform_delete(&validated, &mode)?;

    // Record usage BEFORE removing the index row. 子需求 §六/§八.10
    let action = if mode == "trash" {
        "move_source_to_trash"
    } else {
        "delete_source_file"
    };
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
        mode: if mode == "trash" {
            "trash".to_string()
        } else {
            "permanent".to_string()
        },
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
                log::warn!(
                    "Trash via AppleScript failed ({}), falling back to permanent",
                    stderr.trim()
                );
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

async fn build_skill_analysis_overview(
    pool: &SqlitePool,
    filters: SkillAnalysisFilters,
) -> Result<SkillAnalysisOverview, String> {
    let skills = skill_repository::list_skills(pool)
        .await
        .map_err(|e| e.to_string())?;
    let sources = source_repository::list_sources(pool)
        .await
        .map_err(|e| e.to_string())?;
    let source_map = sources
        .into_iter()
        .map(|source| (source.id, (source.name, source.path, source.source_type)))
        .collect::<HashMap<_, _>>();
    let usage_map = load_skill_usage_stats(pool).await?;

    let mut items = skills
        .iter()
        .map(|skill| {
            let source_info = skill
                .source_id
                .as_ref()
                .and_then(|source_id| source_map.get(source_id));
            let source_name = source_info.map(|(name, _, _)| name.clone());
            let source_path = source_info.map(|(_, path, _)| path.as_str()).unwrap_or("");
            let source_type = source_info
                .and_then(|(_, _, source_type)| source_type.as_deref())
                .unwrap_or("");
            let signals = inspect_skill_content(skill);
            let usage = usage_map
                .get(&skill.id)
                .cloned()
                .unwrap_or_else(SkillUsageStats::new);
            build_analysis_item(skill, source_name, source_path, source_type, signals, usage)
        })
        .collect::<Vec<_>>();

    let all_time_cutoff = usage_top_20_cutoff(&items);
    for item in &mut items {
        let high_usage = item.usage_30d > 0 || item.usage_all_time >= all_time_cutoff;
        let high_quality = item.health_score >= 75;
        item.value_group = match (high_usage, high_quality) {
            (true, true) => "核心资产",
            (true, false) => "优先打磨",
            (false, true) => "潜力资产",
            (false, false) => "清理候选",
        }
        .to_string();
    }

    let filtered_items = apply_analysis_filters(items.clone(), &filters);
    let duplicate_groups = build_duplicate_groups(&filtered_items);
    let duplicate_skill_ids = duplicate_groups
        .iter()
        .flat_map(|group| group.skills.iter().map(|member| member.skill_id.clone()))
        .collect::<HashSet<_>>();
    let fits = build_agent_fit_matrix(&filtered_items);
    let scenario_coverage = build_scenario_coverage(&filtered_items);
    let quality_issues = build_quality_issue_groups(&filtered_items);

    Ok(SkillAnalysisOverview {
        generated_at: Utc::now().to_rfc3339(),
        summary: build_analysis_summary(&filtered_items, &duplicate_skill_ids),
        skills: filtered_items.clone(),
        usage_rankings: SkillUsageRankings {
            last_7_days: rank_skills(&filtered_items, "7d"),
            last_30_days: rank_skills(&filtered_items, "30d"),
            all_time: rank_skills(&filtered_items, "all"),
        },
        quadrants: build_quadrants(&filtered_items),
        quality_issues,
        duplicate_groups,
        agent_fit_matrix: fits,
        scenario_coverage,
        recommendations: build_recommendations(&filtered_items),
    })
}

fn default_analysis_filters() -> SkillAnalysisFilters {
    SkillAnalysisFilters {
        source_ids: Vec::new(),
        agent_clients: Vec::new(),
        categories: Vec::new(),
        statuses: Vec::new(),
        ai_ready_statuses: Vec::new(),
        time_range: None,
    }
}

async fn load_skill_usage_stats(
    pool: &SqlitePool,
) -> Result<HashMap<String, SkillUsageStats>, String> {
    let rows = sqlx::query(
        r#"
        SELECT resource_id, agent_client, usage_kind, event_time
        FROM agent_resource_usage_events
        WHERE resource_type = 'skill'
          AND event_source = 'log_inferred'
          AND confidence IN ('high', 'medium')
          AND resource_id IS NOT NULL
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let now = Utc::now();
    let cutoff_7d = now - Duration::days(7);
    let cutoff_30d = now - Duration::days(30);
    let mut map: HashMap<String, SkillUsageStats> = HashMap::new();

    for row in rows {
        let skill_id = row.get::<String, _>("resource_id");
        let agent_client = row.get::<String, _>("agent_client");
        let usage_kind = row.get::<String, _>("usage_kind");
        let event_time = row.get::<String, _>("event_time");
        let parsed = DateTime::parse_from_rfc3339(&event_time)
            .map(|dt| dt.with_timezone(&Utc))
            .ok();
        let stats = map.entry(skill_id).or_insert_with(SkillUsageStats::new);
        stats.usage_all_time += 1;
        if parsed.is_some_and(|dt| dt >= cutoff_7d) {
            stats.usage_7d += 1;
        }
        if parsed.is_some_and(|dt| dt >= cutoff_30d) {
            stats.usage_30d += 1;
        }
        if stats
            .last_used_at
            .as_ref()
            .map(|current| event_time > *current)
            .unwrap_or(true)
        {
            stats.last_used_at = Some(event_time);
        }
        *stats.agent_counts.entry(agent_client).or_insert(0) += 1;
        *stats.usage_kind_counts.entry(usage_kind).or_insert(0) += 1;
    }

    Ok(map)
}

fn build_analysis_item(
    skill: &Skill,
    source_name: Option<String>,
    source_path: &str,
    source_type: &str,
    signals: SkillContentSignals,
    usage: SkillUsageStats,
) -> SkillAnalysisItem {
    let mut score = 0;
    let mut flags = Vec::new();
    let description_ok = meaningful_text(skill.description.as_deref());
    let summary_ok = meaningful_text(skill.summary.as_deref());
    let category_ok = meaningful_text(skill.category.as_deref());
    let tags_ok = meaningful_text(skill.tags.as_deref());
    let compatible_agents =
        infer_compatible_agents(skill, &signals.excerpt, source_path, source_type, &usage);

    if description_ok {
        score += 10;
    } else {
        flags.push("missing_description".to_string());
    }
    if summary_ok {
        score += 10;
    } else {
        flags.push("missing_summary".to_string());
    }
    if category_ok {
        score += 10;
    } else {
        flags.push("missing_category".to_string());
    }
    if tags_ok {
        score += 10;
    } else {
        flags.push("missing_tags".to_string());
    }
    if !compatible_agents.iter().all(|agent| agent == "Unknown") {
        score += 10;
    }
    if signals.has_safe_file {
        score += 10;
    }
    if signals.has_input_output {
        score += 10;
    } else {
        flags.push("missing_input_output".to_string());
    }
    if signals.has_example {
        score += 10;
    } else {
        flags.push("missing_example".to_string());
    }
    if signals.has_boundary {
        score += 10;
    } else {
        flags.push("missing_boundary".to_string());
    }
    if signals.path_exists && signals.entry_exists {
        score += 10;
    } else {
        flags.push("path_broken".to_string());
    }
    if signals.content_too_short {
        flags.push("content_too_short".to_string());
    }
    if signals.template_residue {
        flags.push("template_residue".to_string());
    }
    if is_stale(skill.updated_at.as_str()) && usage.usage_30d == 0 {
        flags.push("stale_maintenance".to_string());
    }

    let health_status = health_status(score, &flags);
    let ai_ready_status = ai_ready_status(score, &flags);
    let primary_agent_client = primary_agent(&usage.agent_counts);
    let scenario = infer_scenario(skill, &signals.excerpt);

    SkillAnalysisItem {
        skill_id: skill.id.clone(),
        name: skill.name.clone(),
        path: skill.path.clone(),
        source_id: skill.source_id.clone(),
        source_name,
        category: skill.category.clone(),
        status: skill.status.clone(),
        health_score: score,
        health_status,
        ai_ready_status,
        usage_7d: usage.usage_7d,
        usage_30d: usage.usage_30d,
        usage_all_time: usage.usage_all_time,
        last_observed_used_at: usage.last_used_at,
        agent_client_count: usage.agent_counts.len() as i64,
        primary_agent_client,
        agent_usage_distribution: usage
            .agent_counts
            .into_iter()
            .map(|(agent_client, count)| AgentUsageCount {
                agent_client,
                count,
            })
            .collect(),
        usage_kind_distribution: usage
            .usage_kind_counts
            .into_iter()
            .map(|(usage_kind, count)| UsageKindCount { usage_kind, count })
            .collect(),
        value_group: "清理候选".to_string(),
        scenario,
        quality_flags: flags,
        compatible_agents,
        content_excerpt_chars: signals.chars,
        template_residue: signals.template_residue,
    }
}

fn inspect_skill_content(skill: &Skill) -> SkillContentSignals {
    let path = Path::new(&skill.path);
    let path_exists = path.exists();
    let skill_dir = if path.is_dir() {
        path.to_path_buf()
    } else {
        path.parent().unwrap_or(path).to_path_buf()
    };
    let safe_files = [
        "SKILL.md",
        "README.md",
        "skill.yaml",
        "skill.json",
        "skill.md",
        "readme.md",
    ];
    let mut excerpt = String::new();
    let mut has_safe_file = false;
    let entry_exists = skill
        .entry_file
        .as_ref()
        .map(|entry| skill_dir.join(entry).exists())
        .unwrap_or(path_exists);

    for file_name in safe_files {
        let candidate = skill_dir.join(file_name);
        if candidate.is_file() {
            has_safe_file = true;
            if excerpt.is_empty() {
                excerpt = std::fs::read_to_string(&candidate)
                    .unwrap_or_default()
                    .chars()
                    .take(4000)
                    .collect();
            }
        }
    }
    if excerpt.is_empty() && path.is_file() {
        excerpt = std::fs::read_to_string(path)
            .unwrap_or_default()
            .chars()
            .take(4000)
            .collect();
    }
    let lower = excerpt.to_lowercase();
    SkillContentSignals {
        chars: excerpt.chars().count(),
        has_input_output: contains_any(
            &lower,
            &[
                "input",
                "output",
                "参数",
                "输入",
                "输出",
                "when to use",
                "use when",
                "适用",
            ],
        ),
        has_example: contains_any(&lower, &["example", "usage", "示例", "用法", "例子"]),
        has_boundary: contains_any(
            &lower,
            &[
                "boundary",
                "limitation",
                "do not",
                "don't",
                "禁止",
                "不要",
                "注意",
                "边界",
            ],
        ),
        template_residue: contains_any(&lower, PLACEHOLDER_MARKERS),
        content_too_short: excerpt.chars().count() < 200,
        excerpt,
        has_safe_file,
        entry_exists,
        path_exists,
    }
}

fn meaningful_text(value: Option<&str>) -> bool {
    let Some(value) = value.map(str::trim) else {
        return false;
    };
    if value.is_empty() {
        return false;
    }
    let lower = value.to_lowercase();
    !PLACEHOLDER_MARKERS
        .iter()
        .any(|marker| lower.contains(marker))
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn health_status(score: i64, flags: &[String]) -> String {
    if flags.iter().any(|flag| flag == "path_broken") {
        "Broken"
    } else if flags.iter().any(|flag| {
        matches!(
            flag.as_str(),
            "missing_description" | "missing_summary" | "missing_category" | "missing_tags"
        )
    }) {
        "Needs Metadata"
    } else if flags.iter().any(|flag| flag == "missing_example") {
        "Needs Example"
    } else if flags.iter().any(|flag| flag == "missing_boundary") {
        "Needs Boundary"
    } else if score >= 85 {
        "Healthy"
    } else if score >= 65 {
        "Usable"
    } else {
        "Needs Metadata"
    }
    .to_string()
}

fn ai_ready_status(score: i64, flags: &[String]) -> String {
    if flags.iter().any(|flag| flag == "path_broken") {
        "Broken"
    } else if score >= 85
        && !flags.iter().any(|flag| {
            matches!(
                flag.as_str(),
                "missing_description"
                    | "missing_summary"
                    | "missing_category"
                    | "missing_tags"
                    | "missing_example"
                    | "missing_boundary"
                    | "template_residue"
            )
        })
    {
        "AI Ready"
    } else if flags.iter().any(|flag| {
        matches!(
            flag.as_str(),
            "missing_description" | "missing_summary" | "missing_category" | "missing_tags"
        )
    }) {
        "Needs Metadata"
    } else if flags.iter().any(|flag| flag == "missing_example") {
        "Needs Example"
    } else if flags.iter().any(|flag| flag == "missing_boundary") {
        "Needs Boundary"
    } else {
        "Not Recommended"
    }
    .to_string()
}

fn infer_compatible_agents(
    skill: &Skill,
    excerpt: &str,
    source_path: &str,
    source_type: &str,
    usage: &SkillUsageStats,
) -> Vec<String> {
    let mut agents = usage.agent_counts.keys().cloned().collect::<HashSet<_>>();
    let haystack = format!(
        "{} {} {} {} {} {} {}",
        skill.name,
        skill.description.as_deref().unwrap_or(""),
        skill.summary.as_deref().unwrap_or(""),
        skill.tags.as_deref().unwrap_or(""),
        excerpt,
        source_path,
        source_type
    )
    .to_lowercase();
    if haystack.contains("codex") {
        agents.insert("Codex".to_string());
    }
    if haystack.contains("claude") {
        agents.insert("Claude Code".to_string());
    }
    if haystack.contains("workbuddy") || haystack.contains("workbuddyextension") {
        agents.insert("WorkBuddy".to_string());
    }
    if haystack.contains("newmax") {
        agents.insert("Newmax".to_string());
    }
    if haystack.contains("antigravity") || haystack.contains("gemini") {
        agents.insert("Antigravity".to_string());
    }
    if agents.is_empty() && skill.is_executable == 0 {
        agents.insert("Human Reference Only".to_string());
    }
    if agents.is_empty() {
        agents.insert("Unknown".to_string());
    }
    let mut result = agents.into_iter().collect::<Vec<_>>();
    result.sort();
    result
}

fn infer_scenario(skill: &Skill, excerpt: &str) -> String {
    let text = format!(
        "{} {} {} {} {}",
        skill.name,
        skill.category.as_deref().unwrap_or(""),
        skill.description.as_deref().unwrap_or(""),
        skill.tags.as_deref().unwrap_or(""),
        excerpt
    )
    .to_lowercase();
    let checks = [
        (
            "代码审查",
            &["review", "审查", "code review", "pr"] as &[&str],
        ),
        ("项目初始化", &["init", "初始化", "scaffold", "项目初始化"]),
        (
            "文档办公",
            &["doc", "文档", "ppt", "slides", "markdown", "office"],
        ),
        (
            "数据分析",
            &["data", "analysis", "分析", "csv", "xlsx", "finance"],
        ),
        (
            "知识管理",
            &["knowledge", "memory", "note", "知识", "记忆", "笔记"],
        ),
        (
            "Agent 元能力",
            &["agent", "skill", "能力", "prompt", "workflow"],
        ),
        (
            "本地自动化",
            &["automation", "自动化", "shell", "cli", "脚本"],
        ),
        (
            "视觉设计",
            &["image", "figma", "design", "视觉", "图片", "设计"],
        ),
        (
            "发布营销",
            &["wechat", "xhs", "post", "marketing", "发布", "营销"],
        ),
        ("工程开发", &["code", "dev", "test", "git", "编程", "开发"]),
    ];
    for (scenario, needles) in checks {
        if contains_any(&text, needles) {
            return scenario.to_string();
        }
    }
    skill.category.clone().unwrap_or_else(|| "其他".to_string())
}

fn primary_agent(agent_counts: &HashMap<String, i64>) -> Option<String> {
    agent_counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(agent, _)| agent.clone())
}

fn usage_top_20_cutoff(items: &[SkillAnalysisItem]) -> i64 {
    let mut counts = items
        .iter()
        .map(|item| item.usage_all_time)
        .filter(|count| *count > 0)
        .collect::<Vec<_>>();
    if counts.is_empty() {
        return 1;
    }
    counts.sort_by(|a, b| b.cmp(a));
    let idx = ((counts.len() as f64) * 0.2).ceil() as usize;
    counts
        .get(idx.saturating_sub(1))
        .copied()
        .unwrap_or(1)
        .max(1)
}

fn apply_analysis_filters(
    items: Vec<SkillAnalysisItem>,
    filters: &SkillAnalysisFilters,
) -> Vec<SkillAnalysisItem> {
    items
        .into_iter()
        .filter(|item| {
            filters.source_ids.is_empty()
                || item
                    .source_id
                    .as_ref()
                    .is_some_and(|source_id| filters.source_ids.contains(source_id))
        })
        .filter(|item| {
            filters.categories.is_empty()
                || item
                    .category
                    .as_ref()
                    .is_some_and(|category| filters.categories.contains(category))
        })
        .filter(|item| filters.statuses.is_empty() || filters.statuses.contains(&item.status))
        .filter(|item| {
            filters.ai_ready_statuses.is_empty()
                || filters.ai_ready_statuses.contains(&item.ai_ready_status)
        })
        .filter(|item| {
            filters.agent_clients.is_empty()
                || item
                    .compatible_agents
                    .iter()
                    .any(|agent| filters.agent_clients.contains(agent))
                || item
                    .primary_agent_client
                    .as_ref()
                    .is_some_and(|agent| filters.agent_clients.contains(agent))
        })
        .filter(|item| match filters.time_range.as_deref() {
            Some("7d") => item.usage_7d > 0,
            Some("30d") => item.usage_30d > 0,
            Some("all") | None => true,
            _ => true,
        })
        .collect()
}

fn build_analysis_summary(
    items: &[SkillAnalysisItem],
    duplicate_skill_ids: &HashSet<String>,
) -> SkillAnalysisSummary {
    let total = items.len();
    let average = if total == 0 {
        0
    } else {
        items.iter().map(|item| item.health_score).sum::<i64>() / total as i64
    };
    SkillAnalysisSummary {
        total_skills: total,
        ai_ready: items
            .iter()
            .filter(|item| item.ai_ready_status == "AI Ready")
            .count(),
        needs_review: items
            .iter()
            .filter(|item| {
                item.quality_flags
                    .iter()
                    .any(|flag| flag.contains("missing"))
            })
            .count(),
        needs_improvement: items
            .iter()
            .filter(|item| item.value_group == "优先打磨")
            .count(),
        suspected_duplicates: items
            .iter()
            .filter(|item| duplicate_skill_ids.contains(&item.skill_id))
            .count(),
        dormant: items
            .iter()
            .filter(|item| item.usage_all_time > 0 && item.usage_30d == 0)
            .count(),
        broken: items
            .iter()
            .filter(|item| item.ai_ready_status == "Broken")
            .count(),
        average_health_score: average,
    }
}

fn rank_skills(items: &[SkillAnalysisItem], range: &str) -> Vec<SkillUsageRankItem> {
    let mut result = items
        .iter()
        .map(|item| SkillUsageRankItem {
            skill_id: item.skill_id.clone(),
            name: item.name.clone(),
            count: match range {
                "7d" => item.usage_7d,
                "30d" => item.usage_30d,
                _ => item.usage_all_time,
            },
            health_score: item.health_score,
            ai_ready_status: item.ai_ready_status.clone(),
            primary_agent_client: item.primary_agent_client.clone(),
        })
        .filter(|item| item.count > 0)
        .collect::<Vec<_>>();
    result.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));
    result.truncate(20);
    result
}

fn build_quadrants(items: &[SkillAnalysisItem]) -> SkillQuadrants {
    let mut core_assets = Vec::new();
    let mut priority_improvements = Vec::new();
    let mut potential_assets = Vec::new();
    let mut cleanup_candidates = Vec::new();
    for item in items {
        let quadrant_item = SkillQuadrantItem {
            skill_id: item.skill_id.clone(),
            name: item.name.clone(),
            health_score: item.health_score,
            usage_30d: item.usage_30d,
            usage_all_time: item.usage_all_time,
            reasons: quadrant_reasons(item),
        };
        match item.value_group.as_str() {
            "核心资产" => core_assets.push(quadrant_item),
            "优先打磨" => priority_improvements.push(quadrant_item),
            "潜力资产" => potential_assets.push(quadrant_item),
            _ => cleanup_candidates.push(quadrant_item),
        }
    }
    for list in [
        &mut core_assets,
        &mut priority_improvements,
        &mut potential_assets,
        &mut cleanup_candidates,
    ] {
        list.sort_by(|a, b| {
            b.usage_30d
                .cmp(&a.usage_30d)
                .then(b.health_score.cmp(&a.health_score))
        });
        list.truncate(20);
    }
    SkillQuadrants {
        core_assets,
        priority_improvements,
        potential_assets,
        cleanup_candidates,
    }
}

fn quadrant_reasons(item: &SkillAnalysisItem) -> Vec<String> {
    let mut reasons = Vec::new();
    if item.usage_30d > 0 {
        reasons.push(format!("30 天可观测使用 {} 次", item.usage_30d));
    } else if item.usage_all_time > 0 {
        reasons.push(format!("历史可观测使用 {} 次", item.usage_all_time));
    } else {
        reasons.push("暂无日志推断使用记录".to_string());
    }
    reasons.push(format!("健康分 {}", item.health_score));
    reasons.push(format!("AI Ready：{}", item.ai_ready_status));
    reasons
}

fn build_quality_issue_groups(items: &[SkillAnalysisItem]) -> Vec<SkillQualityIssueGroup> {
    let issue_defs = [
        ("missing_description", "缺描述"),
        ("missing_summary", "缺摘要"),
        ("missing_category", "缺分类"),
        ("missing_tags", "缺标签"),
        ("missing_example", "缺示例"),
        ("missing_boundary", "缺边界"),
        ("path_broken", "路径异常"),
        ("content_too_short", "内容过短"),
        ("template_residue", "疑似模板残留"),
        ("stale_maintenance", "长期未维护"),
    ];
    issue_defs
        .iter()
        .filter_map(|(key, label)| {
            let skill_ids = items
                .iter()
                .filter(|item| item.quality_flags.iter().any(|flag| flag == key))
                .map(|item| item.skill_id.clone())
                .collect::<Vec<_>>();
            (!skill_ids.is_empty()).then(|| SkillQualityIssueGroup {
                issue_key: (*key).to_string(),
                label: (*label).to_string(),
                count: skill_ids.len(),
                skill_ids,
            })
        })
        .collect()
}

fn build_duplicate_groups(items: &[SkillAnalysisItem]) -> Vec<SkillDuplicateGroup> {
    let mut groups = Vec::new();
    let mut used_pairs = HashSet::new();
    for (idx, left) in items.iter().enumerate() {
        let mut members = vec![left.clone()];
        let mut reasons = Vec::new();
        for right in items.iter().skip(idx + 1) {
            let pair_key = if left.skill_id < right.skill_id {
                format!("{}:{}", left.skill_id, right.skill_id)
            } else {
                format!("{}:{}", right.skill_id, left.skill_id)
            };
            if used_pairs.contains(&pair_key) {
                continue;
            }
            let similarity = skill_similarity(left, right);
            if similarity.0 >= 2 {
                used_pairs.insert(pair_key);
                members.push(right.clone());
                reasons.extend(similarity.1);
            }
        }
        if members.len() > 1 {
            members.sort_by(|a, b| {
                b.health_score
                    .cmp(&a.health_score)
                    .then(b.usage_all_time.cmp(&a.usage_all_time))
            });
            let primary = members.first().map(|item| item.skill_id.clone());
            let archive_candidates = members
                .iter()
                .skip(1)
                .map(|item| item.skill_id.clone())
                .collect::<Vec<_>>();
            let group_type = if reasons.iter().any(|reason| reason.contains("名称")) {
                "duplicate"
            } else {
                "overlap"
            };
            let confidence = if reasons.len() >= 3 { "high" } else { "medium" };
            groups.push(SkillDuplicateGroup {
                group_id: format!("dup-{}", groups.len() + 1),
                group_type: group_type.to_string(),
                confidence: confidence.to_string(),
                primary_candidate_id: primary,
                archive_candidate_ids: archive_candidates,
                skills: members
                    .iter()
                    .map(|item| SkillDuplicateMember {
                        skill_id: item.skill_id.clone(),
                        name: item.name.clone(),
                        health_score: item.health_score,
                        usage_30d: item.usage_30d,
                        usage_all_time: item.usage_all_time,
                        path: item.path.clone(),
                    })
                    .collect(),
                reasons: unique_strings(reasons),
                suggested_action: if group_type == "duplicate" {
                    "archive_old_versions"
                } else {
                    "needs_review"
                }
                .to_string(),
            });
        }
    }
    groups.truncate(30);
    groups
}

fn skill_similarity(left: &SkillAnalysisItem, right: &SkillAnalysisItem) -> (i32, Vec<String>) {
    let mut score = 0;
    let mut reasons = Vec::new();
    let left_name = normalized_name(&left.name);
    let right_name = normalized_name(&right.name);
    if !left_name.is_empty() && left_name == right_name {
        score += 3;
        reasons.push("名称高度相似".to_string());
    } else if !left_name.is_empty()
        && !right_name.is_empty()
        && (left_name.contains(&right_name) || right_name.contains(&left_name))
    {
        score += 2;
        reasons.push("名称存在包含关系".to_string());
    }
    let left_agents = left.compatible_agents.iter().collect::<HashSet<_>>();
    let right_agents = right.compatible_agents.iter().collect::<HashSet<_>>();
    let shared_agent =
        !left_agents.is_empty() && left_agents.intersection(&right_agents).count() > 0;
    if left.category.is_some()
        && left.category == right.category
        && left.scenario == right.scenario
        && shared_agent
    {
        score += 1;
        reasons.push("分类、场景和适用 Agent 存在弱重叠".to_string());
    }
    (score, reasons)
}

fn normalized_name(name: &str) -> String {
    let mut value = name.to_lowercase();
    for word in WEAK_NAME_WORDS {
        value = value.replace(word, "");
    }
    value
        .chars()
        .filter(|ch| ch.is_alphanumeric() || ('\u{4e00}'..='\u{9fff}').contains(ch))
        .collect()
}

fn build_agent_fit_matrix(items: &[SkillAnalysisItem]) -> AgentSkillFitMatrix {
    let mut fits = Vec::new();
    for item in items {
        for agent in SUPPORTED_AGENT_CLIENTS {
            let observed = item
                .agent_usage_distribution
                .iter()
                .find(|entry| entry.agent_client == *agent)
                .map(|entry| entry.count)
                .unwrap_or(0);
            let explicit = item
                .compatible_agents
                .iter()
                .any(|candidate| candidate == agent);
            let fit_level = if observed > 0 || explicit {
                "strong"
            } else if agent == &"Generic Agent" && item.ai_ready_status == "AI Ready" {
                "possible"
            } else if agent == &"Unknown" && item.compatible_agents.iter().any(|v| v == "Unknown") {
                "unknown"
            } else {
                "weak"
            };
            let mut reasons = Vec::new();
            if observed > 0 {
                reasons.push(format!("日志推断中由 {agent} 使用"));
            }
            if explicit {
                reasons.push("元数据或内容命中适配线索".to_string());
            }
            if reasons.is_empty() {
                reasons.push("暂无明确适配证据".to_string());
            }
            fits.push(AgentSkillFit {
                skill_id: item.skill_id.clone(),
                agent_client: (*agent).to_string(),
                fit_level: fit_level.to_string(),
                reasons,
                observed_usage_count: observed,
            });
        }
    }
    AgentSkillFitMatrix {
        agents: SUPPORTED_AGENT_CLIENTS
            .iter()
            .map(|agent| (*agent).to_string())
            .collect(),
        fits,
    }
}

fn build_scenario_coverage(items: &[SkillAnalysisItem]) -> Vec<ScenarioCoverageGroup> {
    SCENARIOS
        .iter()
        .map(|scenario| {
            let scenario_items = items
                .iter()
                .filter(|item| item.scenario == *scenario)
                .collect::<Vec<_>>();
            let skill_count = scenario_items.len();
            let usage_30d = scenario_items.iter().map(|item| item.usage_30d).sum();
            let ai_ready_count = scenario_items
                .iter()
                .filter(|item| item.ai_ready_status == "AI Ready")
                .count();
            let broken_count = scenario_items
                .iter()
                .filter(|item| item.ai_ready_status == "Broken")
                .count();
            let average_health_score = if skill_count == 0 {
                0
            } else {
                scenario_items
                    .iter()
                    .map(|item| item.health_score)
                    .sum::<i64>()
                    / skill_count as i64
            };
            let mut signals = Vec::new();
            if skill_count == 0 {
                signals.push("场景缺口".to_string());
            }
            if skill_count > 30 {
                signals.push("场景过载".to_string());
            }
            if skill_count > 0 && usage_30d == 0 {
                signals.push("有 Skill 但 30 天无人使用".to_string());
            }
            if usage_30d > 0 && average_health_score < 65 {
                signals.push("高使用但质量偏低".to_string());
            }
            ScenarioCoverageGroup {
                scenario: (*scenario).to_string(),
                skill_count,
                ai_ready_count,
                broken_count,
                usage_30d,
                average_health_score,
                signals,
            }
        })
        .collect()
}

fn build_recommendations(items: &[SkillAnalysisItem]) -> SkillAnalysisRecommendations {
    SkillAnalysisRecommendations {
        optimize_top: recommend(
            items,
            |item| item.usage_30d > 0 && item.health_score < 75,
            "高使用但健康分偏低，建议优先打磨",
        ),
        archive_top: recommend(
            items,
            |item| item.usage_all_time == 0 && item.health_score < 65,
            "长期无日志推断使用且健康分偏低，建议评估归档",
        ),
        missing_description_top: recommend(
            items,
            |item| {
                item.quality_flags
                    .iter()
                    .any(|flag| flag == "missing_description")
            },
            "缺 description，影响 AI 理解和用户判断",
        ),
        missing_example_top: recommend(
            items,
            |item| {
                item.quality_flags
                    .iter()
                    .any(|flag| flag == "missing_example")
            },
            "缺示例，建议补充用法或触发场景",
        ),
        missing_boundary_top: recommend(
            items,
            |item| {
                item.quality_flags
                    .iter()
                    .any(|flag| flag == "missing_boundary")
            },
            "缺边界说明，建议补充禁止事项和限制条件",
        ),
        codex_analysis_top: recommend(
            items,
            |item| item.usage_30d > 0 && item.ai_ready_status != "AI Ready",
            "高使用但未达到 AI Ready，建议让 Codex 生成治理 proposal",
        ),
        merge_groups: build_duplicate_groups(items),
        agent_binding_top: build_agent_binding_recommendations(items),
    }
}

fn recommend<F>(
    items: &[SkillAnalysisItem],
    predicate: F,
    reason: &str,
) -> Vec<SkillRecommendationItem>
where
    F: Fn(&SkillAnalysisItem) -> bool,
{
    let mut result = items
        .iter()
        .filter(|item| predicate(item))
        .map(|item| SkillRecommendationItem {
            skill_id: item.skill_id.clone(),
            name: item.name.clone(),
            reason: reason.to_string(),
            health_score: item.health_score,
            usage_30d: item.usage_30d,
            usage_all_time: item.usage_all_time,
        })
        .collect::<Vec<_>>();
    result.sort_by(|a, b| {
        b.usage_30d
            .cmp(&a.usage_30d)
            .then(a.health_score.cmp(&b.health_score))
    });
    result.truncate(10);
    result
}

fn build_agent_binding_recommendations(
    items: &[SkillAnalysisItem],
) -> Vec<AgentBindingRecommendation> {
    let mut result = Vec::new();
    for item in items {
        for agent in &item.compatible_agents {
            if agent != "Unknown" && agent != "Human Reference Only" {
                result.push(AgentBindingRecommendation {
                    skill_id: item.skill_id.clone(),
                    name: item.name.clone(),
                    agent_client: agent.clone(),
                    reason: format!("根据来源、内容或日志推断，适合绑定到 {agent}"),
                });
            }
        }
    }
    result.truncate(10);
    result
}

fn unique_strings(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn is_stale(updated_at: &str) -> bool {
    DateTime::parse_from_rfc3339(updated_at)
        .map(|dt| dt.with_timezone(&Utc) < Utc::now() - Duration::days(180))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, name: &str, health_score: i64, usage_30d: i64) -> SkillAnalysisItem {
        SkillAnalysisItem {
            skill_id: id.to_string(),
            name: name.to_string(),
            path: format!("/tmp/{name}/SKILL.md"),
            source_id: None,
            source_name: None,
            category: Some("工程开发".to_string()),
            status: "active".to_string(),
            health_score,
            health_status: "Usable".to_string(),
            ai_ready_status: "Not Recommended".to_string(),
            usage_7d: usage_30d,
            usage_30d,
            usage_all_time: usage_30d,
            last_observed_used_at: None,
            agent_client_count: 0,
            primary_agent_client: None,
            agent_usage_distribution: Vec::new(),
            usage_kind_distribution: Vec::new(),
            value_group: String::new(),
            scenario: "工程开发".to_string(),
            quality_flags: Vec::new(),
            compatible_agents: vec!["Codex".to_string()],
            content_excerpt_chars: 300,
            template_residue: false,
        }
    }

    #[test]
    fn placeholder_text_is_not_meaningful() {
        assert!(!meaningful_text(Some(
            "暂无描述。系统推测其用途可能与 foo 相关"
        )));
        assert!(meaningful_text(Some("用于读取项目上下文并生成安全建议")));
    }

    #[test]
    fn health_and_ai_ready_statuses_follow_missing_rules() {
        let metadata_flags = vec!["missing_description".to_string()];
        assert_eq!(health_status(80, &metadata_flags), "Needs Metadata");
        assert_eq!(ai_ready_status(80, &metadata_flags), "Needs Metadata");

        let example_flags = vec!["missing_example".to_string()];
        assert_eq!(health_status(80, &example_flags), "Needs Example");
        assert_eq!(ai_ready_status(80, &example_flags), "Needs Example");

        let clean_flags: Vec<String> = Vec::new();
        assert_eq!(health_status(90, &clean_flags), "Healthy");
        assert_eq!(ai_ready_status(90, &clean_flags), "AI Ready");
    }

    #[test]
    fn chinese_name_overlap_is_detected_without_empty_name_false_positive() {
        let left = item("a", "知识卡片生成工具", 70, 1);
        let right = item("b", "知识卡片整理助手", 70, 1);
        let similarity = skill_similarity(&left, &right);
        assert!(similarity.0 >= 2);

        let empty_like = item("c", "工具脚本助手模板", 70, 1);
        let other = item("d", "another-skill", 70, 1);
        let false_positive = skill_similarity(&empty_like, &other);
        assert!(false_positive.0 < 2);
    }

    #[test]
    fn quadrants_follow_usage_and_health_thresholds() {
        let mut core = item("core", "core", 90, 3);
        core.usage_all_time = 10;
        core.value_group = "核心资产".to_string();

        let mut improve = item("improve", "improve", 50, 4);
        improve.usage_all_time = 12;
        improve.value_group = "优先打磨".to_string();

        let mut potential = item("potential", "potential", 90, 0);
        potential.value_group = "潜力资产".to_string();

        let quadrants = build_quadrants(&[core, improve, potential]);
        assert_eq!(quadrants.core_assets.len(), 1);
        assert_eq!(quadrants.priority_improvements.len(), 1);
        assert_eq!(quadrants.potential_assets.len(), 1);
    }
}
