use sqlx::{SqlitePool, Error};
use crate::models::mcp::McpServer;

pub async fn add_mcp_server(pool: &SqlitePool, server: &McpServer) -> Result<(), Error> {
    sqlx::query(
        r#"
        INSERT INTO mcp_servers (id, name, description, category, command, args, env, source_path, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&server.id)
    .bind(&server.name)
    .bind(&server.description)
    .bind(&server.category)
    .bind(&server.command)
    .bind(&server.args)
    .bind(&server.env)
    .bind(&server.source_path)
    .bind(&server.status)
    .bind(&server.created_at)
    .bind(&server.updated_at)
    .execute(pool)
    .await?;
    
    Ok(())
}

pub async fn list_mcp_servers(pool: &SqlitePool) -> Result<Vec<McpServer>, Error> {
    let servers = sqlx::query_as::<_, McpServer>(
        r#"
        SELECT id, name, description, category, command, args, env, source_path, status, created_at, updated_at
        FROM mcp_servers
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;
    
    Ok(servers)
}

pub async fn delete_mcp_server(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE mcp_servers SET status = 'ignored' WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
