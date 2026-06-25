use tauri::{command, State};
use sqlx::SqlitePool;
use crate::models::mcp::McpServer;
use crate::db::mcp_repository;
use crate::scanner::mcp_scanner;
use crate::security::path_guard::validate_scan_root;

#[command]
pub async fn list_mcp_servers(pool: State<'_, SqlitePool>) -> Result<Vec<McpServer>, String> {
    mcp_repository::list_mcp_servers(&*pool).await
        .map(|servers| servers.into_iter().filter(|s| s.status.as_deref() != Some("ignored")).collect())
        .map_err(|e| e.to_string())
}

#[command]
pub async fn add_mcp_server(server: McpServer, pool: State<'_, SqlitePool>) -> Result<(), String> {
    mcp_repository::add_mcp_server(&*pool, &server).await.map_err(|e| e.to_string())
}

#[command]
pub async fn delete_mcp_server(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    mcp_repository::delete_mcp_server(&*pool, &id).await.map_err(|e| e.to_string())
}

#[command]
pub async fn scan_mcp_dir(path: String, pool: State<'_, SqlitePool>) -> Result<usize, String> {
    let safe_path = validate_scan_root(&path)?;
    let new_servers = mcp_scanner::scan_mcp_in_dir(safe_path.to_string_lossy().as_ref());
    let count = new_servers.len();
    
    for server in new_servers {
        let existing = mcp_repository::list_mcp_servers(&*pool).await.unwrap_or_default();
        if let Some(ignored) = existing.iter().find(|s| s.name == server.name && s.status.as_deref() == Some("ignored")) {
            let _ = sqlx::query("UPDATE mcp_servers SET status = 'active' WHERE id = ?")
                .bind(&ignored.id)
                .execute(&*pool)
                .await;
        } else if !existing.iter().any(|s| s.name == server.name) {
            let _ = mcp_repository::add_mcp_server(&*pool, &server).await;
        }
    }
    
    Ok(count)
}

#[command]
pub async fn discover_system_mcp(pool: State<'_, SqlitePool>) -> Result<usize, String> {
    let new_servers = mcp_scanner::discover_system_mcp();
    let count = new_servers.len();
    
    for server in new_servers {
        let existing = mcp_repository::list_mcp_servers(&*pool).await.unwrap_or_default();
        if !existing.iter().any(|s| s.name == server.name) {
            let _ = mcp_repository::add_mcp_server(&*pool, &server).await;
        }
    }
    
    Ok(count)
}
