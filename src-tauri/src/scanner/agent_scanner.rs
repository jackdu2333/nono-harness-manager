use crate::models::agent::Agent;
use crate::scanner::ignore_rules::build_walker;
use chrono::Utc;
use dirs;
use serde_json::json;
use std::path::Path;
use std::process::Command;
use uuid::Uuid;

// ── Agent Detector Registry ──────────────────────────────────────────────
// 已知客户端注册表，每个 detector 定义多信号匹配规则

struct AgentDetector {
    key: &'static str,
    display_name: &'static str,
    agent_type: &'static str, // "App" | "CLI" | "IDE Plugin" | "ConfigOnly"
    app_names: &'static [&'static str],
    bundle_ids: &'static [&'static str],
    cli_commands: &'static [&'static str],
    config_paths: &'static [&'static str],
    log_paths: &'static [&'static str],
    log_adapter_key: &'static str, // 映射到 log_scanner 的 adapter
}

const DETECTORS: &[AgentDetector] = &[
    AgentDetector {
        key: "codex",
        display_name: "Codex",
        agent_type: "CLI",
        app_names: &[],
        bundle_ids: &[],
        cli_commands: &["codex"],
        config_paths: &[".codex"],
        log_paths: &[".codex/sessions"],
        log_adapter_key: "codex",
    },
    AgentDetector {
        key: "claude_code",
        display_name: "Claude Code",
        agent_type: "CLI",
        app_names: &[],
        bundle_ids: &[],
        cli_commands: &["claude"],
        config_paths: &[".claude"],
        log_paths: &[".claude/projects"],
        log_adapter_key: "claude_code",
    },
    AgentDetector {
        key: "claude_desktop",
        display_name: "Claude Desktop",
        agent_type: "App",
        app_names: &["Claude.app"],
        bundle_ids: &["com.anthropic.claudefordesktop"],
        cli_commands: &[],
        config_paths: &["Library/Application Support/Claude"],
        log_paths: &[],
        log_adapter_key: "",
    },
    AgentDetector {
        key: "cursor",
        display_name: "Cursor",
        agent_type: "App",
        app_names: &["Cursor.app"],
        bundle_ids: &["com.todesktop.230313mzl4w4u92"],
        cli_commands: &["cursor"],
        config_paths: &["Library/Application Support/Cursor"],
        log_paths: &[],
        log_adapter_key: "",
    },
    AgentDetector {
        key: "windsurf",
        display_name: "Windsurf",
        agent_type: "App",
        app_names: &["Windsurf.app"],
        bundle_ids: &["com.codeium.windsurf"],
        cli_commands: &["windsurf"],
        config_paths: &["Library/Application Support/Windsurf"],
        log_paths: &[],
        log_adapter_key: "",
    },
    AgentDetector {
        key: "workbuddy",
        display_name: "WorkBuddy",
        agent_type: "App",
        app_names: &[],
        bundle_ids: &[],
        cli_commands: &[],
        config_paths: &["Library/Application Support/WorkBuddyExtension"],
        log_paths: &[".workbuddy/traces"],
        log_adapter_key: "workbuddy",
    },
    AgentDetector {
        key: "newmax",
        display_name: "Newmax",
        agent_type: "CLI",
        app_names: &[],
        bundle_ids: &[],
        cli_commands: &[],
        config_paths: &[".newmax"],
        log_paths: &[".newmax/projects"],
        log_adapter_key: "newmax",
    },
    AgentDetector {
        key: "antigravity",
        display_name: "Antigravity Core",
        agent_type: "App",
        app_names: &["Antigravity.app"],
        bundle_ids: &["com.google.antigravity"],
        cli_commands: &[],
        config_paths: &[".gemini/antigravity"],
        log_paths: &[".gemini/antigravity/brain"],
        log_adapter_key: "antigravity",
    },
    AgentDetector {
        key: "antigravity_cli",
        display_name: "Antigravity CLI",
        agent_type: "CLI",
        app_names: &[],
        bundle_ids: &[],
        cli_commands: &[],
        config_paths: &[".gemini/antigravity-cli"],
        log_paths: &[],
        log_adapter_key: "",
    },
    AgentDetector {
        key: "antigravity_ide",
        display_name: "Antigravity IDE Plugin",
        agent_type: "IDE Plugin",
        app_names: &[],
        bundle_ids: &[],
        cli_commands: &[],
        config_paths: &[".gemini/antigravity-ide"],
        log_paths: &[],
        log_adapter_key: "",
    },
];

/// 单个 agent 的发现结果
struct DetectionResult {
    detector_key: &'static str,
    detector_display_name: &'static str,
    detector_type: &'static str,
    detector_log_adapter_key: &'static str,
    app_path: Option<String>,
    cli_path: Option<String>,
    config_path: Option<String>,
    log_path: Option<String>,
    bundle_id: Option<String>,
    evidence: Vec<String>,
    confidence: &'static str, // "verified" | "probable" | "candidate"
    detection_source: &'static str,
}

fn expand_home(rel: &str) -> Option<String> {
    let home = dirs::home_dir()?;
    Some(home.join(rel).to_string_lossy().to_string())
}

/// 检查 CLI 命令是否在 PATH 中可找到，返回完整路径
fn find_cli(command: &str) -> Option<String> {
    let output = Command::new("which").arg("-a").arg(command).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().next().map(|s| s.trim().to_string())
}

/// 读取 .app 的 Info.plist bundle identifier
fn read_bundle_id(app_path: &Path) -> Option<String> {
    let plist_path = app_path.join("Contents/Info.plist");
    if !plist_path.exists() {
        return None;
    }
    let output = Command::new("defaults")
        .arg("read")
        .arg(plist_path.to_string_lossy().as_ref())
        .arg("CFBundleIdentifier")
        .output()
        .ok()?;
    if output.status.success() {
        let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !id.is_empty() {
            return Some(id);
        }
    }
    None
}

fn run_detection(detector: &AgentDetector) -> Option<DetectionResult> {
    let home = dirs::home_dir()?;
    let mut evidence = Vec::new();
    let mut app_path = None;
    let mut cli_path = None;
    let mut config_path = None;
    let mut log_path = None;
    let mut bundle_id = None;

    // 1. Check App in /Applications or ~/Applications
    for app_name in detector.app_names {
        for apps_dir in &[
            "/Applications",
            &format!("{}/Applications", home.to_string_lossy()),
        ] {
            let full_path = format!("{}/{}", apps_dir, app_name);
            if Path::new(&full_path).exists() {
                app_path = Some(full_path.clone());
                evidence.push(format!("发现 App: {}", full_path));
                if let Some(bid) = read_bundle_id(Path::new(&full_path)) {
                    bundle_id = Some(bid.clone());
                    evidence.push(format!("Bundle ID: {}", bid));
                }
                break;
            }
        }
    }

    // 2. Check CLI command
    for cmd in detector.cli_commands {
        if let Some(found) = find_cli(cmd) {
            cli_path = Some(found.clone());
            evidence.push(format!("发现 CLI: {} -> {}", cmd, found));
            break;
        }
    }

    // 3. Check config paths
    for cfg in detector.config_paths {
        if let Some(full) = expand_home(cfg) {
            if Path::new(&full).exists() {
                config_path = Some(full.clone());
                evidence.push(format!("发现配置目录: {}", full));
                break;
            }
        }
    }

    // 4. Check log paths
    for lp in detector.log_paths {
        if let Some(full) = expand_home(lp) {
            if Path::new(&full).exists() {
                log_path = Some(full.clone());
                evidence.push(format!("发现日志目录: {}", full));
                break;
            }
        }
    }

    // 5. Determine confidence
    let has_app = app_path.is_some();
    let has_cli = cli_path.is_some();
    let has_config = config_path.is_some();
    let has_log = log_path.is_some();

    let (confidence, detection_source) = if has_app || has_cli {
        ("verified", "app_or_cli")
    } else if has_config && has_log {
        ("probable", "config_and_log")
    } else if has_config || has_log {
        ("candidate", "config_or_log")
    } else {
        // Nothing found
        return None;
    };

    Some(DetectionResult {
        detector_key: detector.key,
        detector_display_name: detector.display_name,
        detector_type: detector.agent_type,
        detector_log_adapter_key: detector.log_adapter_key,
        app_path,
        cli_path,
        config_path,
        log_path,
        bundle_id,
        evidence,
        confidence,
        detection_source,
    })
}

fn result_to_agent(result: &DetectionResult, now: &str) -> Agent {
    let evidence_json = json!({
        "signals": &result.evidence,
        "confidence": result.confidence,
    })
    .to_string();

    // launch_command: App 用 open -a, CLI 不可自动启动
    let launch_command = if result.app_path.is_some() {
        Some(format!("open -a {}", result.detector_display_name))
    } else {
        None
    };

    // status: verified/probable 入 active, candidate 入 pending
    let status = match result.confidence {
        "verified" | "probable" => "active",
        "candidate" => "pending",
        _ => "pending",
    };

    Agent {
        id: Uuid::new_v4().to_string(),
        name: result.detector_display_name.to_string(),
        r#type: Some(result.detector_type.to_string()),
        app_path: result.app_path.clone(),
        launch_command,
        config_path: result.config_path.clone(),
        default_workspace: None,
        status: Some(status.to_string()),
        launch_count: 0,
        last_launched_at: None,
        created_at: now.to_string(),
        updated_at: now.to_string(),
        agent_key: Some(result.detector_key.to_string()),
        cli_path: result.cli_path.clone(),
        log_path: result.log_path.clone(),
        bundle_id: result.bundle_id.clone(),
        detection_source: Some(result.detection_source.to_string()),
        confidence: Some(result.confidence.to_string()),
        evidence_json: Some(evidence_json),
        is_user_confirmed: false,
        is_ignored: false,
        last_detected_at: Some(now.to_string()),
    }
}

/// Auto-discover agents using the detector registry
/// 自动发现本机 Agent 客户端，基于已知注册表 + 多信号验证 + 置信度
pub fn auto_discover_agents() -> Vec<Agent> {
    let now = Utc::now().to_rfc3339();
    let mut results = Vec::new();

    for detector in DETECTORS {
        if let Some(detection) = run_detection(detector) {
            results.push(result_to_agent(&detection, &now));
        }
    }

    results
}

/// Scan a directory for agent config files (legacy/manual scan)
/// 扫描指定目录内的 agent 配置文件，用于手动添加
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
                        r#type: Some("ConfigOnly".to_string()),
                        app_path: None,
                        launch_command: None,
                        config_path: Some(path_str.clone()),
                        default_workspace: Some(parent_dir),
                        status: Some("pending".to_string()),
                        launch_count: 0,
                        last_launched_at: None,
                        created_at: now.clone(),
                        updated_at: now,
                        agent_key: None,
                        cli_path: None,
                        log_path: None,
                        bundle_id: None,
                        detection_source: Some("manual_scan".to_string()),
                        confidence: Some("candidate".to_string()),
                        evidence_json: Some(
                            json!({ "signals": [format!("手动扫描发现配置文件: {}", file_name)] })
                                .to_string(),
                        ),
                        is_user_confirmed: false,
                        is_ignored: false,
                        last_detected_at: None,
                    });
                }
            }
        }
    }
    discovered_agents
}
