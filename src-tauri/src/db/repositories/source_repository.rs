use crate::models::source::SkillSource;
use sqlx::SqlitePool;

pub async fn list_sources(pool: &SqlitePool) -> Result<Vec<SkillSource>, sqlx::Error> {
    sqlx::query_as::<_, SkillSource>("SELECT * FROM skill_sources ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn add_source(pool: &SqlitePool, source: &SkillSource) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO skill_sources (id, name, path, source_type, enabled, scan_depth, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&source.id)
    .bind(&source.name)
    .bind(&source.path)
    .bind(&source.source_type)
    .bind(source.enabled)
    .bind(source.scan_depth)
    .bind(&source.created_at)
    .bind(&source.updated_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_source(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM skill_sources WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_source(pool: &SqlitePool, source: &SkillSource) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE skill_sources 
        SET name = ?, path = ?, source_type = ?, enabled = ?, scan_depth = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&source.name)
    .bind(&source.path)
    .bind(&source.source_type)
    .bind(source.enabled)
    .bind(source.scan_depth)
    .bind(&source.updated_at)
    .bind(&source.id)
    .execute(pool)
    .await?;

    Ok(())
}
