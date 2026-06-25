use crate::models::source::SkillSource;
use crate::models::skill::Skill;
use crate::db::repositories::{source_repository, skill_repository};
use crate::scanner::skill_scanner::scan_directory;
use crate::security::path_guard::validate_scan_root;
use sqlx::SqlitePool;
use tauri::{State, command};
use uuid::Uuid;
use chrono::Utc;

#[command]
pub async fn list_skill_sources(pool: State<'_, SqlitePool>) -> Result<Vec<SkillSource>, String> {
    source_repository::list_sources(&*pool).await.map_err(|e| e.to_string())
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
    
    let expanded_path = validate_scan_root(&path)?
        .to_string_lossy()
        .to_string();

    // Check if a source with this path already exists
    let existing_sources = source_repository::list_sources(&*pool).await.map_err(|e| e.to_string())?;
    if let Some(mut existing) = existing_sources.into_iter().find(|s| s.path == expanded_path) {
        existing.name = name;
        existing.source_type = source_type;
        existing.scan_depth = scan_depth;
        existing.updated_at = Utc::now().to_rfc3339();
        source_repository::update_source(&*pool, &existing).await.map_err(|e| e.to_string())?;
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
    source_repository::add_source(&*pool, &source).await.map_err(|e| e.to_string())?;
    Ok(source)
}

#[command]
pub async fn delete_skill_source(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    source_repository::delete_source(&*pool, &id).await.map_err(|e| e.to_string())
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
    skill_repository::list_skills(&*pool).await.map_err(|e| e.to_string())
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
        "#
    )
    .bind(&description)
    .bind(Utc::now().to_rfc3339())
    .bind(&skill_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
