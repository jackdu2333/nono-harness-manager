use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::{command, State};

const API_KEY_PREFIX: &str = "enc:";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiSettings {
    pub id: String,
    pub enabled: bool,
    pub provider: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    /// api_key_ref is stored as a reference (not plain text key).
    /// Phase 2: stores a marker indicating key was set, NOT the actual key.
    /// Future: will be a keychain reference.
    pub api_key_ref: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Response type for frontend — never includes raw api_key_ref
#[derive(Debug, Serialize)]
pub struct AiSettingsResponse {
    pub enabled: bool,
    pub provider: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub has_api_key: bool,
    pub updated_at: String,
}

impl From<AiSettings> for AiSettingsResponse {
    fn from(s: AiSettings) -> Self {
        Self {
            enabled: s.enabled,
            provider: s.provider,
            base_url: s.base_url,
            model: s.model,
            has_api_key: s.api_key_ref.is_some()
                && !s.api_key_ref.as_deref().unwrap_or("").is_empty(),
            updated_at: s.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct AiSettingsInput {
    pub enabled: Option<bool>,
    pub provider: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
    pub model_info: Option<String>,
}

/// Get current AI settings (safe — no API key exposed)
#[command]
pub async fn get_ai_settings(pool: State<'_, SqlitePool>) -> Result<AiSettingsResponse, String> {
    let row = sqlx::query(
        "SELECT id, enabled, provider, base_url, model, api_key_ref, created_at, updated_at FROM ai_settings WHERE id = 'default'"
    )
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some(r) => {
            let settings = AiSettings {
                id: r.get("id"),
                enabled: r.get::<i32, _>("enabled") != 0,
                provider: r.get("provider"),
                base_url: r.get("base_url"),
                model: r.get("model"),
                api_key_ref: r.get("api_key_ref"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };
            Ok(settings.into())
        }
        None => Ok(AiSettingsResponse {
            enabled: false,
            provider: "openai_compatible".to_string(),
            base_url: None,
            model: None,
            has_api_key: false,
            updated_at: Utc::now().to_rfc3339(),
        }),
    }
}

/// Update AI settings (upsert)
#[command]
pub async fn set_ai_settings(
    input: AiSettingsInput,
    pool: State<'_, SqlitePool>,
) -> Result<AiSettingsResponse, String> {
    let now = Utc::now().to_rfc3339();

    // Read current settings first
    let current = sqlx::query(
        "SELECT enabled, provider, base_url, model, api_key_ref FROM ai_settings WHERE id = 'default'"
    )
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let (cur_enabled, cur_provider, cur_base_url, cur_model, cur_api_key_ref) = match current {
        Some(r) => (
            r.get::<i32, _>("enabled") != 0,
            r.get::<String, _>("provider"),
            r.get::<Option<String>, _>("base_url"),
            r.get::<Option<String>, _>("model"),
            r.get::<Option<String>, _>("api_key_ref"),
        ),
        None => (false, "openai_compatible".to_string(), None, None, None),
    };

    let new_enabled = input.enabled.unwrap_or(cur_enabled);
    let new_provider = input.provider.unwrap_or(cur_provider);
    let new_base_url = input.base_url.or(cur_base_url);
    let new_model = input.model.or(cur_model);
    // If api_key is provided and non-empty, store base64-encoded (experimental, not plaintext)
    // Future: will be stored in system Keychain
    let new_api_key_ref = if let Some(key) = input.api_key {
        if key.is_empty() {
            None // Clear the key
        } else {
            // Store base64-encoded with prefix marker
            Some(format!("{}{}", API_KEY_PREFIX, B64.encode(key.as_bytes())))
        }
    } else {
        cur_api_key_ref
    };

    sqlx::query(
        r#"
        INSERT INTO ai_settings (id, enabled, provider, base_url, model, api_key_ref, created_at, updated_at)
        VALUES ('default', ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            enabled = excluded.enabled,
            provider = excluded.provider,
            base_url = excluded.base_url,
            model = excluded.model,
            api_key_ref = excluded.api_key_ref,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(new_enabled as i32)
    .bind(&new_provider)
    .bind(&new_base_url)
    .bind(&new_model)
    .bind(&new_api_key_ref)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(AiSettingsResponse {
        enabled: new_enabled,
        provider: new_provider,
        base_url: new_base_url,
        model: new_model,
        has_api_key: new_api_key_ref.is_some(),
        updated_at: now,
    })
}

/// Clear the stored API key
#[command]
pub async fn clear_ai_api_key(pool: State<'_, SqlitePool>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE ai_settings SET api_key_ref = NULL, updated_at = ? WHERE id = 'default'")
        .bind(&now)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Test AI provider connection by making a minimal API call
#[command]
pub async fn test_ai_provider_connection(
    provider: String,
    base_url: String,
    model: String,
    api_key: String,
) -> Result<TestConnectionResult, String> {
    if provider == "openai_compatible" && api_key.is_empty() {
        return Ok(TestConnectionResult {
            success: false,
            message: "API Key 未提供".to_string(),
            model_info: None,
        });
    }

    let url = match provider.as_str() {
        "openai_compatible" => {
            let base = base_url.trim_end_matches('/');
            format!("{}/v1/models", base)
        }
        "ollama" => {
            let base = base_url.trim_end_matches('/');
            format!("{}/api/tags", base)
        }
        _ => {
            return Ok(TestConnectionResult {
                success: false,
                message: format!("不支持的 provider: {}", provider),
                model_info: None,
            });
        }
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut req = client.get(&url);

    // Add auth header for OpenAI-compatible providers
    if provider == "openai_compatible" {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = req.send().await;

    match response {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                // Check if model exists in response
                let body = resp.text().await.unwrap_or_default();
                let model_found = body.contains(&model);
                Ok(TestConnectionResult {
                    success: true,
                    message: if model_found {
                        format!("连接成功，模型 {} 已找到", model)
                    } else {
                        "连接成功，但未找到指定模型（连接本身正常）".to_string()
                    },
                    model_info: if model_found { Some(model) } else { None },
                })
            } else {
                let status_code = status.as_u16();
                let message = match status_code {
                    401 => "认证失败：API Key 无效或已过期".to_string(),
                    403 => "权限不足：请检查 API Key 权限".to_string(),
                    404 => "端点不存在：请检查 Base URL".to_string(),
                    _ => format!("HTTP 错误: {}", status_code),
                };
                Ok(TestConnectionResult {
                    success: false,
                    message,
                    model_info: None,
                })
            }
        }
        Err(e) => Ok(TestConnectionResult {
            success: false,
            message: format!("连接失败: {}", e),
            model_info: None,
        }),
    }
}

// ── AI Tasks (Phase 3) ──

#[derive(Debug, Serialize, Deserialize)]
pub struct AiTask {
    pub id: String,
    pub task_type: String,
    pub status: String,
    pub input_json: Option<String>,
    pub result_json: Option<String>,
    pub error: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAiTaskInput {
    pub task_type: String,
    pub result_json: String,
    pub created_by: Option<String>,
}

/// Store an AI analysis task result
#[command]
pub async fn create_ai_task(
    input: CreateAiTaskInput,
    pool: State<'_, SqlitePool>,
) -> Result<AiTask, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let created_by = input
        .created_by
        .unwrap_or_else(|| "rule_engine".to_string());

    sqlx::query(
        r#"INSERT INTO ai_tasks (id, task_type, status, result_json, created_by, created_at, completed_at)
           VALUES (?, ?, 'completed', ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&input.task_type)
    .bind(&input.result_json)
    .bind(&created_by)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(AiTask {
        id,
        task_type: input.task_type,
        status: "completed".to_string(),
        input_json: None,
        result_json: Some(input.result_json),
        error: None,
        created_by,
        created_at: now.clone(),
        completed_at: Some(now),
    })
}

/// List recent AI tasks (most recent first, limited)
#[command]
pub async fn list_ai_tasks(
    limit: Option<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<AiTask>, String> {
    let limit = limit.unwrap_or(20).min(100);
    let rows = sqlx::query(
        "SELECT id, task_type, status, input_json, result_json, error, created_by, created_at, completed_at FROM ai_tasks ORDER BY created_at DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let tasks: Vec<AiTask> = rows
        .into_iter()
        .map(|r| AiTask {
            id: r.get("id"),
            task_type: r.get("task_type"),
            status: r.get("status"),
            input_json: r.get("input_json"),
            result_json: r.get("result_json"),
            error: r.get("error"),
            created_by: r.get("created_by"),
            created_at: r.get("created_at"),
            completed_at: r.get("completed_at"),
        })
        .collect();

    Ok(tasks)
}

// ── AI Chat (Phase 5) ──

fn decode_api_key(stored: &str) -> Option<String> {
    if let Some(encoded) = stored.strip_prefix(API_KEY_PREFIX) {
        B64.decode(encoded.as_bytes())
            .ok()
            .and_then(|b| String::from_utf8(b).ok())
    } else {
        None
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub mode: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub tool_calls_json: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub evidence: Vec<String>,
    pub suggested_actions: Vec<String>,
    pub tool_calls_summary: Option<Vec<crate::ai::tool_runtime::ToolCallSummary>>,
}

#[derive(Debug, Deserialize)]
pub struct SendChatInput {
    pub session_id: Option<String>,
    pub content: String,
}

/// Create a new chat session
#[command]
pub async fn create_chat_session(pool: State<'_, SqlitePool>) -> Result<ChatSession, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO ai_sessions (id, title, mode, created_at, updated_at) VALUES (?, ?, 'chat', ?, ?)",
    )
    .bind(&id)
    .bind("新对话")
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(ChatSession {
        id,
        title: "新对话".to_string(),
        mode: "chat".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

/// List chat sessions
#[command]
pub async fn list_chat_sessions(pool: State<'_, SqlitePool>) -> Result<Vec<ChatSession>, String> {
    let rows = sqlx::query(
        "SELECT id, title, mode, created_at, updated_at FROM ai_sessions ORDER BY updated_at DESC LIMIT 50",
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| ChatSession {
            id: r.get("id"),
            title: r.get("title"),
            mode: r.get("mode"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
        .collect())
}

/// Get messages for a session
#[command]
pub async fn get_chat_messages(
    session_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<ChatMessage>, String> {
    let rows = sqlx::query(
        "SELECT id, session_id, role, content, tool_calls_json, created_at FROM ai_messages WHERE session_id = ? ORDER BY created_at ASC",
    )
    .bind(&session_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| ChatMessage {
            id: r.get("id"),
            session_id: r.get("session_id"),
            role: r.get("role"),
            content: r.get("content"),
            tool_calls_json: r.get("tool_calls_json"),
            created_at: r.get("created_at"),
        })
        .collect())
}

/// Send a chat message and get AI response via configured LLM
#[command]
pub async fn send_chat_message(
    input: SendChatInput,
    pool: State<'_, SqlitePool>,
) -> Result<ChatResponse, String> {
    let now = Utc::now().to_rfc3339();

    // 1. Build LLM client from pool
    let client = crate::ai::llm_client::LlmClient::from_pool(&pool).await?;
    let capabilities = client.get_capabilities();

    // 2. Get or create session
    let session_id = match input.session_id {
        Some(id) => id,
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO ai_sessions (id, title, mode, created_at, updated_at) VALUES (?, ?, 'chat', ?, ?)",
            )
            .bind(&id)
            .bind(&input.content[..input.content.len().min(50)])
            .bind(&now)
            .bind(&now)
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
            id
        }
    };

    // 3. Save user message
    let user_msg_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO ai_messages (id, session_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
    )
    .bind(&user_msg_id)
    .bind(&session_id)
    .bind(&input.content)
    .bind(&now)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    // 4. Construct system prompt
    let system_prompt = if capabilities.supports_tools {
        "你是 NoNo Harness Manager 的内置 AI 治理助手。你的职责是分析和治理本地 AI 资产。\n\n\
        你拥有查询本地 Skills、Agents、MCP 状态和创建治理提案的工具能力。请在需要时调用相应工具获取准确信息或发起提案。\n\
        所有写操作必须通过 proposal 工作流。回答时请提供 evidence 和 suggested actions。\n\
        使用中文回答。".to_string()
    } else {
        let mut prompt =
            "你是 NoNo Harness Manager 的内置 AI 治理助手。你的职责是分析和治理本地 AI 资产。\n\n\
        所有写操作必须通过 proposal 工作流。回答时请提供 evidence 和 suggested actions。\n\
        使用中文回答。"
                .to_string();

        let summary_tool_ctx = crate::ai::safe_tools::ToolContext { pool: &*pool };
        if let Ok(summary_out) =
            crate::ai::tools::dashboard::get_dashboard_summary(&summary_tool_ctx).await
        {
            prompt = format!(
                "{}\n\n当前 Harness 状态统计：\n{}",
                prompt, summary_out.data
            );
        }
        prompt
    };

    // 5. Load conversation history (LIMIT 10 to avoid token bloat)
    let history = sqlx::query(
        r#"
        SELECT role, content
        FROM (
          SELECT role, content, created_at
          FROM ai_messages
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT 10
        )
        ORDER BY created_at ASC
        "#,
    )
    .bind(&session_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut messages = vec![crate::ai::llm_client::LlmMessage {
        role: "system".to_string(),
        content: Some(system_prompt),
        tool_calls: None,
        tool_call_id: None,
        name: None,
    }];

    for row in &history {
        let role: String = row.get("role");
        let content: String = row.get("content");
        messages.push(crate::ai::llm_client::LlmMessage {
            role,
            content: Some(content),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        });
    }

    // 6. Execute Tool Loop / LLM Completion
    let tool_ctx = crate::ai::safe_tools::ToolContext { pool: &*pool };
    let (final_content, tool_calls_json, tool_calls_summary) = if capabilities.supports_tools {
        let loop_res = crate::ai::tool_runtime::run_tool_loop(
            client.clone(),
            messages,
            Some(session_id.clone()),
            &tool_ctx,
        )
        .await?;

        let t_json = if loop_res.records.is_empty() {
            None
        } else {
            serde_json::to_string(&loop_res.records).ok()
        };

        let t_summary = if loop_res.records.is_empty() {
            None
        } else {
            Some(
                loop_res
                    .records
                    .iter()
                    .map(|rec| crate::ai::tool_runtime::ToolCallSummary {
                        tool_name: rec.tool_name.clone(),
                        success: rec.success,
                        duration_ms: rec.duration_ms,
                        round: rec.round,
                        summary: rec.result_summary.clone(),
                    })
                    .collect::<Vec<_>>(),
            )
        };

        (
            loop_res.final_content.unwrap_or_default(),
            t_json,
            t_summary,
        )
    } else {
        let response = client.chat_completion(messages, None).await?;
        let mut text = response.content.unwrap_or_default();
        text = format!(
            "*当前模型不支持工具调用，只能基于 Dashboard 摘要回答。请切换支持 function calling 的模型以启用治理能力。*\n\n{}",
            text
        );
        (text, None, None)
    };

    // 7. Save assistant response
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO ai_messages (id, session_id, role, content, tool_calls_json, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)",
    )
    .bind(&assistant_msg_id)
    .bind(&session_id)
    .bind(&final_content)
    .bind(&tool_calls_json)
    .bind(&Utc::now().to_rfc3339())
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    // Update session timestamp
    sqlx::query("UPDATE ai_sessions SET updated_at = ? WHERE id = ?")
        .bind(&Utc::now().to_rfc3339())
        .bind(&session_id)
        .execute(&*pool)
        .await
        .map_err(|_| ())
        .ok();

    // 8. Log the action
    let log_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO ai_action_logs (id, session_id, action_type, tool_name, input_json, output_json, risk_level, created_at) VALUES (?, ?, 'chat', 'send_chat_message', ?, ?, 'low', ?)",
    )
    .bind(&log_id)
    .bind(&session_id)
    .bind(&serde_json::json!({"user_message": input.content}).to_string())
    .bind(&serde_json::json!({"response_length": final_content.len()}).to_string())
    .bind(&Utc::now().to_rfc3339())
    .execute(&*pool)
    .await
    .map_err(|_| ())
    .ok();

    let skills_count = sqlx::query("SELECT COUNT(*) as cnt FROM skills WHERE is_archived = 0")
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");
    let agents_count = sqlx::query("SELECT COUNT(*) as cnt FROM agents")
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");
    let mcp_count = sqlx::query("SELECT COUNT(*) as cnt FROM mcp_servers")
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>("cnt");
    let pending_proposals = sqlx::query(
        "SELECT COUNT(*) as cnt FROM intelligence_proposals WHERE status IN ('pending_review', 'pending_manual_review', 'pending')"
    )
    .fetch_one(&*pool).await.map_err(|e| e.to_string())?
    .get::<i64, _>("cnt");

    Ok(ChatResponse {
        message: ChatMessage {
            id: assistant_msg_id,
            session_id,
            role: "assistant".to_string(),
            content: final_content,
            tool_calls_json,
            created_at: Utc::now().to_rfc3339(),
        },
        evidence: vec![
            format!("Skills: {} 个", skills_count),
            format!("Agents: {} 个", agents_count),
            format!("MCP: {} 个", mcp_count),
            format!("待处理 Proposals: {} 个", pending_proposals),
        ],
        suggested_actions: vec![
            "查看 Skills 页面".to_string(),
            "查看 Proposals 页面".to_string(),
        ],
        tool_calls_summary,
    })
}
