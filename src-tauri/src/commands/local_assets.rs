use crate::scanner::ignore_rules::build_walker;
use crate::security::path_guard::validate_scan_root;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use std::path::Path;
use std::time::SystemTime;
use tauri::{command, State};
use uuid::Uuid;

const MAX_LISTED_FILES: usize = 500;
const MEMORY_SCAN_DEPTH: usize = 8;
const KNOWLEDGE_SCAN_DEPTH: usize = 8;
const LARGE_MEMORY_FILE_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct AssetOverview {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub asset_type: Option<String>,
    pub scope: Option<String>,
    pub project_id: Option<String>,
    pub status: Option<String>,
    pub description: Option<String>,
    pub file_count: i64,
    pub total_size_bytes: i64,
    pub last_modified_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LocalFileEntry {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub extension: Option<String>,
    pub size_bytes: i64,
    pub modified_at: Option<String>,
    pub category: String,
}

#[derive(Debug, Serialize, Default, Clone)]
pub struct ScanStats {
    pub file_count: i64,
    pub total_size_bytes: i64,
    pub last_modified_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FileListResult {
    pub source_id: String,
    pub files: Vec<LocalFileEntry>,
    pub stats: ScanStats,
    pub truncated: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct HealthIssue {
    pub severity: String,
    pub source: String,
    pub title: String,
    pub resource_name: Option<String>,
    pub resource_path: Option<String>,
    pub description: String,
    pub suggestion: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct HealthReport {
    pub score: i64,
    pub issues: Vec<HealthIssue>,
    pub generated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ProjectBinding {
    pub id: String,
    pub project_id: String,
    pub resource_type: String,
    pub resource_id: String,
    pub resource_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct UsageTrends {
    pub week: Vec<UsageMetric>,
    pub month: Vec<UsageMetric>,
    pub year: Vec<UsageMetric>,
}

#[derive(Debug, Serialize)]
pub struct MatrixCell {
    pub agent: String,
    pub resource: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsOverview {
    pub resource_counts: HashMap<String, i64>,
    pub usage_by_resource_type: Vec<UsageMetric>,
    pub usage_by_action: Vec<UsageMetric>,
    pub usage_by_agent_client: Vec<UsageMetric>,
    pub usage_by_skill: Vec<UsageMetric>,
    pub usage_by_mcp_server: Vec<UsageMetric>,
    pub usage_by_mcp_tool: Vec<UsageMetric>,
    pub skill_by_agent_matrix: Vec<MatrixCell>,
    pub mcp_by_agent_matrix: Vec<MatrixCell>,
    pub recent_events: Vec<UsageEvent>,
    pub trends: UsageTrends,
    pub scan_status: ScanStatus,
}

#[derive(Debug, Serialize)]
pub struct ScanStatus {
    pub status: String,
    pub last_started_at: Option<String>,
    pub last_finished_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UsageMetric {
    pub key: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct UsageEvent {
    pub resource_type: String,
    pub resource_id: String,
    pub action: String,
    pub source: Option<String>,
    pub created_at: String,
}

#[command]
pub async fn list_memory_sources(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AssetOverview>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, name, path, memory_type, project_id, status, description, created_at, updated_at
        FROM memory_sources
        ORDER BY updated_at DESC
        "#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.into_iter()
        .map(|row| {
            let path: String = row.get("path");
            let stats = scan_stats(Path::new(&path), MEMORY_SCAN_DEPTH);
            Ok(AssetOverview {
                id: row.get("id"),
                name: row.get("name"),
                path: Some(path),
                asset_type: row.get("memory_type"),
                scope: None,
                project_id: row.get("project_id"),
                status: row.get("status"),
                description: row.get("description"),
                file_count: stats.file_count,
                total_size_bytes: stats.total_size_bytes,
                last_modified_at: stats.last_modified_at,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
        })
        .collect()
}

#[command]
pub async fn add_memory_source(
    name: String,
    path: String,
    memory_type: Option<String>,
    project_id: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<AssetOverview, String> {
    let safe_path = validate_scan_root(&path)?.to_string_lossy().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO memory_sources
            (id, name, path, memory_type, project_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
        ON CONFLICT(path) DO UPDATE SET
            name = excluded.name,
            memory_type = excluded.memory_type,
            project_id = excluded.project_id,
            status = 'active',
            updated_at = excluded.updated_at
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&name)
    .bind(&safe_path)
    .bind(&memory_type)
    .bind(&project_id)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let sources = list_memory_sources(pool).await?;
    sources
        .into_iter()
        .find(|source| source.path.as_deref() == Some(safe_path.as_str()))
        .ok_or_else(|| "Memory source was saved but could not be reloaded".to_string())
}

#[command]
pub async fn list_memory_files(
    source_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<FileListResult, String> {
    let path = fetch_path(&pool, "memory_sources", &source_id).await?;
    let (files, stats, truncated) = list_local_files(Path::new(&path), MEMORY_SCAN_DEPTH);
    Ok(FileListResult {
        source_id,
        files,
        stats,
        truncated,
    })
}

#[command]
pub async fn run_memory_health_check(pool: State<'_, SqlitePool>) -> Result<HealthReport, String> {
    let sources = list_memory_sources(pool).await?;
    let mut issues = Vec::new();

    if sources.is_empty() {
        issues.push(HealthIssue {
            severity: "warning".to_string(),
            source: "Memory".to_string(),
            title: "尚未添加记忆目录".to_string(),
            resource_name: None,
            resource_path: None,
            description: "Memory 页面还没有可体检的本地记忆根目录。".to_string(),
            suggestion: "添加 memorydu 或其他记忆根目录后再运行体检。".to_string(),
            status: "open".to_string(),
        });
    }

    for source in &sources {
        let Some(path) = source.path.as_deref() else {
            continue;
        };
        let root = Path::new(path);
        if !root.exists() {
            issues.push(path_issue("critical", "Memory", "记忆目录不存在", source));
            continue;
        }
        if source.file_count == 0 {
            issues.push(HealthIssue {
                severity: "warning".to_string(),
                source: "Memory".to_string(),
                title: "记忆目录为空或无可识别文件".to_string(),
                resource_name: Some(source.name.clone()),
                resource_path: Some(path.to_string()),
                description: "扫描没有发现 Markdown、JSON、YAML、文本等记忆文件。".to_string(),
                suggestion: "确认路径是否指向真实记忆根目录，或调整目录结构。".to_string(),
                status: "open".to_string(),
            });
        }
        if source.asset_type.is_none() {
            issues.push(HealthIssue {
                severity: "info".to_string(),
                source: "Memory".to_string(),
                title: "记忆目录未标记类型".to_string(),
                resource_name: Some(source.name.clone()),
                resource_path: Some(path.to_string()),
                description: "该目录可以扫描，但缺少长期记忆、项目记忆、临时记忆等类型标记。"
                    .to_string(),
                suggestion: "为记忆目录补充 memory_type，便于后续分类和项目绑定。".to_string(),
                status: "open".to_string(),
            });
        }

        let (files, _, _) = list_local_files(root, MEMORY_SCAN_DEPTH);
        let mut seen = HashMap::<String, usize>::new();
        for file in files {
            if file.size_bytes as u64 > LARGE_MEMORY_FILE_BYTES {
                issues.push(HealthIssue {
                    severity: "warning".to_string(),
                    source: "Memory".to_string(),
                    title: "记忆文件偏大".to_string(),
                    resource_name: Some(file.name.clone()),
                    resource_path: Some(file.path.clone()),
                    description: "单个记忆文件超过 1MB，后续给 AI 提供上下文时可能需要摘录或拆分。"
                        .to_string(),
                    suggestion: "保留原文不变，另行创建摘要层或拆分结构化记忆。".to_string(),
                    status: "open".to_string(),
                });
            }
            *seen.entry(file.name).or_insert(0) += 1;
        }
        for (name, count) in seen {
            if count > 1 {
                issues.push(HealthIssue {
                    severity: "info".to_string(),
                    source: "Memory".to_string(),
                    title: "发现同名记忆文件".to_string(),
                    resource_name: Some(name.clone()),
                    resource_path: Some(path.to_string()),
                    description: format!("同名文件出现 {count} 次，可能需要人工确认是否重复。"),
                    suggestion: "在 Memory 页面定位同名文件，人工判断是否需要合并或改名。"
                        .to_string(),
                    status: "open".to_string(),
                });
            }
        }
    }

    Ok(health_report(issues))
}

#[command]
pub async fn list_knowledge_bases(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AssetOverview>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, name, path, type, scope, project_id, status, description, created_at, updated_at
        FROM knowledge_bases
        ORDER BY updated_at DESC
        "#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.into_iter()
        .map(|row| {
            let path: String = row.get("path");
            let stats = scan_stats(Path::new(&path), KNOWLEDGE_SCAN_DEPTH);
            Ok(AssetOverview {
                id: row.get("id"),
                name: row.get("name"),
                path: Some(path),
                asset_type: row.get("type"),
                scope: row.get("scope"),
                project_id: row.get("project_id"),
                status: row.get("status"),
                description: row.get("description"),
                file_count: stats.file_count,
                total_size_bytes: stats.total_size_bytes,
                last_modified_at: stats.last_modified_at,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
        })
        .collect()
}

#[command]
pub async fn add_knowledge_base(
    name: String,
    path: String,
    kb_type: Option<String>,
    scope: Option<String>,
    project_id: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<AssetOverview, String> {
    let safe_path = validate_scan_root(&path)?.to_string_lossy().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO knowledge_bases
            (id, name, path, type, scope, project_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
        ON CONFLICT(path) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            scope = excluded.scope,
            project_id = excluded.project_id,
            status = 'active',
            updated_at = excluded.updated_at
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&name)
    .bind(&safe_path)
    .bind(&kb_type)
    .bind(&scope)
    .bind(&project_id)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let bases = list_knowledge_bases(pool).await?;
    bases
        .into_iter()
        .find(|base| base.path.as_deref() == Some(safe_path.as_str()))
        .ok_or_else(|| "Knowledge base was saved but could not be reloaded".to_string())
}

#[command]
pub async fn list_knowledge_files(
    kb_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<FileListResult, String> {
    let path = fetch_path(&pool, "knowledge_bases", &kb_id).await?;
    let (files, stats, truncated) = list_local_files(Path::new(&path), KNOWLEDGE_SCAN_DEPTH);
    Ok(FileListResult {
        source_id: kb_id,
        files,
        stats,
        truncated,
    })
}

#[command]
pub async fn list_projects(pool: State<'_, SqlitePool>) -> Result<Vec<AssetOverview>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, name, path, status, description, created_at, updated_at
        FROM projects
        ORDER BY updated_at DESC
        "#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.into_iter()
        .map(|row| {
            let path: Option<String> = row.get("path");
            let stats = path
                .as_deref()
                .map(|p| scan_stats(Path::new(p), KNOWLEDGE_SCAN_DEPTH))
                .unwrap_or_default();
            Ok(AssetOverview {
                id: row.get("id"),
                name: row.get("name"),
                path,
                asset_type: None,
                scope: None,
                project_id: None,
                status: row.get("status"),
                description: row.get("description"),
                file_count: stats.file_count,
                total_size_bytes: stats.total_size_bytes,
                last_modified_at: stats.last_modified_at,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
        })
        .collect()
}

#[command]
pub async fn add_project(
    name: String,
    path: Option<String>,
    description: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<AssetOverview, String> {
    let safe_path = match path {
        Some(value) if !value.trim().is_empty() => Some(
            validate_scan_root(value.trim())?
                .to_string_lossy()
                .to_string(),
        ),
        _ => None,
    };
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, path, description, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&name)
    .bind(&safe_path)
    .bind(&description)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let projects = list_projects(pool).await?;
    projects
        .into_iter()
        .find(|project| project.name == name && project.path == safe_path)
        .ok_or_else(|| "Project was saved but could not be reloaded".to_string())
}

#[command]
pub async fn bind_project_resource(
    project_id: String,
    resource_type: String,
    resource_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    if !matches!(
        resource_type.as_str(),
        "agent" | "skill" | "mcp_server" | "memory_source" | "knowledge_base"
    ) {
        return Err(format!(
            "unsupported project resource type: {resource_type}"
        ));
    }
    if !resource_exists(&pool, &resource_type, &resource_id).await? {
        return Err("resource does not exist".to_string());
    }
    if !resource_exists(&pool, "project", &project_id).await? {
        return Err("project does not exist".to_string());
    }

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO project_resource_bindings
          (id, project_id, resource_type, resource_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&project_id)
    .bind(&resource_type)
    .bind(&resource_id)
    .bind(Utc::now().to_rfc3339())
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn list_project_bindings(
    project_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<ProjectBinding>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, project_id, resource_type, resource_id, created_at
        FROM project_resource_bindings
        WHERE project_id = ?
        ORDER BY created_at DESC
        "#,
    )
    .bind(&project_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut bindings = Vec::new();
    for row in rows {
        let resource_type: String = row.get("resource_type");
        let resource_id: String = row.get("resource_id");
        let resource_name = fetch_resource_name(&pool, &resource_type, &resource_id)
            .await
            .ok()
            .flatten();
        bindings.push(ProjectBinding {
            id: row.get("id"),
            project_id: row.get("project_id"),
            resource_type,
            resource_id,
            resource_name,
            created_at: row.get("created_at"),
        });
    }

    Ok(bindings)
}
static IS_SCANNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static LAST_SCAN_STARTED: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static LAST_SCAN_FINISHED: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// 获取当前扫描状态的快照
fn current_scan_status() -> ScanStatus {
    let running = IS_SCANNING.load(std::sync::atomic::Ordering::SeqCst);
    let started_ts = LAST_SCAN_STARTED.load(std::sync::atomic::Ordering::SeqCst);
    let finished_ts = LAST_SCAN_FINISHED.load(std::sync::atomic::Ordering::SeqCst);

    let last_started_at = if started_ts > 0 {
        chrono::DateTime::from_timestamp(started_ts as i64, 0).map(|t| t.to_rfc3339())
    } else {
        None
    };
    let last_finished_at = if finished_ts > 0 {
        chrono::DateTime::from_timestamp(finished_ts as i64, 0).map(|t| t.to_rfc3339())
    } else {
        None
    };

    let status = if running { "running" } else { "idle" };
    ScanStatus {
        status: status.to_string(),
        last_started_at,
        last_finished_at,
    }
}

/// P0-2: 独立的日志扫描触发命令，不混在 get_analytics_overview 里
#[command]
pub async fn trigger_agent_log_scan(pool: State<'_, SqlitePool>) -> Result<ScanStatus, String> {
    if IS_SCANNING
        .compare_exchange(
            false,
            true,
            std::sync::atomic::Ordering::SeqCst,
            std::sync::atomic::Ordering::SeqCst,
        )
        .is_ok()
    {
        let now_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        LAST_SCAN_STARTED.store(now_ts, std::sync::atomic::Ordering::SeqCst);

        let pool_clone = (*pool).clone();
        tokio::spawn(async move {
            log::info!("[Log Scanner] Background scan triggered by user...");
            if let Err(e) = crate::scanner::log_scanner::scan_all_logs(&pool_clone).await {
                log::error!("[Log Scanner] Background scan failed: {}", e);
            }
            let fin_ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            LAST_SCAN_FINISHED.store(fin_ts, std::sync::atomic::Ordering::SeqCst);
            IS_SCANNING.store(false, std::sync::atomic::Ordering::SeqCst);
            log::info!("[Log Scanner] Background scan finished.");
        });
    } else {
        log::info!("[Log Scanner] Scan already running, ignoring trigger.");
    }
    Ok(current_scan_status())
}

#[command]
pub async fn get_analytics_overview(
    pool: State<'_, SqlitePool>,
) -> Result<AnalyticsOverview, String> {
    let mut resource_counts = HashMap::new();
    for (key, table) in [
        ("agents", "agents"),
        ("skills", "skills"),
        ("mcp_servers", "mcp_servers"),
        ("memory_sources", "memory_sources"),
        ("knowledge_bases", "knowledge_bases"),
        ("projects", "projects"),
    ] {
        resource_counts.insert(key.to_string(), count_table(&pool, table).await?);
    }

    let trends = UsageTrends {
        week: get_weekly_trend(&pool).await?,
        month: get_monthly_trend(&pool).await?,
        year: get_all_time_trend(&pool).await?,
    };

    Ok(AnalyticsOverview {
        resource_counts,
        usage_by_resource_type: usage_group(&pool, "resource_type").await?,
        usage_by_action: usage_group(&pool, "action").await?,
        usage_by_agent_client: usage_by_agent_client(&pool).await?,
        usage_by_skill: usage_by_skill(&pool).await?,
        usage_by_mcp_server: usage_by_mcp_server(&pool).await?,
        usage_by_mcp_tool: usage_by_mcp_tool(&pool).await?,
        skill_by_agent_matrix: skill_by_agent_matrix(&pool).await?,
        mcp_by_agent_matrix: mcp_by_agent_matrix(&pool).await?,
        recent_events: recent_usage_events(&pool).await?,
        trends,
        scan_status: current_scan_status(),
    })
}

#[command]
pub async fn run_global_health_check(pool: State<'_, SqlitePool>) -> Result<HealthReport, String> {
    let mut issues = Vec::new();

    append_agent_issues(&pool, &mut issues).await?;
    append_skill_issues(&pool, &mut issues).await?;
    append_mcp_issues(&pool, &mut issues).await?;
    append_path_issues(&pool, "Memory", "memory_sources", &mut issues).await?;
    append_path_issues(&pool, "Knowledge", "knowledge_bases", &mut issues).await?;
    append_path_issues(&pool, "Project", "projects", &mut issues).await?;

    Ok(health_report(issues))
}

#[command]
pub async fn open_local_path(path: String) -> Result<(), String> {
    let safe_path = validate_scan_root(&path)?;
    std::process::Command::new("open")
        .arg(safe_path)
        .spawn()
        .map_err(|e| format!("Failed to open path: {e}"))?;
    Ok(())
}

fn list_local_files(root: &Path, max_depth: usize) -> (Vec<LocalFileEntry>, ScanStats, bool) {
    let mut files = Vec::new();
    let mut stats = ScanStats::default();
    let mut truncated = false;
    let mut latest_modified: Option<SystemTime> = None;

    if !root.exists() {
        return (files, stats, truncated);
    }

    for result in build_walker(root, max_depth) {
        let Ok(entry) = result else {
            continue;
        };
        if !entry.file_type().map_or(false, |ft| ft.is_file()) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        stats.file_count += 1;
        stats.total_size_bytes += metadata.len() as i64;
        if let Ok(modified) = metadata.modified() {
            if latest_modified.map_or(true, |current| modified > current) {
                latest_modified = Some(modified);
            }
        }

        if files.len() >= MAX_LISTED_FILES {
            truncated = true;
            continue;
        }

        let path = entry.path().to_path_buf();
        files.push(LocalFileEntry {
            name: path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            relative_path: path
                .strip_prefix(root)
                .unwrap_or(path.as_path())
                .to_string_lossy()
                .to_string(),
            extension: path
                .extension()
                .map(|ext| ext.to_string_lossy().to_ascii_lowercase()),
            size_bytes: metadata.len() as i64,
            modified_at: metadata.modified().ok().map(system_time_to_rfc3339),
            category: classify_file(&path),
            path: path.to_string_lossy().to_string(),
        });
    }

    stats.last_modified_at = latest_modified.map(system_time_to_rfc3339);
    (files, stats, truncated)
}

fn scan_stats(root: &Path, max_depth: usize) -> ScanStats {
    let (_, stats, _) = list_local_files(root, max_depth);
    stats
}

fn classify_file(path: &Path) -> String {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("md" | "markdown") => "markdown".to_string(),
        Some("json" | "jsonl") => "structured".to_string(),
        Some("yaml" | "yml" | "toml") => "config".to_string(),
        Some("txt" | "log") => "text".to_string(),
        Some("pdf") => "document".to_string(),
        Some("doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx") => "office".to_string(),
        _ => "other".to_string(),
    }
}

fn system_time_to_rfc3339(value: SystemTime) -> String {
    DateTime::<Utc>::from(value).to_rfc3339()
}

fn health_report(issues: Vec<HealthIssue>) -> HealthReport {
    let mut score = 100;
    for issue in &issues {
        score -= match issue.severity.as_str() {
            "critical" => 20,
            "error" => 12,
            "warning" => 6,
            _ => 2,
        };
    }

    HealthReport {
        score: score.max(0),
        issues,
        generated_at: Utc::now().to_rfc3339(),
    }
}

fn path_issue(
    severity: &str,
    source_name: &str,
    title: &str,
    asset: &AssetOverview,
) -> HealthIssue {
    HealthIssue {
        severity: severity.to_string(),
        source: source_name.to_string(),
        title: title.to_string(),
        resource_name: Some(asset.name.clone()),
        resource_path: asset.path.clone(),
        description: "记录中的本地路径不存在或当前不可访问。".to_string(),
        suggestion: "检查路径是否已移动；如已废弃，在对应页面更新或移除索引。".to_string(),
        status: "open".to_string(),
    }
}

async fn fetch_path(pool: &SqlitePool, table: &str, id: &str) -> Result<String, String> {
    let query = path_query(table)?;
    let row = sqlx::query(query)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "resource not found".to_string())?;
    row.try_get("path").map_err(|e| e.to_string())
}

async fn count_table(pool: &SqlitePool, table: &str) -> Result<i64, String> {
    let query = count_query(table)?;
    let row = sqlx::query(query)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    row.try_get("count").map_err(|e| e.to_string())
}

async fn usage_group(pool: &SqlitePool, column: &str) -> Result<Vec<UsageMetric>, String> {
    let query = match column {
        "resource_type" => {
            "SELECT resource_type as key, COUNT(*) as count FROM agent_resource_usage_events WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium') GROUP BY resource_type ORDER BY count DESC"
        }
        "action" => {
            "SELECT usage_kind as key, COUNT(*) as count FROM agent_resource_usage_events WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium') GROUP BY usage_kind ORDER BY count DESC"
        }
        _ => return Err(format!("unsupported usage group column: {column}")),
    };
    let rows = sqlx::query(query)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn usage_by_agent_client(pool: &SqlitePool) -> Result<Vec<UsageMetric>, String> {
    let rows = sqlx::query(
        r#"
        SELECT agent_client as key, COUNT(*) as count
        FROM agent_resource_usage_events
        WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium')
        GROUP BY agent_client
        ORDER BY count DESC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn usage_by_skill(pool: &SqlitePool) -> Result<Vec<UsageMetric>, String> {
    let rows = sqlx::query(
        r#"
        SELECT COALESCE(s.name, e.resource_name) as key, COUNT(*) as count
        FROM agent_resource_usage_events
        FROM agent_resource_usage_events e
        LEFT JOIN skills s ON e.resource_id = s.id
        WHERE e.resource_type = 'skill' AND e.event_source = 'log_inferred' AND e.confidence IN ('high', 'medium')
        GROUP BY COALESCE(e.resource_id, e.resource_name)
        ORDER BY count DESC
        LIMIT 10
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn usage_by_mcp_server(pool: &SqlitePool) -> Result<Vec<UsageMetric>, String> {
    let rows = sqlx::query(
        r#"
        SELECT COALESCE(ms.name, e.resource_name) as key, COUNT(*) as count
        FROM agent_resource_usage_events e
        LEFT JOIN mcp_servers ms ON e.resource_id = ms.id
        WHERE e.resource_type IN ('mcp_server', 'mcp_tool')
          AND e.event_source = 'log_inferred'
          AND e.confidence IN ('high', 'medium')
        GROUP BY COALESCE(e.resource_id, e.resource_name)
        ORDER BY count DESC
        LIMIT 10
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn usage_by_mcp_tool(pool: &SqlitePool) -> Result<Vec<UsageMetric>, String> {
    let rows = sqlx::query(
        r#"
        SELECT resource_name as key, COUNT(*) as count
        FROM agent_resource_usage_events
        WHERE resource_type = 'mcp_tool' AND event_source = 'log_inferred' AND confidence IN ('high', 'medium')
        GROUP BY resource_name
        ORDER BY count DESC
        LIMIT 10
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn skill_by_agent_matrix(pool: &SqlitePool) -> Result<Vec<MatrixCell>, String> {
    let rows = sqlx::query(
        r#"
        WITH top_skills AS (
            SELECT COALESCE(resource_id, resource_name) as rk, COUNT(*) as total
            FROM agent_resource_usage_events
            WHERE resource_type = 'skill' AND event_source = 'log_inferred' AND confidence IN ('high', 'medium')
            GROUP BY rk
            ORDER BY total DESC
            LIMIT 20
        )
        SELECT agent_client as agent, resource_name as resource, COUNT(*) as count
        FROM agent_resource_usage_events
        WHERE resource_type = 'skill' AND event_source = 'log_inferred' AND confidence IN ('high', 'medium')
          AND COALESCE(resource_id, resource_name) IN (SELECT rk FROM top_skills)
        GROUP BY agent_client, COALESCE(resource_id, resource_name)
        ORDER BY count DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| MatrixCell {
            agent: row.get("agent"),
            resource: row.get("resource"),
            count: row.get("count"),
        })
        .collect())
}

async fn mcp_by_agent_matrix(pool: &SqlitePool) -> Result<Vec<MatrixCell>, String> {
    let rows = sqlx::query(
        r#"
        WITH top_mcp AS (
            SELECT resource_name as rk, COUNT(*) as total
            FROM agent_resource_usage_events
            WHERE resource_type IN ('mcp_server', 'mcp_tool') AND event_source = 'log_inferred' AND confidence IN ('high', 'medium')
            GROUP BY resource_name
            ORDER BY total DESC
            LIMIT 20
        )
        SELECT agent_client as agent, resource_name as resource, COUNT(*) as count
        FROM agent_resource_usage_events
        WHERE resource_type IN ('mcp_server', 'mcp_tool') AND event_source = 'log_inferred' AND confidence IN ('high', 'medium')
          AND resource_name IN (SELECT rk FROM top_mcp)
        GROUP BY agent_client, resource_name
        ORDER BY count DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| MatrixCell {
            agent: row.get("agent"),
            resource: row.get("resource"),
            count: row.get("count"),
        })
        .collect())
}

async fn get_weekly_trend(pool: &SqlitePool) -> Result<Vec<UsageMetric>, String> {
    let rows = sqlx::query(
        r#"
        SELECT strftime('%Y-%m-%d', event_time) as key, COUNT(*) as count
        FROM agent_resource_usage_events
        WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium') AND event_time >= datetime('now', '-7 days')
        GROUP BY key
        ORDER BY key ASC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn get_monthly_trend(pool: &SqlitePool) -> Result<Vec<UsageMetric>, String> {
    let rows = sqlx::query(
        r#"
        SELECT strftime('%Y-%m-%d', event_time) as key, COUNT(*) as count
        FROM agent_resource_usage_events
        WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium') AND event_time >= datetime('now', '-30 days')
        GROUP BY key
        ORDER BY key ASC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn get_all_time_trend(pool: &SqlitePool) -> Result<Vec<UsageMetric>, String> {
    let span_row = sqlx::query(
        "SELECT MIN(event_time) as min_t, MAX(event_time) as max_t FROM agent_resource_usage_events WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium')"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let min_t: Option<String> = span_row.get("min_t");
    let max_t: Option<String> = span_row.get("max_t");

    let format = match (min_t, max_t) {
        (Some(min), Some(max)) => {
            let min_date = chrono::DateTime::parse_from_rfc3339(&min)
                .or_else(|_| chrono::DateTime::parse_from_str(&min, "%Y-%m-%dT%H:%M:%S%.fZ"));
            let max_date = chrono::DateTime::parse_from_rfc3339(&max)
                .or_else(|_| chrono::DateTime::parse_from_str(&max, "%Y-%m-%dT%H:%M:%S%.fZ"));
            if let (Ok(d1), Ok(d2)) = (min_date, max_date) {
                let days = (d2.signed_duration_since(d1)).num_days();
                if days <= 90 {
                    "%Y-%m-%d"
                } else if days <= 730 {
                    "%Y-%m"
                } else {
                    "%Y"
                }
            } else {
                "%Y-%m-%d"
            }
        }
        _ => "%Y-%m-%d",
    };

    let rows = match format {
        "%Y-%m-%d" => {
            sqlx::query(
                r#"
                SELECT strftime('%Y-%m-%d', event_time) as key, COUNT(*) as count
                FROM agent_resource_usage_events
                WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium')
                GROUP BY key
                ORDER BY key ASC
                "#,
            )
            .fetch_all(pool)
            .await
        }
        "%Y-%m" => {
            sqlx::query(
                r#"
                SELECT strftime('%Y-%m', event_time) as key, COUNT(*) as count
                FROM agent_resource_usage_events
                WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium')
                GROUP BY key
                ORDER BY key ASC
                "#,
            )
            .fetch_all(pool)
            .await
        }
        _ => {
            sqlx::query(
                r#"
                SELECT strftime('%Y', event_time) as key, COUNT(*) as count
                FROM agent_resource_usage_events
                WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium')
                GROUP BY key
                ORDER BY key ASC
                "#,
            )
            .fetch_all(pool)
            .await
        }
    }
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| UsageMetric {
            key: row.get("key"),
            count: row.get("count"),
        })
        .collect())
}

async fn recent_usage_events(pool: &SqlitePool) -> Result<Vec<UsageEvent>, String> {
    let rows = sqlx::query(
        r#"
        SELECT resource_type, COALESCE(resource_id, '') as resource_id, usage_kind as action, agent_client as source, event_time as created_at
        FROM agent_resource_usage_events
        WHERE event_source = 'log_inferred' AND confidence IN ('high', 'medium')
        ORDER BY event_time DESC
        LIMIT 50
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| UsageEvent {
            resource_type: row.get("resource_type"),
            resource_id: row.get("resource_id"),
            action: row.get("action"),
            source: Some(row.get::<String, _>("source")),
            created_at: row.get("created_at"),
        })
        .collect())
}

async fn resource_exists(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
) -> Result<bool, String> {
    let query = exists_query(resource_type)?;
    sqlx::query(query)
        .bind(resource_id)
        .fetch_optional(pool)
        .await
        .map(|row| row.is_some())
        .map_err(|e| e.to_string())
}

async fn fetch_resource_name(
    pool: &SqlitePool,
    resource_type: &str,
    resource_id: &str,
) -> Result<Option<String>, String> {
    let query = match name_query(resource_type) {
        Ok(query) => query,
        Err(_) => return Ok(None),
    };
    let row = sqlx::query(query)
        .bind(resource_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.map(|row| row.get("name")))
}

fn path_query(table: &str) -> Result<&'static str, String> {
    match table {
        "memory_sources" => Ok("SELECT path FROM memory_sources WHERE id = ?"),
        "knowledge_bases" => Ok("SELECT path FROM knowledge_bases WHERE id = ?"),
        "projects" => Ok("SELECT path FROM projects WHERE id = ?"),
        _ => Err(format!("unsupported table: {table}")),
    }
}

fn count_query(table: &str) -> Result<&'static str, String> {
    match table {
        "agents" => Ok("SELECT COUNT(*) as count FROM agents"),
        "skills" => Ok("SELECT COUNT(*) as count FROM skills"),
        "mcp_servers" => Ok("SELECT COUNT(*) as count FROM mcp_servers"),
        "memory_sources" => Ok("SELECT COUNT(*) as count FROM memory_sources"),
        "knowledge_bases" => Ok("SELECT COUNT(*) as count FROM knowledge_bases"),
        "projects" => Ok("SELECT COUNT(*) as count FROM projects"),
        _ => Err(format!("unsupported table: {table}")),
    }
}

fn exists_query(resource_type: &str) -> Result<&'static str, String> {
    match resource_type {
        "agent" => Ok("SELECT 1 FROM agents WHERE id = ? LIMIT 1"),
        "skill" => Ok("SELECT 1 FROM skills WHERE id = ? LIMIT 1"),
        "mcp_server" => Ok("SELECT 1 FROM mcp_servers WHERE id = ? LIMIT 1"),
        "memory_source" => Ok("SELECT 1 FROM memory_sources WHERE id = ? LIMIT 1"),
        "knowledge_base" => Ok("SELECT 1 FROM knowledge_bases WHERE id = ? LIMIT 1"),
        "project" => Ok("SELECT 1 FROM projects WHERE id = ? LIMIT 1"),
        _ => Err(format!("unsupported resource type: {resource_type}")),
    }
}

fn name_query(resource_type: &str) -> Result<&'static str, String> {
    match resource_type {
        "agent" => Ok("SELECT name FROM agents WHERE id = ? LIMIT 1"),
        "skill" => Ok("SELECT name FROM skills WHERE id = ? LIMIT 1"),
        "mcp_server" => Ok("SELECT name FROM mcp_servers WHERE id = ? LIMIT 1"),
        "memory_source" => Ok("SELECT name FROM memory_sources WHERE id = ? LIMIT 1"),
        "knowledge_base" => Ok("SELECT name FROM knowledge_bases WHERE id = ? LIMIT 1"),
        "project" => Ok("SELECT name FROM projects WHERE id = ? LIMIT 1"),
        _ => Err(format!("unsupported resource type: {resource_type}")),
    }
}

async fn append_agent_issues(
    pool: &SqlitePool,
    issues: &mut Vec<HealthIssue>,
) -> Result<(), String> {
    let rows = sqlx::query("SELECT name, type, app_path, config_path, status FROM agents")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    for row in rows {
        let name: String = row.get("name");
        let status: Option<String> = row.get("status");
        if status.as_deref() == Some("ignored") {
            continue;
        }
        let agent_type: Option<String> = row.get("type");
        let app_path: Option<String> = row.get("app_path");
        let config_path: Option<String> = row.get("config_path");
        if agent_type.as_deref() == Some("App")
            && app_path.as_deref().is_none_or(|p| !Path::new(p).exists())
        {
            issues.push(HealthIssue {
                severity: "error".to_string(),
                source: "Agent".to_string(),
                title: "Agent App 路径不可用".to_string(),
                resource_name: Some(name.clone()),
                resource_path: app_path,
                description: "该 Agent 标记为 App，但 app_path 缺失或不可访问。".to_string(),
                suggestion: "重新扫描 Applications，或手动更新 Agent App 路径。".to_string(),
                status: "open".to_string(),
            });
        }
        if let Some(config_path) = config_path {
            if !Path::new(&config_path).exists() {
                issues.push(HealthIssue {
                    severity: "warning".to_string(),
                    source: "Agent".to_string(),
                    title: "Agent 配置目录不可访问".to_string(),
                    resource_name: Some(name),
                    resource_path: Some(config_path),
                    description: "记录中的配置目录不存在或当前不可访问。".to_string(),
                    suggestion: "重新扫描 Agent 配置目录，或移除失效索引。".to_string(),
                    status: "open".to_string(),
                });
            }
        }
    }
    Ok(())
}

async fn append_skill_issues(
    pool: &SqlitePool,
    issues: &mut Vec<HealthIssue>,
) -> Result<(), String> {
    let rows =
        sqlx::query("SELECT name, path, status, needs_review, needs_improvement FROM skills")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
    for row in rows {
        let name: String = row.get("name");
        let path: String = row.get("path");
        let status: String = row.get("status");
        let needs_review: i64 = row.get("needs_review");
        let needs_improvement: i64 = row.get("needs_improvement");
        if !Path::new(&path).exists() {
            issues.push(HealthIssue {
                severity: "error".to_string(),
                source: "Skill".to_string(),
                title: "Skill 入口文件不存在".to_string(),
                resource_name: Some(name.clone()),
                resource_path: Some(path.clone()),
                description: "索引中的 Skill 文件已经移动或删除。".to_string(),
                suggestion: "重新扫描技能库，或删除失效索引。".to_string(),
                status: "open".to_string(),
            });
        }
        if status == "broken" || needs_review == 1 || needs_improvement == 1 {
            issues.push(HealthIssue {
                severity: "warning".to_string(),
                source: "Skill".to_string(),
                title: "Skill 需要人工复核".to_string(),
                resource_name: Some(name),
                resource_path: Some(path),
                description: "该 Skill 已标记为 broken、needs_review 或 needs_improvement。"
                    .to_string(),
                suggestion: "在 Skills 页面查看复核备注并完成整理。".to_string(),
                status: "open".to_string(),
            });
        }
    }
    Ok(())
}

async fn append_mcp_issues(pool: &SqlitePool, issues: &mut Vec<HealthIssue>) -> Result<(), String> {
    let rows = sqlx::query("SELECT name, command, source_path, status FROM mcp_servers")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    for row in rows {
        let name: String = row.get("name");
        let status: String = row.get("status");
        let command: Option<String> = row.get("command");
        let source_path: Option<String> = row.get("source_path");
        if status == "error" {
            issues.push(HealthIssue {
                severity: "error".to_string(),
                source: "MCP".to_string(),
                title: "MCP Server 状态异常".to_string(),
                resource_name: Some(name.clone()),
                resource_path: source_path.clone(),
                description: "该 MCP Server 已被标记为 error。".to_string(),
                suggestion: "检查配置文件、command、args 和环境变量脱敏后的配置摘要。".to_string(),
                status: "open".to_string(),
            });
        }
        if command.as_deref().is_none_or(str::is_empty) {
            issues.push(HealthIssue {
                severity: "warning".to_string(),
                source: "MCP".to_string(),
                title: "MCP Server 缺少启动命令".to_string(),
                resource_name: Some(name),
                resource_path: source_path,
                description: "该 MCP 记录没有 command，无法判断其运行方式。".to_string(),
                suggestion: "重新扫描来源配置，或在 MCP 页面补充说明后人工复核。".to_string(),
                status: "open".to_string(),
            });
        }
    }
    Ok(())
}

async fn append_path_issues(
    pool: &SqlitePool,
    source_name: &str,
    table: &str,
    issues: &mut Vec<HealthIssue>,
) -> Result<(), String> {
    let query = path_issue_query(table)?;
    let rows = sqlx::query(query)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    for row in rows {
        let name: String = row.get("name");
        let path: Option<String> = row.get("path");
        if let Some(path) = path {
            if !Path::new(&path).exists() {
                issues.push(HealthIssue {
                    severity: "error".to_string(),
                    source: source_name.to_string(),
                    title: format!("{source_name} 路径不可访问"),
                    resource_name: Some(name),
                    resource_path: Some(path),
                    description: "记录中的本地路径不存在或当前不可访问。".to_string(),
                    suggestion: "确认路径是否已移动；如已废弃，在对应页面更新或移除索引。"
                        .to_string(),
                    status: "open".to_string(),
                });
            }
        }
    }
    Ok(())
}

fn path_issue_query(table: &str) -> Result<&'static str, String> {
    match table {
        "memory_sources" => Ok("SELECT name, path FROM memory_sources"),
        "knowledge_bases" => Ok("SELECT name, path FROM knowledge_bases"),
        "projects" => Ok("SELECT name, path FROM projects"),
        _ => Err(format!("unsupported table: {table}")),
    }
}
