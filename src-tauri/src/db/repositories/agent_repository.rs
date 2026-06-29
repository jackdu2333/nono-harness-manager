use crate::models::agent::Agent;
use sqlx::SqlitePool;

pub async fn list_agents(pool: &SqlitePool) -> Result<Vec<Agent>, sqlx::Error> {
    sqlx::query_as::<_, Agent>("SELECT * FROM agents ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn add_agent(pool: &SqlitePool, agent: &Agent) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO agents (
            id, name, type, app_path, launch_command, config_path, default_workspace, status,
            launch_count, last_launched_at, created_at, updated_at,
            agent_key, cli_path, log_path, bundle_id, detection_source,
            confidence, evidence_json, is_user_confirmed, is_ignored, last_detected_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        "#,
    )
    .bind(&agent.id)
    .bind(&agent.name)
    .bind(&agent.r#type)
    .bind(&agent.app_path)
    .bind(&agent.launch_command)
    .bind(&agent.config_path)
    .bind(&agent.default_workspace)
    .bind(&agent.status)
    .bind(agent.launch_count)
    .bind(&agent.last_launched_at)
    .bind(&agent.created_at)
    .bind(&agent.updated_at)
    .bind(&agent.agent_key)
    .bind(&agent.cli_path)
    .bind(&agent.log_path)
    .bind(&agent.bundle_id)
    .bind(&agent.detection_source)
    .bind(&agent.confidence)
    .bind(&agent.evidence_json)
    .bind(agent.is_user_confirmed)
    .bind(agent.is_ignored)
    .bind(&agent.last_detected_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn upsert_agent_by_key(pool: &SqlitePool, agent: &Agent) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO agents (
            id, name, type, app_path, launch_command, config_path, default_workspace, status,
            launch_count, last_launched_at, created_at, updated_at,
            agent_key, cli_path, log_path, bundle_id, detection_source,
            confidence, evidence_json, is_user_confirmed, is_ignored, last_detected_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(agent_key) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            app_path = COALESCE(excluded.app_path, agents.app_path),
            cli_path = COALESCE(excluded.cli_path, agents.cli_path),
            log_path = COALESCE(excluded.log_path, agents.log_path),
            bundle_id = COALESCE(excluded.bundle_id, agents.bundle_id),
            detection_source = excluded.detection_source,
            confidence = excluded.confidence,
            evidence_json = excluded.evidence_json,
            last_detected_at = excluded.last_detected_at,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&agent.id)
    .bind(&agent.name)
    .bind(&agent.r#type)
    .bind(&agent.app_path)
    .bind(&agent.launch_command)
    .bind(&agent.config_path)
    .bind(&agent.default_workspace)
    .bind(&agent.status)
    .bind(agent.launch_count)
    .bind(&agent.last_launched_at)
    .bind(&agent.created_at)
    .bind(&agent.updated_at)
    .bind(&agent.agent_key)
    .bind(&agent.cli_path)
    .bind(&agent.log_path)
    .bind(&agent.bundle_id)
    .bind(&agent.detection_source)
    .bind(&agent.confidence)
    .bind(&agent.evidence_json)
    .bind(agent.is_user_confirmed)
    .bind(agent.is_ignored)
    .bind(&agent.last_detected_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_agent(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE agents SET status = 'ignored', is_ignored = 1 WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn confirm_candidate(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE agents SET is_user_confirmed = 1, status = 'active', updated_at = ? WHERE id = ?",
    )
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn ignore_candidate(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE agents SET is_ignored = 1, status = 'ignored', updated_at = ? WHERE id = ?",
    )
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}
