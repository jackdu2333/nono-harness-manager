use chrono::Utc;
use serde_json::Value;
use sqlx::{Row, SqlitePool};
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;
use uuid::Uuid;
use walkdir::WalkDir;

// System default tools list that should not be classified as external MCP tools
// 系统默认的工具名单，这些工具不属于外部 MCP 统计范围
const SYSTEM_TOOLS: &[&str] = &[
    "view_file",
    "replace_file_content",
    "multi_replace_file_content",
    "write_to_file",
    "run_command",
    "list_dir",
    "grep_search",
    "read_url_content",
    "send_message",
    "invoke_subagent",
    "manage_subagents",
    "manage_task",
    "schedule",
    "list_permissions",
    "ask_permission",
    "ask_question",
    "define_subagent",
    "generate_image",
    "exec_command",
    "get_goal",
    "read_thread_terminal",
    "load_workspace_dependencies",
    "fork_thread",
    "handoff_thread",
    "get_handoff_status",
    "list_projects",
    "create_thread",
    "list_threads",
    "read_thread",
    "send_message_to_thread",
    "set_thread_pinned",
    "set_thread_archived",
    "set_thread_title",
    "automation_update",
    "Read",
    "Edit",
    "Write",
    "Bash",
    "Grep",
    "Glob",
    "Skill",
    "ToolSearch",
    "TaskCreate",
    "TaskUpdate",
    "TaskList",
    "TaskOutput",
    "TaskStop",
    "TodoWrite",
    "ExitPlanMode",
    "DeferExecuteTool",
    "SendMessage",
    "Agent",
    "AskUserQuestion",
    "WebFetch",
    "WebSearch",
    "open_result_view",
    "show_widget",
    "deliver_attachments",
    "present_files",
    "preview_url",
];

pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub name_lower: String,
    pub path: String,
}

pub struct McpInfo {
    pub id: String,
    pub name: String,
    pub name_lower: String,
}

pub struct InferredEvent {
    pub agent_session_id: Option<String>,
    pub resource_type: String, // 'skill', 'mcp_server', 'mcp_tool'
    pub resource_id: Option<String>,
    pub resource_name: String,
    pub usage_kind: String, // 'skill_invoked', 'skill_referenced', 'mcp_tool_called', 'mcp_server_used'
    pub confidence: String, // 'high', 'medium', 'low'
    pub evidence: String,
    pub source_offset: u64,
    pub event_time: String,
    pub metadata_json: Option<String>,
}

/// FNV-1a 64-bit hash algorithm for cross-lifecycle unique hash consistency
/// 自实现 64位 FNV-1a 哈希算法，确保跨生命周期事件排重哈希的绝对一致
pub fn fnv1a_hash(data: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in data.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)
}

/// Main entrance to trigger all log scanning adapters
/// 旁路日志增量扫描主入口
pub async fn scan_all_logs(pool: &SqlitePool) -> Result<(), String> {
    log::info!("[Log Scanner] Starting agent log bypass scan...");

    // 1. Fetch skills and mcp servers for mapping
    // 获取 Skills 和 MCP 以做映射
    let skill_rows = sqlx::query("SELECT id, name, path FROM skills")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let skills: Vec<SkillInfo> = skill_rows
        .into_iter()
        .map(|row| {
            let name: String = row.get("name");
            let name_lower = name.to_lowercase();
            SkillInfo {
                id: row.get("id"),
                name,
                name_lower,
                path: row.get("path"),
            }
        })
        .collect();

    // 1. Fetch MCP Servers
    // 获取已注册的 MCP 列表
    let mcp_rows = sqlx::query("SELECT id, name FROM mcp_servers")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mcp_servers: Vec<McpInfo> = mcp_rows
        .into_iter()
        .map(|row| {
            let name: String = row.get("name");
            let name_lower = name.to_lowercase();
            McpInfo {
                id: row.get("id"),
                name,
                name_lower,
            }
        })
        .collect();

    // 2. Fetch active agents
    // 获取当前激活的 Agent 客户端
    let agent_rows = sqlx::query("SELECT id, name, app_path FROM agents WHERE status = 'active'")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    for row in agent_rows {
        let agent_id: String = row.get("id");
        let agent_name: String = row.get("name");
        let app_path_opt: Option<String> = row.get("app_path");

        let Some(app_path_str) = app_path_opt else {
            continue;
        };

        let app_path = Path::new(&app_path_str);
        if !app_path.exists() {
            continue;
        }

        let agent_name_lower = agent_name.to_lowercase();

        // 3. Dispatch to Codex, Antigravity, or other adapters
        // 分发到不同的日志适配器进行处理
        if agent_name_lower.contains("antigravity")
            || agent_name_lower.contains("nono agent")
            || agent_name_lower.contains("nono cli")
        {
            let brain_path = app_path.join("brain");
            if brain_path.exists() {
                if let Err(e) =
                    scan_antigravity(pool, &brain_path, &agent_id, &skills, &mcp_servers).await
                {
                    log::error!(
                        "[Log Scanner] AntigravityAdapter failed for {}: {}",
                        agent_name,
                        e
                    );
                }
            }
        } else if agent_name_lower.contains("codex") {
            let sessions_path = app_path.join("sessions");
            if sessions_path.exists() {
                if let Err(e) =
                    scan_codex(pool, &sessions_path, &agent_id, &skills, &mcp_servers).await
                {
                    log::error!(
                        "[Log Scanner] CodexAdapter failed for {}: {}",
                        agent_name,
                        e
                    );
                }
            }
        } else if agent_name_lower.contains("workbuddy") {
            if let Some(home) = dirs::home_dir() {
                let traces_path = home.join(".workbuddy/traces");
                if traces_path.exists() {
                    if let Err(e) =
                        scan_workbuddy(pool, &traces_path, &agent_id, &skills, &mcp_servers).await
                    {
                        log::error!(
                            "[Log Scanner] WorkBuddyAdapter failed for {}: {}",
                            agent_name,
                            e
                        );
                    }
                }
            }
        } else if agent_name_lower.contains("newmax") {
            let projects_path = app_path.join("projects");
            if projects_path.exists() {
                if let Err(e) =
                    scan_newmax(pool, &projects_path, &agent_id, &skills, &mcp_servers).await
                {
                    log::error!(
                        "[Log Scanner] NewmaxAdapter failed for {}: {}",
                        agent_name,
                        e
                    );
                }
            }
        } else {
            // Placeholder for ClaudeCodeLogAdapter / WorkBuddyLogAdapter
            // 占位以兼容未来增加的客户端适配器
            log::info!(
                "[Log Scanner] Adapter placeholder hit for agent: {}",
                agent_name
            );
        }
    }

    log::info!("[Log Scanner] Agent log bypass scan finished.");
    Ok(())
}

/// Recursively find and scan Newmax JSONL session logs
/// 递归检索并扫描 Newmax 的 Claude-compatible JSONL 会话日志
async fn scan_newmax(
    pool: &SqlitePool,
    projects_path: &Path,
    agent_id: &str,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    for entry in WalkDir::new(projects_path)
        .max_depth(5)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != ".git" && name != "node_modules"
        })
        .flatten()
    {
        let file_name = entry.file_name().to_string_lossy();
        if entry.file_type().is_file() && file_name.ends_with(".jsonl") {
            let file_path = entry.path().to_string_lossy().to_string();
            let session_id = file_name
                .strip_suffix(".jsonl")
                .map(|s| s.to_string())
                .filter(|s| !s.starts_with("agent-"));

            if let Err(e) = parse_newmax_log(
                pool,
                &file_path,
                agent_id,
                session_id.as_deref(),
                skills,
                mcp_servers,
            )
            .await
            {
                log::warn!("[Log Scanner] Parse error at {}: {}", file_path, e);
            }
        }
    }
    Ok(())
}

/// Recursively find and scan WorkBuddy trace files
/// 递归检索并扫描 WorkBuddy 的结构化 trace 文件
async fn scan_workbuddy(
    pool: &SqlitePool,
    traces_path: &Path,
    agent_id: &str,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    for entry in WalkDir::new(traces_path)
        .max_depth(3)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != ".git" && name != "node_modules"
        })
        .flatten()
    {
        let file_name = entry.file_name().to_string_lossy();
        if entry.file_type().is_file()
            && file_name.starts_with("trace_")
            && file_name.ends_with(".json")
        {
            let file_path = entry.path().to_string_lossy().to_string();
            if let Err(e) =
                parse_workbuddy_trace(pool, &file_path, agent_id, skills, mcp_servers).await
            {
                log::warn!("[Log Scanner] Parse error at {}: {}", file_path, e);
            }
        }
    }
    Ok(())
}

/// Recursively find and scan Antigravity transcript files
/// 递归检索并扫描 Antigravity 的日志
async fn scan_antigravity(
    pool: &SqlitePool,
    brain_path: &Path,
    agent_id: &str,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    for entry in WalkDir::new(brain_path)
        .max_depth(4)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != ".git" && name != "node_modules"
        })
        .flatten()
    {
        if entry.file_type().is_file() && entry.file_name() == "transcript.jsonl" {
            let file_path = entry.path().to_string_lossy().to_string();
            // Infer session_id from directory name
            let session_id = entry
                .path()
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.file_name())
                .map(|name| name.to_string_lossy().to_string());

            if let Err(e) = parse_antigravity_log(
                pool,
                &file_path,
                agent_id,
                session_id.as_deref(),
                skills,
                mcp_servers,
            )
            .await
            {
                log::warn!("[Log Scanner] Parse error at {}: {}", file_path, e);
            }
        }
    }
    Ok(())
}

/// Recursively find and scan Codex rollout files
/// 递归检索并扫描 Codex 的会话日志
async fn scan_codex(
    pool: &SqlitePool,
    sessions_path: &Path,
    agent_id: &str,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    for entry in WalkDir::new(sessions_path)
        .max_depth(5)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != ".git" && name != "node_modules"
        })
        .flatten()
    {
        let file_name = entry.file_name().to_string_lossy();
        if entry.file_type().is_file()
            && file_name.starts_with("rollout-")
            && file_name.ends_with(".jsonl")
        {
            let file_path = entry.path().to_string_lossy().to_string();
            // Parse session_id from filename or rollout payload
            let session_id = file_name
                .strip_prefix("rollout-")
                .and_then(|s| s.strip_suffix(".jsonl"))
                .map(|s| s.to_string());

            if let Err(e) = parse_codex_log(
                pool,
                &file_path,
                agent_id,
                session_id.as_deref(),
                skills,
                mcp_servers,
            )
            .await
            {
                log::warn!("[Log Scanner] Parse error at {}: {}", file_path, e);
            }
        }
    }
    Ok(())
}

/// Incrementally parse Antigravity transcript
/// 增量解析单个 Antigravity 日志文件
async fn parse_antigravity_log(
    pool: &SqlitePool,
    file_path: &str,
    agent_id: &str,
    session_id: Option<&str>,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    let agent_client = "Antigravity";
    let (last_offset, last_modified, file_size) =
        get_checkpoint_info(pool, agent_client, file_path).await?;
    if file_size <= last_offset {
        return Ok(());
    }

    let mut file = File::open(file_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(last_offset))
        .map_err(|e| e.to_string())?;

    let reader = BufReader::new(file);
    let mut bytes_parsed = last_offset;
    let mut events = Vec::new();

    for (index, line_res) in reader.lines().enumerate() {
        let line = match line_res {
            Ok(l) => l,
            Err(_) => break,
        };
        let line_offset = bytes_parsed;
        bytes_parsed += line.len() as u64 + 1;

        if line.trim().is_empty() {
            continue;
        }

        // Fast pre-filter (allocation-free case-sensitive check first)
        let is_interesting_fast = line.contains("planner_response")
            || line.contains("response_item")
            || line.contains("PLANNER_RESPONSE")
            || line.contains("RESPONSE_ITEM")
            || line.contains("exec_command")
            || line.contains("view_file")
            || line.contains("replace_file_content")
            || line.contains("multi_replace_file_content")
            || line.contains("skill")
            || line.contains("mcp")
            || line.contains("use")
            || line.contains("run");

        if !is_interesting_fast {
            continue;
        }

        // Detailed check (case-insensitive with lowercase translation)
        let line_lower = if line.len() > 4096 {
            let mut end = 4096;
            while !line.is_char_boundary(end) {
                end -= 1;
            }
            line[..end].to_lowercase()
        } else {
            line.to_lowercase()
        };

        let is_interesting = line_lower.contains("planner_response")
            || line_lower.contains("response_item")
            || skills.iter().any(|s| line_lower.contains(&s.name_lower))
            || mcp_servers
                .iter()
                .any(|m| line_lower.contains(&m.name_lower));

        if !is_interesting {
            continue;
        }

        if let Ok(val) = serde_json::from_str::<Value>(&line) {
            let created_at = val["created_at"].as_str().unwrap_or("").to_string();
            let timestamp = if created_at.is_empty() {
                Utc::now().to_rfc3339()
            } else {
                created_at
            };

            if val["type"] == "PLANNER_RESPONSE" {
                if let Some(tool_calls) = val["tool_calls"].as_array() {
                    for tc in tool_calls {
                        if let Some(name) = tc["name"].as_str() {
                            // 1. Check Skill usage in views
                            if name == "view_file"
                                || name == "replace_file_content"
                                || name == "multi_replace_file_content"
                            {
                                if let Some(args) = tc["args"].as_object() {
                                    let path_opt = args
                                        .get("AbsolutePath")
                                        .or_else(|| args.get("TargetFile"))
                                        .and_then(|v| v.as_str());
                                    if let Some(p) = path_opt {
                                        let clean_p = p
                                            .strip_prefix("file://")
                                            .unwrap_or(p)
                                            .trim_matches('"');
                                        if let Some(skill) =
                                            find_matching_skill_by_path(clean_p, skills)
                                        {
                                            events.push(InferredEvent {
                                                agent_session_id: session_id.map(String::from),
                                                resource_type: "skill".to_string(),
                                                resource_id: Some(skill.id.clone()),
                                                resource_name: skill.name.clone(),
                                                usage_kind: "skill_invoked".to_string(),
                                                confidence: "high".to_string(),
                                                evidence: format!(
                                                    "结构化工具调用 view_file/edit，指向文件：{}",
                                                    clean_p
                                                ),
                                                source_offset: line_offset,
                                                event_time: timestamp.clone(),
                                                metadata_json: Some(tc.to_string()),
                                            });
                                        }
                                    }
                                }
                            }

                            // 2. Check MCP Tool Call
                            if let Some(mcp) = match_mcp(name, mcp_servers) {
                                events.push(InferredEvent {
                                    agent_session_id: session_id.map(String::from),
                                    resource_type: "mcp_tool".to_string(),
                                    resource_id: Some(mcp.id.clone()),
                                    resource_name: name.to_string(),
                                    usage_kind: "mcp_tool_called".to_string(),
                                    confidence: "high".to_string(),
                                    evidence: format!("结构化 MCP 工具调用：{}", name),
                                    source_offset: line_offset,
                                    event_time: timestamp.clone(),
                                    metadata_json: Some(tc.to_string()),
                                });
                            }
                        }
                    }
                }
            }

            // 3. Fallback Context search for medium/low confidence
            // 旁路非结构化文本启发式匹配 (置信度 medium / low)
            check_context_inference(
                &line,
                index,
                line_offset,
                &timestamp,
                session_id,
                skills,
                mcp_servers,
                &mut events,
            );
        }
    }

    // Persist events & update Checkpoint
    for ev in events {
        if let Err(e) = record_inferred_event(pool, agent_client, agent_id, file_path, ev).await {
            log::error!("[Log Scanner] Failed to record inferred event: {}", e);
        }
    }
    update_checkpoint(pool, agent_client, file_path, &last_modified, bytes_parsed).await?;
    Ok(())
}

/// Incrementally parse Newmax JSONL logs
/// 增量解析 Newmax JSONL。结构化 tool_use 优先，避免把普通对话误判为真实使用。
async fn parse_newmax_log(
    pool: &SqlitePool,
    file_path: &str,
    agent_id: &str,
    fallback_session_id: Option<&str>,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    let agent_client = "Newmax";
    let (last_offset, last_modified, file_size) =
        get_checkpoint_info(pool, agent_client, file_path).await?;
    if file_size <= last_offset {
        return Ok(());
    }

    let mut file = File::open(file_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(last_offset))
        .map_err(|e| e.to_string())?;

    let reader = BufReader::new(file);
    let mut bytes_parsed = last_offset;
    let mut events = Vec::new();

    for (index, line_res) in reader.lines().enumerate() {
        let line = match line_res {
            Ok(l) => l,
            Err(_) => break,
        };
        let line_offset = bytes_parsed;
        bytes_parsed += line.len() as u64 + 1;

        if line.trim().is_empty() {
            continue;
        }

        let is_interesting_fast = line.contains("\"tool_use\"")
            || line.contains("attributionMcpServer")
            || line.contains("attributionMcpTool")
            || line.contains("mcp__")
            || line.contains("skill-handler")
            || line.contains("\"Skill\"")
            || line.contains("/SKILL.md");

        if !is_interesting_fast {
            continue;
        }

        let Ok(val) = serde_json::from_str::<Value>(&line) else {
            continue;
        };

        let timestamp = val["timestamp"]
            .as_str()
            .map(String::from)
            .unwrap_or_else(|| Utc::now().to_rfc3339());
        let session_id = val["sessionId"]
            .as_str()
            .map(String::from)
            .or_else(|| fallback_session_id.map(String::from));
        let mut line_recorded_mcp = false;

        if let Some(contents) = val["message"]["content"].as_array() {
            for content in contents {
                if content["type"].as_str() != Some("tool_use") {
                    continue;
                }

                let tool_name = content["name"].as_str().unwrap_or("");
                if tool_name.is_empty() {
                    continue;
                }

                let input = &content["input"];
                let source_offset = line_offset;

                if let Some(skill_name) = extract_newmax_skill_name(tool_name, input) {
                    let skill_by_name = find_matching_skill_by_name(&skill_name, skills);
                    if let Some(skill) = skill_by_name {
                        events.push(InferredEvent {
                            agent_session_id: session_id.clone(),
                            resource_type: "skill".to_string(),
                            resource_id: Some(skill.id.clone()),
                            resource_name: skill.name.clone(),
                            usage_kind: "skill_invoked".to_string(),
                            confidence: "high".to_string(),
                            evidence: format!("Newmax Skill handler 调用：{}", skill.name),
                            source_offset,
                            event_time: timestamp.clone(),
                            metadata_json: Some(newmax_metadata(
                                tool_name,
                                Some(&skill.name),
                                None,
                            )),
                        });
                    } else {
                        events.push(InferredEvent {
                            agent_session_id: session_id.clone(),
                            resource_type: "skill".to_string(),
                            resource_id: None,
                            resource_name: skill_name.clone(),
                            usage_kind: "skill_invoked".to_string(),
                            confidence: "medium".to_string(),
                            evidence: format!(
                                "Newmax Skill handler 调用，但未匹配到 Harness Skill 索引：{}",
                                skill_name
                            ),
                            source_offset,
                            event_time: timestamp.clone(),
                            metadata_json: Some(newmax_metadata(
                                tool_name,
                                Some(&skill_name),
                                None,
                            )),
                        });
                    }
                    continue;
                }

                if tool_name.eq_ignore_ascii_case("Bash") {
                    if let Some(command) = input["command"].as_str() {
                        if let Some(skill) = find_matching_skill_by_command(command, skills) {
                            events.push(InferredEvent {
                                agent_session_id: session_id.clone(),
                                resource_type: "skill".to_string(),
                                resource_id: Some(skill.id.clone()),
                                resource_name: skill.name.clone(),
                                usage_kind: "skill_invoked".to_string(),
                                confidence: "high".to_string(),
                                evidence: format!("Newmax Bash 命令中匹配到 Skill：{}", skill.name),
                                source_offset,
                                event_time: timestamp.clone(),
                                metadata_json: Some(newmax_metadata(
                                    tool_name,
                                    Some(&skill.name),
                                    None,
                                )),
                            });
                        }
                    }
                } else if let Some(skill) = find_matching_skill_in_json(input, skills) {
                    events.push(InferredEvent {
                        agent_session_id: session_id.clone(),
                        resource_type: "skill".to_string(),
                        resource_id: Some(skill.id.clone()),
                        resource_name: skill.name.clone(),
                        usage_kind: "skill_invoked".to_string(),
                        confidence: "high".to_string(),
                        evidence: format!("Newmax 工具参数路径中匹配到 Skill：{}", skill.name),
                        source_offset,
                        event_time: timestamp.clone(),
                        metadata_json: Some(newmax_metadata(tool_name, Some(&skill.name), None)),
                    });
                }

                if let Some(mcp) = match_mcp(tool_name, mcp_servers) {
                    events.push(InferredEvent {
                        agent_session_id: session_id.clone(),
                        resource_type: "mcp_tool".to_string(),
                        resource_id: Some(mcp.id.clone()),
                        resource_name: tool_name.to_string(),
                        usage_kind: "mcp_tool_called".to_string(),
                        confidence: "high".to_string(),
                        evidence: format!("Newmax 结构化 MCP 工具调用：{}", tool_name),
                        source_offset,
                        event_time: timestamp.clone(),
                        metadata_json: Some(newmax_metadata(tool_name, None, Some(tool_name))),
                    });
                    line_recorded_mcp = true;
                }
            }
        }

        if !line_recorded_mcp {
            if let (Some(server), Some(tool)) = (
                val["attributionMcpServer"].as_str(),
                val["attributionMcpTool"].as_str(),
            ) {
                let tool_name = format!("mcp__{}__{}", server, tool);
                if let Some(mcp) = match_mcp(&tool_name, mcp_servers) {
                    events.push(InferredEvent {
                        agent_session_id: session_id.clone(),
                        resource_type: "mcp_tool".to_string(),
                        resource_id: Some(mcp.id.clone()),
                        resource_name: tool_name.clone(),
                        usage_kind: "mcp_tool_called".to_string(),
                        confidence: "high".to_string(),
                        evidence: format!(
                            "Newmax attribution 字段识别到 MCP 工具调用：{}",
                            tool_name
                        ),
                        source_offset: line_offset,
                        event_time: timestamp.clone(),
                        metadata_json: Some(newmax_metadata(&tool_name, None, Some(&tool_name))),
                    });
                }
            }
        }

        let _ = index;
    }

    for ev in events {
        if let Err(e) = record_inferred_event(pool, agent_client, agent_id, file_path, ev).await {
            log::error!("[Log Scanner] Failed to record inferred event: {}", e);
        }
    }
    update_checkpoint(pool, agent_client, file_path, &last_modified, bytes_parsed).await?;
    Ok(())
}

/// Incrementally parse Codex rollout
/// 增量解析单个 Codex 会话日志
async fn parse_codex_log(
    pool: &SqlitePool,
    file_path: &str,
    agent_id: &str,
    session_id: Option<&str>,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    let agent_client = "Codex";
    let (last_offset, last_modified, file_size) =
        get_checkpoint_info(pool, agent_client, file_path).await?;
    if file_size <= last_offset {
        return Ok(());
    }

    let mut file = File::open(file_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(last_offset))
        .map_err(|e| e.to_string())?;

    let reader = BufReader::new(file);
    let mut bytes_parsed = last_offset;
    let mut events = Vec::new();

    for (index, line_res) in reader.lines().enumerate() {
        let line = match line_res {
            Ok(l) => l,
            Err(_) => break,
        };
        let line_offset = bytes_parsed;
        bytes_parsed += line.len() as u64 + 1;

        if line.trim().is_empty() {
            continue;
        }

        // Fast pre-filter (allocation-free case-sensitive check first)
        let is_interesting_fast = line.contains("planner_response")
            || line.contains("response_item")
            || line.contains("PLANNER_RESPONSE")
            || line.contains("RESPONSE_ITEM")
            || line.contains("exec_command")
            || line.contains("view_file")
            || line.contains("replace_file_content")
            || line.contains("multi_replace_file_content")
            || line.contains("skill")
            || line.contains("mcp")
            || line.contains("use")
            || line.contains("run");

        if !is_interesting_fast {
            continue;
        }

        // Detailed check (case-insensitive with lowercase translation)
        let line_lower = if line.len() > 4096 {
            let mut end = 4096;
            while !line.is_char_boundary(end) {
                end -= 1;
            }
            line[..end].to_lowercase()
        } else {
            line.to_lowercase()
        };

        let is_interesting = line_lower.contains("planner_response")
            || line_lower.contains("response_item")
            || skills.iter().any(|s| line_lower.contains(&s.name_lower))
            || mcp_servers
                .iter()
                .any(|m| line_lower.contains(&m.name_lower));

        if !is_interesting {
            continue;
        }

        if let Ok(val) = serde_json::from_str::<Value>(&line) {
            let created_at = val["timestamp"].as_str().unwrap_or("").to_string();
            let timestamp = if created_at.is_empty() {
                Utc::now().to_rfc3339()
            } else {
                created_at
            };

            if val["type"] == "response_item" {
                let payload = &val["payload"];
                if payload["type"] == "function_call" {
                    if let Some(name) = payload["name"].as_str() {
                        if let Some(args_str) = payload["arguments"].as_str() {
                            if let Ok(args) = serde_json::from_str::<Value>(args_str) {
                                // 1. Skill usage check in shell command
                                if name == "exec_command" {
                                    if let Some(cmd) = args["cmd"].as_str() {
                                        for skill in skills {
                                            if cmd.contains(&skill.path)
                                                || cmd.contains(&skill.name)
                                            {
                                                events.push(InferredEvent {
                                                    agent_session_id: session_id.map(String::from),
                                                    resource_type: "skill".to_string(),
                                                    resource_id: Some(skill.id.clone()),
                                                    resource_name: skill.name.clone(),
                                                    usage_kind: "skill_invoked".to_string(),
                                                    confidence: "high".to_string(),
                                                    evidence: format!(
                                                        "命令行调用命令中识别到 Skill：{}",
                                                        cmd
                                                    ),
                                                    source_offset: line_offset,
                                                    event_time: timestamp.clone(),
                                                    metadata_json: Some(args.to_string()),
                                                });
                                                break;
                                            }
                                        }
                                    }
                                } else {
                                    // Other file commands arguments path extraction
                                    if let Some(obj) = args.as_object() {
                                        for (_, v) in obj {
                                            if let Some(p) = v.as_str() {
                                                let clean_p = p
                                                    .strip_prefix("file://")
                                                    .unwrap_or(p)
                                                    .trim_matches('"');
                                                if let Some(skill) =
                                                    find_matching_skill_by_path(clean_p, skills)
                                                {
                                                    events.push(InferredEvent {
                                                        agent_session_id: session_id
                                                            .map(String::from),
                                                        resource_type: "skill".to_string(),
                                                        resource_id: Some(skill.id.clone()),
                                                        resource_name: skill.name.clone(),
                                                        usage_kind: "skill_invoked".to_string(),
                                                        confidence: "high".to_string(),
                                                        evidence: format!(
                                                            "工具参数路径中匹配到 Skill：{}",
                                                            clean_p
                                                        ),
                                                        source_offset: line_offset,
                                                        event_time: timestamp.clone(),
                                                        metadata_json: Some(args.to_string()),
                                                    });
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }

                                // 2. MCP Tool call check
                                if let Some(mcp) = match_mcp(name, mcp_servers) {
                                    events.push(InferredEvent {
                                        agent_session_id: session_id.map(String::from),
                                        resource_type: "mcp_tool".to_string(),
                                        resource_id: Some(mcp.id.clone()),
                                        resource_name: name.to_string(),
                                        usage_kind: "mcp_tool_called".to_string(),
                                        confidence: "high".to_string(),
                                        evidence: format!("结构化 MCP 工具调用：{}", name),
                                        source_offset: line_offset,
                                        event_time: timestamp.clone(),
                                        metadata_json: Some(args.to_string()),
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // 3. Fallback Context search for medium/low confidence
            check_context_inference(
                &line,
                index,
                line_offset,
                &timestamp,
                session_id,
                skills,
                mcp_servers,
                &mut events,
            );
        }
    }

    // Persist events & update Checkpoint
    for ev in events {
        if let Err(e) = record_inferred_event(pool, agent_client, agent_id, file_path, ev).await {
            log::error!("[Log Scanner] Failed to record inferred event: {}", e);
        }
    }
    update_checkpoint(pool, agent_client, file_path, &last_modified, bytes_parsed).await?;
    Ok(())
}

/// Incrementally parse WorkBuddy structured trace JSON
/// 增量解析 WorkBuddy 的结构化 trace JSON。只提取工具名、skill 名、路径和 MCP 名，不保存大段输出。
async fn parse_workbuddy_trace(
    pool: &SqlitePool,
    file_path: &str,
    agent_id: &str,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
) -> Result<(), String> {
    let agent_client = "WorkBuddy";
    let (last_offset, last_modified, file_size) =
        get_checkpoint_info(pool, agent_client, file_path).await?;
    if file_size <= last_offset {
        return Ok(());
    }

    let file = File::open(file_path).map_err(|e| e.to_string())?;
    let val = serde_json::from_reader::<_, Value>(file).map_err(|e| e.to_string())?;
    let trace = &val["trace"];
    let session_id = trace["sessionId"].as_str().map(String::from);
    let trace_time = trace["startedAt"]
        .as_str()
        .map(String::from)
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    let mut events = Vec::new();
    if let Some(spans) = val["spans"].as_array() {
        for (index, span) in spans.iter().enumerate() {
            if span["type"].as_str() != Some("function") {
                continue;
            }

            let tool_name = span["toolName"]
                .as_str()
                .or_else(|| span["name"].as_str())
                .unwrap_or("");
            if tool_name.is_empty() {
                continue;
            }

            let event_time = span["startedAt"]
                .as_str()
                .map(String::from)
                .unwrap_or_else(|| trace_time.clone());
            let source_offset = index as u64;
            let tool_input = span["toolInput"].as_str().unwrap_or("");
            let tool_output = span["toolOutput"].as_str().unwrap_or("");
            let bounded_output = bounded_text(tool_output, 24_000);
            let span_id = span["spanId"].as_str().unwrap_or("");

            if tool_name.eq_ignore_ascii_case("Skill") {
                let skill_name = extract_workbuddy_skill_name(tool_input, bounded_output);
                let skill_by_path = extract_workbuddy_skill_path(bounded_output)
                    .and_then(|path| find_matching_skill_by_path(&path, skills));
                let skill_by_name = skill_name
                    .as_deref()
                    .and_then(|name| find_matching_skill_by_name(name, skills));

                if let Some(skill) = skill_by_path.or(skill_by_name) {
                    events.push(InferredEvent {
                        agent_session_id: session_id.clone(),
                        resource_type: "skill".to_string(),
                        resource_id: Some(skill.id.clone()),
                        resource_name: skill.name.clone(),
                        usage_kind: "skill_invoked".to_string(),
                        confidence: "high".to_string(),
                        evidence: format!("WorkBuddy 结构化 Skill 工具调用：{}", skill.name),
                        source_offset,
                        event_time: event_time.clone(),
                        metadata_json: Some(workbuddy_metadata(
                            tool_name,
                            span_id,
                            skill_name.as_deref(),
                            None,
                        )),
                    });
                } else if let Some(name) = skill_name {
                    events.push(InferredEvent {
                        agent_session_id: session_id.clone(),
                        resource_type: "skill".to_string(),
                        resource_id: None,
                        resource_name: name.clone(),
                        usage_kind: "skill_invoked".to_string(),
                        confidence: "medium".to_string(),
                        evidence: format!(
                            "WorkBuddy 结构化 Skill 工具调用，但未匹配到 Harness Skill 索引：{}",
                            name
                        ),
                        source_offset,
                        event_time: event_time.clone(),
                        metadata_json: Some(workbuddy_metadata(
                            tool_name,
                            span_id,
                            Some(&name),
                            None,
                        )),
                    });
                }
            }

            if let Some(mcp_tool_name) = extract_workbuddy_mcp_tool_name(tool_name, bounded_output)
            {
                if let Some(mcp) = match_mcp(&mcp_tool_name, mcp_servers) {
                    events.push(InferredEvent {
                        agent_session_id: session_id.clone(),
                        resource_type: "mcp_tool".to_string(),
                        resource_id: Some(mcp.id.clone()),
                        resource_name: mcp_tool_name.clone(),
                        usage_kind: "mcp_tool_called".to_string(),
                        confidence: "high".to_string(),
                        evidence: format!(
                            "WorkBuddy trace 中识别到 MCP 工具调用：{}",
                            mcp_tool_name
                        ),
                        source_offset,
                        event_time: event_time.clone(),
                        metadata_json: Some(workbuddy_metadata(
                            tool_name,
                            span_id,
                            None,
                            Some(&mcp_tool_name),
                        )),
                    });
                }
            }

            let bounded_combined = format!("{} {}", tool_input, bounded_output);
            if let Some(skill) = find_matching_skill_by_path(&bounded_combined, skills) {
                events.push(InferredEvent {
                    agent_session_id: session_id.clone(),
                    resource_type: "skill".to_string(),
                    resource_id: Some(skill.id.clone()),
                    resource_name: skill.name.clone(),
                    usage_kind: "skill_invoked".to_string(),
                    confidence: "high".to_string(),
                    evidence: format!("WorkBuddy 工具输出路径中匹配到 Skill：{}", skill.name),
                    source_offset,
                    event_time: event_time.clone(),
                    metadata_json: Some(workbuddy_metadata(
                        tool_name,
                        span_id,
                        Some(&skill.name),
                        None,
                    )),
                });
            }
        }
    }

    for ev in events {
        if let Err(e) = record_inferred_event(pool, agent_client, agent_id, file_path, ev).await {
            log::error!("[Log Scanner] Failed to record inferred event: {}", e);
        }
    }
    update_checkpoint(pool, agent_client, file_path, &last_modified, file_size).await?;
    Ok(())
}

/// Fallback context matching rule to assign medium or low confidence
/// 上下文启发式匹配规则：在非结构化文本行中进行模糊统计判定 (medium / low 置信度)
fn check_context_inference(
    line: &str,
    _line_index: usize,
    offset: u64,
    timestamp: &str,
    session_id: Option<&str>,
    skills: &[SkillInfo],
    mcp_servers: &[McpInfo],
    events: &mut Vec<InferredEvent>,
) {
    // Truncate to avoid performance issues with huge logs (e.g. base64 images or large file diffs)
    let max_len = 4096;
    let truncated_line = if line.len() > max_len {
        let mut end = max_len;
        while !line.is_char_boundary(end) {
            end -= 1;
        }
        &line[..end]
    } else {
        line
    };
    let line_lower = truncated_line.to_lowercase();

    // Early return if there are no medium-confidence action keywords to avoid looping
    let has_medium_keyword = line_lower.contains("use")
        || line_lower.contains("invoke")
        || line_lower.contains("run")
        || line_lower.contains("execute")
        || line_lower.contains("skill")
        || line_lower.contains("prompt")
        || line_lower.contains("mcp");

    if !has_medium_keyword {
        return;
    }

    // 1. Skill Name matching
    for skill in skills {
        // Skip too generic names e.g., 'doc', 'test' to avoid noise
        if skill.name_lower.len() <= 3 || skill.name_lower == "test" || skill.name_lower == "code" {
            continue;
        }

        if line_lower.contains(&skill.name_lower) {
            // Check context keywords for medium confidence
            // 上下文若包含动作行为词，标记为 medium；否则为 low
            let is_medium = ["use", "invoke", "run", "execute", "skill", "prompt", "mcp"]
                .iter()
                .any(|keyword| line_lower.contains(keyword));

            events.push(InferredEvent {
                agent_session_id: session_id.map(String::from),
                resource_type: "skill".to_string(),
                resource_id: Some(skill.id.clone()),
                resource_name: skill.name.clone(),
                usage_kind: "skill_referenced".to_string(),
                confidence: if is_medium {
                    "medium".to_string()
                } else {
                    "low".to_string()
                },
                evidence: format!("上下文关键字匹配 '{}' 痕迹", skill.name),
                source_offset: offset,
                event_time: timestamp.to_string(),
                metadata_json: None,
            });
        }
    }

    // 2. MCP Server Name matching
    for mcp in mcp_servers {
        let mcp_name_lower = mcp.name.to_lowercase();
        if mcp_name_lower.len() <= 3 {
            continue;
        }

        if line_lower.contains(&mcp_name_lower) {
            let is_medium = ["call", "invoke", "tool", "server", "mcp", "process"]
                .iter()
                .any(|keyword| line_lower.contains(keyword));

            events.push(InferredEvent {
                agent_session_id: session_id.map(String::from),
                resource_type: "mcp_server".to_string(),
                resource_id: Some(mcp.id.clone()),
                resource_name: mcp.name.clone(),
                usage_kind: "mcp_server_used".to_string(),
                confidence: if is_medium {
                    "medium".to_string()
                } else {
                    "low".to_string()
                },
                evidence: format!("上下文关键字匹配 MCP 服务 '{}' 痕迹", mcp.name),
                source_offset: offset,
                event_time: timestamp.to_string(),
                metadata_json: None,
            });
        }
    }
}

/// Match path prefix to map a skill
/// 辅助匹配：前缀匹配 Skill 路径
fn find_matching_skill_by_path<'a>(
    clean_path: &str,
    skills: &'a [SkillInfo],
) -> Option<&'a SkillInfo> {
    let p = Path::new(clean_path);
    for skill in skills {
        let skill_p = Path::new(&skill.path);
        if p.starts_with(skill_p) || clean_path.contains(&skill.path) {
            return Some(skill);
        }
    }
    None
}

/// Match skill name or aliases from structured client traces
/// 辅助匹配：按 Skill 名称或常见别名精确匹配，避免短词 contains 误判。
fn find_matching_skill_by_name<'a>(name: &str, skills: &'a [SkillInfo]) -> Option<&'a SkillInfo> {
    let name_lower = name.trim().to_lowercase();
    if name_lower.is_empty() {
        return None;
    }

    skills.iter().find(|skill| {
        skill.name_lower == name_lower
            || skill.name_lower.replace('_', "-") == name_lower.replace('_', "-")
    })
}

/// Filter system tools and find matching MCP Server
/// 辅助匹配：判断工具名是否归属注册的 MCP
fn match_mcp<'a>(tool_name: &str, mcp_servers: &'a [McpInfo]) -> Option<&'a McpInfo> {
    if SYSTEM_TOOLS
        .iter()
        .any(|tool| tool.eq_ignore_ascii_case(tool_name))
    {
        return None;
    }

    let tool_name_lower = tool_name.to_lowercase();
    let possible_name = if tool_name_lower.starts_with("mcp__") {
        tool_name_lower
            .split("__")
            .nth(1)
            .map(String::from)
            .unwrap_or(tool_name_lower.clone())
    } else if tool_name_lower.contains(':') {
        tool_name_lower.split(':').next().unwrap_or("").to_string()
    } else if tool_name_lower.contains('/') {
        tool_name_lower.split('/').next().unwrap_or("").to_string()
    } else if tool_name.contains('/') {
        tool_name_lower.split('/').next().unwrap_or("").to_string()
    } else {
        tool_name_lower.clone()
    };

    for mcp in mcp_servers {
        if mcp.name_lower == possible_name
            || tool_name_lower.starts_with(&mcp.name_lower)
            || tool_name_lower.starts_with(&format!("mcp__{}__", mcp.name_lower))
            || tool_name_lower.contains(&format!("mcp-connector-proxy-{}", mcp.name_lower))
        {
            return Some(mcp);
        }
    }
    None
}

fn bounded_text(text: &str, max_len: usize) -> &str {
    if text.len() <= max_len {
        return text;
    }
    let mut end = max_len;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

fn extract_workbuddy_skill_name(tool_input: &str, tool_output: &str) -> Option<String> {
    if let Ok(value) = serde_json::from_str::<Value>(tool_input) {
        if let Some(skill) = value["skill"].as_str() {
            let trimmed = skill.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    extract_between(tool_output, "<command-name>", "</command-name>")
        .or_else(|| extract_between(tool_output, "Skill \\\"", "\\\" loaded"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn extract_workbuddy_skill_path(tool_output: &str) -> Option<String> {
    let marker = "Base directory for this skill:";
    let start = tool_output.find(marker)? + marker.len();
    let rest = &tool_output[start..];
    let path = rest
        .split("\\n")
        .next()
        .unwrap_or(rest)
        .trim()
        .trim_matches('"');
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

fn extract_workbuddy_mcp_tool_name(tool_name: &str, tool_output: &str) -> Option<String> {
    if tool_name.to_lowercase().starts_with("mcp__") {
        return Some(tool_name.to_string());
    }

    if let Some(name) = extract_prefixed_token(tool_output, "mcp__") {
        return Some(name);
    }

    let marker = "mcp-connector-proxy-";
    let start = tool_output.find(marker)? + marker.len();
    let rest = &tool_output[start..];
    let token = rest
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect::<String>();
    if token.is_empty() {
        None
    } else {
        Some(format!("mcp__{}", token.replace('_', "__")))
    }
}

fn extract_newmax_skill_name(tool_name: &str, input: &Value) -> Option<String> {
    let is_skill_tool = tool_name.eq_ignore_ascii_case("Skill")
        || tool_name.eq_ignore_ascii_case("mcp__skill-handler__Skill");
    if !is_skill_tool {
        return None;
    }

    input["skill"]
        .as_str()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn find_matching_skill_by_command<'a>(
    command: &str,
    skills: &'a [SkillInfo],
) -> Option<&'a SkillInfo> {
    skills.iter().find(|skill| {
        command.contains(&skill.path)
            || command.contains(&format!("{}/SKILL.md", skill.path))
            || command.contains(&format!("/{}", skill.name))
    })
}

fn find_matching_skill_in_json<'a>(
    input: &Value,
    skills: &'a [SkillInfo],
) -> Option<&'a SkillInfo> {
    match input {
        Value::String(value) => find_matching_skill_by_path(value, skills),
        Value::Array(values) => values
            .iter()
            .find_map(|value| find_matching_skill_in_json(value, skills)),
        Value::Object(map) => map
            .values()
            .find_map(|value| find_matching_skill_in_json(value, skills)),
        _ => None,
    }
}

fn extract_prefixed_token(text: &str, prefix: &str) -> Option<String> {
    let start = text.find(prefix)?;
    let token = text[start..]
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect::<String>();
    if token.len() > prefix.len() {
        Some(token)
    } else {
        None
    }
}

fn extract_between(text: &str, start_marker: &str, end_marker: &str) -> Option<String> {
    let start = text.find(start_marker)? + start_marker.len();
    let rest = &text[start..];
    let end = rest.find(end_marker)?;
    Some(rest[..end].to_string())
}

fn workbuddy_metadata(
    tool_name: &str,
    span_id: &str,
    skill_name: Option<&str>,
    mcp_tool_name: Option<&str>,
) -> String {
    serde_json::json!({
        "tool_name": tool_name,
        "span_id": span_id,
        "skill_name": skill_name,
        "mcp_tool_name": mcp_tool_name
    })
    .to_string()
}

fn newmax_metadata(
    tool_name: &str,
    skill_name: Option<&str>,
    mcp_tool_name: Option<&str>,
) -> String {
    serde_json::json!({
        "tool_name": tool_name,
        "skill_name": skill_name,
        "mcp_tool_name": mcp_tool_name
    })
    .to_string()
}

/// Fetch checkpoint offset and file stats
/// 增量 Checkpoint 辅助：获取扫描点元信息
async fn get_checkpoint_info(
    pool: &SqlitePool,
    agent_client: &str,
    file_path: &str,
) -> Result<(u64, String, u64), String> {
    let path = Path::new(file_path);
    let metadata = path.metadata().map_err(|e| e.to_string())?;
    let file_size = metadata.len();

    let last_modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default();

    let offset_row = sqlx::query(
        "SELECT last_offset, last_mtime FROM agent_log_scan_checkpoints WHERE agent_client = ? AND source_file = ?"
    )
    .bind(agent_client)
    .bind(file_path)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (mut last_offset, prev_mtime) = match offset_row {
        Some(row) => {
            let offset: i64 = row.get("last_offset");
            let mtime: String = row.get("last_mtime");
            (offset as u64, mtime)
        }
        None => (0, String::new()),
    };

    if prev_mtime == last_modified && file_size <= last_offset {
        return Ok((file_size, last_modified, file_size));
    }

    if file_size < last_offset {
        last_offset = 0;
    }

    Ok((last_offset, last_modified, file_size))
}

/// Update log scanning checkpoint in SQLite
/// 增量 Checkpoint 辅助：保存最新扫描点
async fn update_checkpoint(
    pool: &SqlitePool,
    agent_client: &str,
    file_path: &str,
    last_modified: &str,
    bytes_read: u64,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO agent_log_scan_checkpoints (id, agent_client, source_file, last_offset, last_mtime, last_scanned_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_client, source_file) DO UPDATE SET
            last_offset = excluded.last_offset,
            last_mtime = excluded.last_mtime,
            last_scanned_at = excluded.last_scanned_at,
            updated_at = excluded.updated_at
        "#
    )
    .bind(&id)
    .bind(agent_client)
    .bind(file_path)
    .bind(bytes_read as i64)
    .bind(last_modified)
    .bind(&now)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Write inferred event to agent_resource_usage_events with event_hash uniqueness deduplication
/// 写入推断的事件核心函数，通过 event_hash 进行排重，并同步反哺 skills 统计
async fn record_inferred_event(
    pool: &SqlitePool,
    agent_client: &str,
    agent_id: &str,
    file_path: &str,
    event: InferredEvent,
) -> Result<(), sqlx::Error> {
    // Generate signature unique hash (client + file + offset + timestamp)
    // 采用 FNV-1a 算法生成唯一排重签名哈希值
    let raw_sig = format!(
        "{}:{}:{}:{}:{}:{}:{}",
        agent_client,
        file_path,
        event.source_offset,
        event.resource_type,
        event.resource_name,
        event.usage_kind,
        event.event_time
    );
    let event_hash = fnv1a_hash(&raw_sig);

    // 1. Deduplicate check using unique event_hash
    // 数据库排重检测
    let existing =
        sqlx::query("SELECT 1 FROM agent_resource_usage_events WHERE event_hash = ? LIMIT 1")
            .bind(&event_hash)
            .fetch_optional(pool)
            .await?;

    if existing.is_some() {
        return Ok(());
    }

    let uuid_str = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO agent_resource_usage_events (
            id, agent_client, agent_id, agent_session_id, resource_type, resource_id, resource_name,
            usage_kind, event_source, confidence, evidence, source_file, source_offset, event_hash,
            event_time, created_at, metadata_json
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, 'log_inferred', ?, ?, ?, ?, ?, ?, ?, ?
        )
        "#,
    )
    .bind(&uuid_str)
    .bind(agent_client)
    .bind(agent_id)
    .bind(&event.agent_session_id)
    .bind(&event.resource_type)
    .bind(&event.resource_id)
    .bind(&event.resource_name)
    .bind(&event.usage_kind)
    .bind(&event.confidence)
    .bind(&event.evidence)
    .bind(file_path)
    .bind(event.source_offset as i64)
    .bind(&event_hash)
    .bind(&event.event_time)
    .bind(&now)
    .bind(&event.metadata_json)
    .execute(pool)
    .await?;

    // 2. Auto sync to skills.total_usage_count (only for high & medium confidence)
    // 只针对 high 与 medium 置信度的事件，同步更新 skills 的物理字段
    if event.resource_type == "skill"
        && (event.confidence == "high" || event.confidence == "medium")
    {
        if let Some(ref res_id) = event.resource_id {
            sqlx::query(
                r#"
                UPDATE skills
                SET total_usage_count = total_usage_count + 1, last_used_at = ?
                WHERE id = ?
                "#,
            )
            .bind(&event.event_time)
            .bind(res_id)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fnv1a_hash() {
        let text1 = "Antigravity:/logs/t1.jsonl:1024:2026-06-26T07:00:00Z";
        let text2 = "Antigravity:/logs/t1.jsonl:1024:2026-06-26T07:00:00Z";
        let text3 = "Antigravity:/logs/t1.jsonl:2048:2026-06-26T07:00:00Z";

        assert_eq!(fnv1a_hash(text1), fnv1a_hash(text2));
        assert_ne!(fnv1a_hash(text1), fnv1a_hash(text3));
    }

    #[test]
    fn test_match_skill() {
        let skills = vec![SkillInfo {
            id: "sk_1".to_string(),
            name: "chrome-extensions".to_string(),
            name_lower: "chrome-extensions".to_string(),
            path: "/Users/jackdu/.gemini/config/plugins/skills/chrome-extensions".to_string(),
        }];

        let path1 = "/Users/jackdu/.gemini/config/plugins/skills/chrome-extensions/SKILL.md";
        let path2 =
            "\"file:///Users/jackdu/.gemini/config/plugins/skills/chrome-extensions/SKILL.md\"";
        let path3 = "/unrelated/path/SKILL.md";

        assert_eq!(
            find_matching_skill_by_path(path1, &skills).map(|s| s.id.as_str()),
            Some("sk_1")
        );
        assert_eq!(
            find_matching_skill_by_path(path2, &skills).map(|s| s.id.as_str()),
            Some("sk_1")
        );
        assert_eq!(
            find_matching_skill_by_path(path3, &skills).map(|s| s.id.as_str()),
            None
        );
    }

    #[test]
    fn test_match_mcp() {
        let mcp_servers = vec![McpInfo {
            id: "m_github".to_string(),
            name: "github".to_string(),
            name_lower: "github".to_string(),
        }];

        // System tools filtered
        assert!(match_mcp("view_file", &mcp_servers).is_none());
        assert!(match_mcp("exec_command", &mcp_servers).is_none());

        // Regular matched
        assert_eq!(
            match_mcp("github:yeet", &mcp_servers).map(|m| m.id.as_str()),
            Some("m_github")
        );
        assert_eq!(
            match_mcp("github/yeet", &mcp_servers).map(|m| m.id.as_str()),
            Some("m_github")
        );
        assert_eq!(
            match_mcp("Github_create_issue", &mcp_servers).map(|m| m.id.as_str()),
            Some("m_github")
        );
        assert_eq!(
            match_mcp("mcp__github__create_issue", &mcp_servers).map(|m| m.id.as_str()),
            Some("m_github")
        );
    }

    #[test]
    fn test_workbuddy_extractors() {
        let tool_input = r#"{"skill":"docx"}"#;
        assert_eq!(
            extract_workbuddy_skill_name(tool_input, ""),
            Some("docx".to_string())
        );

        let tool_output = r#"{"content":"<command-message>ima-skills</command-message> <command-name>ima-skills</command-name>\nBase directory for this skill: /Users/jackdu/.workbuddy/skills/skill_2053082144792322048\n# ima-skill"}"#;
        assert_eq!(
            extract_workbuddy_skill_name("", tool_output),
            Some("ima-skills".to_string())
        );
        assert_eq!(
            extract_workbuddy_skill_path(tool_output),
            Some("/Users/jackdu/.workbuddy/skills/skill_2053082144792322048".to_string())
        );

        let mcp_output =
            r#"Parameter validation failed for tool \"mcp__ima-mcp__search_knowledge\""#;
        assert_eq!(
            extract_workbuddy_mcp_tool_name("DeferExecuteTool", mcp_output),
            Some("mcp__ima-mcp__search_knowledge".to_string())
        );
    }

    #[test]
    fn test_newmax_extractors() {
        let input = serde_json::json!({
            "skill": "xinwang",
            "args": "sync memory"
        });
        assert_eq!(
            extract_newmax_skill_name("mcp__skill-handler__Skill", &input),
            Some("xinwang".to_string())
        );
        assert_eq!(extract_newmax_skill_name("Bash", &input), None);

        let skills = vec![SkillInfo {
            id: "sk_xinwang".to_string(),
            name: "xinwang".to_string(),
            name_lower: "xinwang".to_string(),
            path: "/Users/jackdu/.agents/skills/xinwang".to_string(),
        }];
        assert_eq!(
            find_matching_skill_by_command(
                "sed -n '1,20p' /Users/jackdu/.agents/skills/xinwang/SKILL.md",
                &skills
            )
            .map(|s| s.id.as_str()),
            Some("sk_xinwang")
        );
    }
}
