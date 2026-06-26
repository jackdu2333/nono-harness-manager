use crate::models::skill::Skill;
use sqlx::SqlitePool;

pub async fn list_skills(pool: &SqlitePool) -> Result<Vec<Skill>, sqlx::Error> {
    sqlx::query_as::<_, Skill>("SELECT * FROM skills ORDER BY updated_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn insert_skill(pool: &SqlitePool, skill: &Skill) -> Result<(), sqlx::Error> {
    // Check if a skill with this path already exists
    let existing: Option<Skill> = sqlx::query_as::<_, Skill>("SELECT * FROM skills WHERE path = ?")
        .bind(&skill.path)
        .fetch_optional(pool)
        .await?;

    if let Some(existing_skill) = existing {
        // Scan should NEVER overwrite user/AI-curated metadata.
        // Only update file-level physical attributes (name, type, executable,
        // last_modified) that come from the filesystem. All metadata fields
        // (description, category, tags, summary, confidence, lifecycle flags,
        // improvement/review notes, etc.) are preserved from the existing row.
        sqlx::query(
            r#"
            UPDATE skills SET
                name = ?, skill_type = ?, is_executable = ?, last_modified_at = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&skill.name)
        .bind(&skill.skill_type)
        .bind(skill.is_executable)
        .bind(&skill.last_modified_at)
        .bind(&skill.updated_at)
        .bind(&existing_skill.id)
        .execute(pool)
        .await?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO skills (
                id, source_id, name, path, skill_type, category, subcategory, description, status,
                entry_file, metadata_path, has_metadata, is_executable, total_usage_count,
                last_used_at, last_modified_at, created_at, updated_at,
                description_source, description_confidence, description_updated_at, description_is_manual,
                is_favorite, is_archived, needs_review, needs_improvement, duplicate_group_id,
                improvement_note, improvement_status, last_improved_at, review_note, reviewed_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            "#
        )
        .bind(&skill.id)
        .bind(&skill.source_id)
        .bind(&skill.name)
        .bind(&skill.path)
        .bind(&skill.skill_type)
        .bind(&skill.category)
        .bind(&skill.subcategory)
        .bind(&skill.description)
        .bind(&skill.status)
        .bind(&skill.entry_file)
        .bind(&skill.metadata_path)
        .bind(skill.has_metadata)
        .bind(skill.is_executable)
        .bind(skill.total_usage_count)
        .bind(&skill.last_used_at)
        .bind(&skill.last_modified_at)
        .bind(&skill.created_at)
        .bind(&skill.updated_at)
        .bind(&skill.description_source)
        .bind(&skill.description_confidence)
        .bind(&skill.description_updated_at)
        .bind(skill.description_is_manual)
        // 0007 lifecycle/curation fields — explicit, not relying on migration defaults
        .bind(skill.is_favorite)
        .bind(skill.is_archived)
        .bind(skill.needs_review)
        .bind(skill.needs_improvement)
        .bind(&skill.duplicate_group_id)
        .bind(&skill.improvement_note)
        .bind(&skill.improvement_status)
        .bind(&skill.last_improved_at)
        .bind(&skill.review_note)
        .bind(&skill.reviewed_at)
        .execute(pool)
        .await?;
    }

    Ok(())
}
