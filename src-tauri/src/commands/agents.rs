use crate::models::agent::Agent;
use crate::db::repositories::agent_repository;
use crate::scanner::agent_scanner::scan_agents_in_dir as scan_logic;
use sqlx::SqlitePool;
use tauri::{State, command};
use uuid::Uuid;
use chrono::Utc;

#[command]
pub async fn list_agents(pool: State<'_, SqlitePool>) -> Result<Vec<Agent>, String> {
    agent_repository::list_agents(&*pool).await
        .map(|agents| agents.into_iter().filter(|a| a.status.as_deref() != Some("ignored")).collect())
        .map_err(|e| e.to_string())
}

#[command]
pub async fn add_agent(
    name: String,
    agent_type: Option<String>,
    app_path: Option<String>,
    config_path: Option<String>,
    default_workspace: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Agent, String> {
    let now = Utc::now().to_rfc3339();
    let agent = Agent {
        id: Uuid::new_v4().to_string(),
        name,
        r#type: agent_type,
        app_path,
        launch_command: None,
        config_path,
        default_workspace,
        status: Some("active".to_string()),
        launch_count: 0,
        last_launched_at: None,
        created_at: now.clone(),
        updated_at: now,
    };
    agent_repository::add_agent(&*pool, &agent).await.map_err(|e| e.to_string())?;
    Ok(agent)
}

#[command]
pub async fn delete_agent(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    agent_repository::delete_agent(&*pool, &id).await.map_err(|e| e.to_string())
}

#[command]
pub async fn scan_agents_in_dir(path: String, pool: State<'_, SqlitePool>) -> Result<usize, String> {
    let new_agents = scan_logic(&path);
    let count = new_agents.len();
    
    for agent in new_agents {
        let existing = agent_repository::list_agents(&*pool).await.unwrap_or_default();
        if let Some(ignored) = existing.iter().find(|a| a.name == agent.name && a.status.as_deref() == Some("ignored")) {
            // Reactivate ignored agent
            let _ = sqlx::query("UPDATE agents SET status = 'active' WHERE id = ?")
                .bind(&ignored.id)
                .execute(&*pool)
                .await;
        } else if !existing.iter().any(|a| a.name == agent.name) {
            let _ = agent_repository::add_agent(&*pool, &agent).await;
        }
    }
    
    Ok(count)
}

#[command]
pub async fn scan_system_agents(pool: State<'_, SqlitePool>) -> Result<usize, String> {
    let new_agents = crate::scanner::agent_scanner::auto_discover_agents();
    let count = new_agents.len();
    
    for agent in new_agents {
        // Simple logic: if agent with same name exists, we could skip or update.
        // For MVP, just add if we don't have a conflict by name.
        // Let's just add them. A real app would upsert.
        let existing = agent_repository::list_agents(&*pool).await.unwrap_or_default();
        if !existing.iter().any(|a| a.name == agent.name) {
            let _ = agent_repository::add_agent(&*pool, &agent).await;
        }
    }
    
    Ok(count)
}

#[command]
pub async fn launch_agent(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    // Find agent
    let agents = agent_repository::list_agents(&*pool).await.map_err(|e| e.to_string())?;
    let agent = agents.into_iter().find(|a| a.id == id).ok_or("Agent not found")?;
    
    if let Some(cmd) = agent.launch_command {
        // Execute the command in the background
        std::process::Command::new("sh")
            .arg("-c")
            .arg(&cmd)
            .spawn()
            .map_err(|e| format!("Failed to launch agent: {}", e))?;
            
        // TODO: Update launch_count and last_launched_at in DB
    } else {
        return Err("No launch command configured for this agent".to_string());
    }
    
    Ok(())
}

#[command]
pub async fn open_config_dir(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    let agents = agent_repository::list_agents(&*pool).await.map_err(|e| e.to_string())?;
    let agent = agents.into_iter().find(|a| a.id == id).ok_or("Agent not found")?;
    
    if let Some(path_str) = agent.config_path {
        let path = std::path::Path::new(&path_str);
        let dir_to_open = if path.is_file() {
            path.parent().unwrap_or(path)
        } else {
            path
        };
        
        std::process::Command::new("open")
            .arg(dir_to_open)
            .spawn()
            .map_err(|e| format!("Failed to open config dir: {}", e))?;
    } else {
        return Err("No config path configured for this agent".to_string());
    }
    
    Ok(())
}
