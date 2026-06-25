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
            launch_count, last_launched_at, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_agent(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE agents SET status = 'ignored' WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
