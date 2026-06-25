use crate::models::mcp::McpServer;
use crate::scanner::ignore_rules::build_walker;
use chrono::Utc;
use serde_json::Value;
use std::fs;
use std::path::Path;
use uuid::Uuid;

pub fn scan_mcp_in_dir(path: &str) -> Vec<McpServer> {
    let walker = build_walker(Path::new(path), 3);
    let mut discovered = Vec::new();
    let now = Utc::now().to_rfc3339();

    for result in walker {
        if let Ok(entry) = result {
            if entry.file_type().map_or(false, |ft| ft.is_file()) {
                let file_name = entry.file_name().to_string_lossy().to_lowercase();

                // 1. package.json for standard JS/TS MCP projects
                if file_name == "package.json" {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<Value>(&content) {
                            let has_mcp = json
                                .get("dependencies")
                                .and_then(|d| d.get("@modelcontextprotocol/sdk"))
                                .is_some();

                            if has_mcp {
                                let name = json
                                    .get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Unnamed MCP")
                                    .to_string();
                                let description = json
                                    .get("description")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string());
                                let parent_dir = entry
                                    .path()
                                    .parent()
                                    .unwrap_or(Path::new(""))
                                    .to_string_lossy()
                                    .to_string();

                                discovered.push(McpServer {
                                    id: Uuid::new_v4().to_string(),
                                    name,
                                    description,
                                    category: Some("Local Package".to_string()),
                                    command: "node".to_string(),
                                    args: Some(
                                        serde_json::to_string(&vec!["build/index.js"]).unwrap(),
                                    ),
                                    env: None,
                                    source_path: Some(parent_dir),
                                    summary: None,
                                    tags: None,
                                    confidence: None,
                                    evidence_files: None,
                                    manual_override: Some(0),
                                    last_analyzed_at: None,
                                    status: Some("active".to_string()),
                                    created_at: now.clone(),
                                    updated_at: now.clone(),
                                });
                            }
                        }
                    }
                }
                // 2. Direct MCP Config Files
                else if file_name == "mcp.json"
                    || file_name == "mcp_config.json"
                    || file_name == "claude_desktop_config.json"
                {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<Value>(&content) {
                            if let Some(mcp_servers) =
                                json.get("mcpServers").and_then(|v| v.as_object())
                            {
                                for (name, config) in mcp_servers {
                                    let command = config
                                        .get("command")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let args = config.get("args").map(|v| v.to_string());
                                    let env = config.get("env").map(|v| {
                                        if let Value::Object(map) = v {
                                            let mut masked = serde_json::Map::new();
                                            for (k, _) in map {
                                                masked.insert(
                                                    k.clone(),
                                                    Value::String("***".to_string()),
                                                );
                                            }
                                            serde_json::to_string(&Value::Object(masked))
                                                .unwrap_or_default()
                                        } else {
                                            v.to_string()
                                        }
                                    });

                                    if !command.is_empty() {
                                        discovered.push(McpServer {
                                            id: Uuid::new_v4().to_string(),
                                            name: name.clone(),
                                            description: Some(format!(
                                                "From {}",
                                                entry.file_name().to_string_lossy()
                                            )),
                                            category: Some("Parsed Config".to_string()),
                                            command,
                                            args,
                                            env,
                                            source_path: Some(
                                                entry.path().to_string_lossy().to_string(),
                                            ),
                                            summary: None,
                                            tags: None,
                                            confidence: None,
                                            evidence_files: None,
                                            manual_override: Some(0),
                                            last_analyzed_at: None,
                                            status: Some("active".to_string()),
                                            created_at: now.clone(),
                                            updated_at: now.clone(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    discovered
}

pub fn discover_system_mcp() -> Vec<McpServer> {
    let mut discovered = Vec::new();
    let now = Utc::now().to_rfc3339();
    let home = dirs::home_dir().unwrap_or_default();

    // Potential config files
    let config_paths = vec![
        home.join("Library/Application Support/Claude/claude_desktop_config.json"),
        home.join("Library/Application Support/QoderCN/SharedClientCache/mcp.json"),
        home.join("Library/Application Support/CherryStudio/.claude/.claude.json"),
        home.join("Library/Application Support/CherryStudio/mcp.json"),
        home.join(
            "Library/Application Support/WorkBuddyExtension/Data/default/VSCode_mcp_oauth.json",
        ),
        home.join(".gemini/config/mcp_config.json"),
        home.join(".gemini/antigravity/mcp_config.json"),
        home.join(".claude.json"),
        home.join(".codex/.codex-global-state.json"),
    ];

    for config_path in config_paths {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                if let Some(mcp_servers) = json.get("mcpServers").and_then(|v| v.as_object()) {
                    for (name, config) in mcp_servers {
                        let command = config
                            .get("command")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let args = config.get("args").map(|v| v.to_string());
                        let env = config.get("env").map(|v| {
                            if let Value::Object(map) = v {
                                let mut masked = serde_json::Map::new();
                                for (k, _) in map {
                                    masked.insert(k.clone(), Value::String("***".to_string()));
                                }
                                serde_json::to_string(&Value::Object(masked)).unwrap_or_default()
                            } else {
                                v.to_string()
                            }
                        });

                        if !command.is_empty() {
                            // Extract app name from path roughly
                            let source_app = if config_path.to_string_lossy().contains("Claude") {
                                "Claude Desktop"
                            } else if config_path.to_string_lossy().contains(".claude.json") {
                                "Claude Code CLI"
                            } else if config_path.to_string_lossy().contains("QoderCN") {
                                "QoderCN"
                            } else if config_path.to_string_lossy().contains("CherryStudio") {
                                "CherryStudio"
                            } else if config_path.to_string_lossy().contains("WorkBuddy") {
                                "WorkBuddy"
                            } else if config_path.to_string_lossy().contains(".codex") {
                                "Codex"
                            } else if config_path.to_string_lossy().contains(".gemini") {
                                "NoNo Platform"
                            } else {
                                "System Config"
                            };

                            discovered.push(McpServer {
                                id: Uuid::new_v4().to_string(),
                                name: name.clone(),
                                description: Some(format!("Imported from {}", source_app)),
                                category: Some("System Config".to_string()),
                                command,
                                args,
                                env,
                                source_path: Some(config_path.to_string_lossy().to_string()),
                                summary: None,
                                tags: None,
                                confidence: None,
                                evidence_files: None,
                                manual_override: Some(0),
                                last_analyzed_at: None,
                                status: Some("active".to_string()),
                                created_at: now.clone(),
                                updated_at: now.clone(),
                            });
                        }
                    }
                }
            }
        }
    }

    discovered
}
