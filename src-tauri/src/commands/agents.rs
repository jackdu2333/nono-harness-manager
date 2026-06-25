use crate::models::agent::Agent;
use crate::db::repositories::agent_repository;
use crate::scanner::agent_scanner::scan_agents_in_dir as scan_logic;
use crate::security::path_guard::validate_scan_root;
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
    let safe_path = validate_scan_root(&path)?;
    let new_agents = scan_logic(safe_path.to_string_lossy().as_ref());
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

    if !is_directly_launchable(agent.r#type.as_deref(), agent.app_path.as_deref(), agent.launch_command.as_deref()) {
        return Err("该 Agent 第一阶段不可安全启动，请配置为 macOS App 后再启动".to_string());
    }

    if let Some(app_path) = agent.app_path.as_deref().filter(|p| p.ends_with(".app")) {
        std::process::Command::new("open")
            .arg(app_path)
            .spawn()
            .map_err(|e| format!("Failed to launch agent: {}", e))?;
    } else if let Some(app_name) = parse_open_app_command(agent.launch_command.as_deref()) {
        std::process::Command::new("open")
            .arg("-a")
            .arg(app_name)
            .spawn()
            .map_err(|e| format!("Failed to launch agent: {}", e))?;
    } else {
        return Err("缺少可安全执行的启动方式".to_string());
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"
        UPDATE agents
        SET launch_count = launch_count + 1, last_launched_at = ?, updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(&now)
    .bind(&now)
    .bind(&agent.id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO resource_usage_events
          (id, resource_type, resource_id, agent_id, action, source, metadata, created_at)
        VALUES (?, 'agent', ?, ?, 'launch', 'agents_page', NULL, ?)
        "#
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&agent.id)
    .bind(&agent.id)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn is_directly_launchable(agent_type: Option<&str>, app_path: Option<&str>, launch_command: Option<&str>) -> bool {
    if matches!(agent_type, Some("CLI") | Some("IDE Plugin")) {
        return false;
    }

    app_path.is_some_and(|path| path.ends_with(".app"))
        || parse_open_app_command(launch_command).is_some()
}

fn parse_open_app_command(command: Option<&str>) -> Option<String> {
    let command = command?.trim();
    let app_name = command.strip_prefix("open -a ")?.trim();
    if app_name.is_empty() || app_name.contains([';', '&', '|', '`', '$', '>', '<']) {
        return None;
    }
    Some(app_name.trim_matches('"').to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cli_and_ide_plugin_agents_are_not_directly_launchable() {
        assert!(!is_directly_launchable(Some("CLI"), Some("/Users/jackdu/.codex"), None));
        assert!(!is_directly_launchable(Some("IDE Plugin"), Some("/Applications/Cursor.app"), Some("open -a Cursor")));
        assert!(is_directly_launchable(Some("App"), Some("/Applications/Cursor.app"), Some("open -a Cursor")));
    }
}
