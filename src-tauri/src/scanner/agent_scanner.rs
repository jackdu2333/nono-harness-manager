use crate::models::agent::Agent;
use crate::scanner::ignore_rules::build_walker;
use chrono::Utc;
use dirs;
use std::fs;
use std::path::Path;
use uuid::Uuid;

pub fn scan_agents_in_dir(path: &str) -> Vec<Agent> {
    let walker = build_walker(Path::new(path), 3);
    let mut discovered_agents = Vec::new();

    for result in walker {
        if let Ok(entry) = result {
            if entry.file_type().map_or(false, |ft| ft.is_file()) {
                let file_name = entry.file_name().to_string_lossy().to_lowercase();
                let path_str = entry.path().to_string_lossy().to_string();
                let parent_dir = entry
                    .path()
                    .parent()
                    .unwrap_or(Path::new(""))
                    .to_string_lossy()
                    .to_string();

                if file_name == "agent.json"
                    || file_name == "config.yaml"
                    || file_name == "mcp.json"
                    || file_name == "settings.json"
                    || file_name == "mcp_config.json"
                {
                    let dir_name = Path::new(&parent_dir)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    let now = Utc::now().to_rfc3339();
                    discovered_agents.push(Agent {
                        id: Uuid::new_v4().to_string(),
                        name: dir_name,
                        r#type: Some("local_agent".to_string()),
                        app_path: Some(parent_dir.clone()),
                        launch_command: None,
                        config_path: Some(path_str.clone()),
                        default_workspace: Some(parent_dir),
                        status: Some("active".to_string()),
                        launch_count: 0,
                        last_launched_at: None,
                        created_at: now.clone(),
                        updated_at: now,
                    });
                }
            }
        }
    }
    discovered_agents
}

pub fn auto_discover_agents() -> Vec<Agent> {
    let mut discovered = Vec::new();
    let now = Utc::now().to_rfc3339();
    let home = dirs::home_dir().unwrap_or_default();

    // Helper macro to reduce boilerplate
    macro_rules! add_agent {
        ($id:expr, $name:expr, $type:expr, $app:expr, $cmd:expr, $cfg:expr) => {
            discovered.push(Agent {
                id: Uuid::new_v4().to_string(),
                name: $name.to_string(),
                r#type: Some($type.to_string()),
                app_path: Some($app.to_string()),
                launch_command: $cmd,
                config_path: $cfg,
                default_workspace: None,
                status: Some("active".to_string()),
                launch_count: 0,
                last_launched_at: None,
                created_at: now.clone(),
                updated_at: now.clone(),
            });
        };
    }

    // 1. Cursor
    let cursor_app = Path::new("/Applications/Cursor.app");
    if cursor_app.exists() {
        let config_path = home.join("Library/Application Support/Cursor/User/settings.json");
        add_agent!(
            "",
            "Cursor",
            "IDE",
            "/Applications/Cursor.app",
            Some("open -a Cursor".to_string()),
            if config_path.exists() {
                Some(config_path.to_string_lossy().to_string())
            } else {
                None
            }
        );
    }

    // 2. Claude Desktop
    let claude_app = Path::new("/Applications/Claude.app");
    if claude_app.exists() {
        let config_path =
            home.join("Library/Application Support/Claude/claude_desktop_config.json");
        add_agent!(
            "",
            "Claude Desktop",
            "App",
            "/Applications/Claude.app",
            Some("open -a Claude".to_string()),
            if config_path.exists() {
                Some(config_path.to_string_lossy().to_string())
            } else {
                None
            }
        );
    }

    // 3. Windsurf
    let windsurf_app = Path::new("/Applications/Windsurf.app");
    if windsurf_app.exists() {
        let config_path = home.join("Library/Application Support/Windsurf/User/settings.json");
        add_agent!(
            "",
            "Windsurf",
            "IDE",
            "/Applications/Windsurf.app",
            Some("open -a Windsurf".to_string()),
            if config_path.exists() {
                Some(config_path.to_string_lossy().to_string())
            } else {
                None
            }
        );
    }

    // 4. Codex CLI
    let codex_dir = home.join(".codex");
    if codex_dir.exists() {
        let config_path = codex_dir.join(".codex-global-state.json");
        add_agent!(
            "",
            "Codex",
            "CLI",
            codex_dir.to_string_lossy().to_string(),
            None,
            if config_path.exists() {
                Some(config_path.to_string_lossy().to_string())
            } else {
                None
            }
        );
    }

    // 5. Claude Code CLI
    let claude_cli_config = home.join(".claude.json");
    if claude_cli_config.exists() {
        add_agent!(
            "",
            "Claude Code",
            "CLI",
            home.join(".claude").to_string_lossy().to_string(),
            None,
            Some(claude_cli_config.to_string_lossy().to_string())
        );
    }

    // 6. Workbuddy
    let workbuddy_dir = home.join("Library/Application Support/WorkBuddyExtension");
    if workbuddy_dir.exists() {
        add_agent!(
            "",
            "Workbuddy",
            "App",
            workbuddy_dir.to_string_lossy().to_string(),
            None,
            None
        );
    }

    // 7. NoNo Harness CLI & Clients (Dynamic scan in ~/.gemini)
    let gemini_dir = home.join(".gemini");
    if let Ok(entries) = fs::read_dir(&gemini_dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    if dir_name == "config" || dir_name == "tmp" || dir_name.starts_with('.') {
                        continue;
                    }

                    let dir_path = entry.path();
                    let config_path = if dir_path.join("settings.json").exists() {
                        Some(dir_path.join("settings.json").to_string_lossy().to_string())
                    } else if dir_path.join("mcp_config.json").exists() {
                        Some(
                            dir_path
                                .join("mcp_config.json")
                                .to_string_lossy()
                                .to_string(),
                        )
                    } else if dir_path.join("agent.json").exists() {
                        Some(dir_path.join("agent.json").to_string_lossy().to_string())
                    } else if dir_path.join("config.yaml").exists() {
                        Some(dir_path.join("config.yaml").to_string_lossy().to_string())
                    } else {
                        None
                    };

                    let pretty_name = match dir_name.as_str() {
                        "antigravity" => "NoNo Agent Core",
                        "antigravity-cli" => "NoNo CLI",
                        "antigravity-ide" => "NoNo IDE Plugin",
                        "harness-manager" => "NoNo Harness",
                        _ => &dir_name,
                    }
                    .to_string();

                    if config_path.is_some() || dir_name.starts_with("antigravity") {
                        discovered.push(Agent {
                            id: Uuid::new_v4().to_string(),
                            name: pretty_name,
                            r#type: Some(if dir_name.contains("cli") {
                                "CLI".to_string()
                            } else if dir_name.contains("ide") {
                                "IDE Plugin".to_string()
                            } else {
                                "Agent".to_string()
                            }),
                            app_path: Some(dir_path.to_string_lossy().to_string()),
                            launch_command: None,
                            config_path,
                            default_workspace: Some(dir_path.to_string_lossy().to_string()),
                            status: Some("active".to_string()),
                            launch_count: 0,
                            last_launched_at: None,
                            created_at: now.clone(),
                            updated_at: now.clone(),
                        });
                    }
                }
            }
        }
    }

    discovered
}
