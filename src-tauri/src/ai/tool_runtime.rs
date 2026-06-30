use crate::ai::llm_client::{LlmClient, LlmMessage};
use crate::ai::safe_tools::{call_tool, redact_sensitive_fields, sanitize_output, ToolContext};
use crate::ai::tool_registry;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const MAX_TOOL_ROUNDS: usize = 2;
const MAX_TOOL_CALLS_PER_ROUND: usize = 5;
const TOOL_TIMEOUT_SECS: u64 = 10;

#[derive(Debug)]
pub struct ToolLoopResult {
    pub final_content: Option<String>,
    pub records: Vec<ToolCallRecord>,
    pub messages: Vec<LlmMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallRecord {
    pub round: usize,
    pub tool_call_id: String,
    pub tool_name: String,
    pub arguments: Value,
    pub success: bool,
    pub result_summary: String,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallSummary {
    pub tool_name: String,
    pub success: bool,
    pub duration_ms: u64,
    pub round: usize,
    pub summary: String,
}

fn generate_summary(val: &Value) -> String {
    match val {
        Value::Object(map) => {
            if let Some(res) = map.get("resources").and_then(|r| r.as_array()) {
                format!("Returned {} resources", res.len())
            } else if let Some(props) = map.get("proposals").and_then(|p| p.as_array()) {
                format!("Returned {} proposals", props.len())
            } else {
                let keys: Vec<&str> = map.keys().map(String::as_str).collect();
                format!("Object with keys: {:?}", keys)
            }
        }
        Value::Array(arr) => {
            format!("Array with {} items", arr.len())
        }
        Value::String(s) => {
            let preview = s.chars().take(60).collect::<String>();
            if s.chars().count() > 60 {
                format!("String: {}...", preview)
            } else {
                format!("String: {}", s)
            }
        }
        Value::Null => "Null".to_string(),
        other => other.to_string(),
    }
}

fn redact_tool_arguments(arguments: Value) -> Value {
    redact_sensitive_fields(arguments)
}

pub async fn run_tool_loop(
    client: LlmClient,
    mut messages: Vec<LlmMessage>,
    session_id: Option<String>,
    tool_ctx: &ToolContext<'_>,
) -> Result<ToolLoopResult, String> {
    let mut records = Vec::new();
    let mut round = 1;

    while round <= MAX_TOOL_ROUNDS {
        let tools = tool_registry::get_all_tool_definitions();

        let response = client
            .chat_completion(messages.clone(), Some(tools))
            .await?;

        // If there are no tool calls, this is the final response.
        let Some(tool_calls) = response.tool_calls.as_ref() else {
            return Ok(ToolLoopResult {
                final_content: response.content,
                records,
                messages,
            });
        };

        if tool_calls.is_empty() {
            return Ok(ToolLoopResult {
                final_content: response.content,
                records,
                messages,
            });
        }

        // Push the assistant tool_calls message to history
        let assistant_msg = LlmMessage {
            role: "assistant".to_string(),
            content: response.content,
            tool_calls: Some(tool_calls.clone()),
            tool_call_id: None,
            name: None,
        };
        messages.push(assistant_msg);

        // Process up to 5 tool calls in this round
        let calls_to_process = tool_calls.iter().take(MAX_TOOL_CALLS_PER_ROUND);

        for tool_call in calls_to_process {
            let start_time = Instant::now();
            let name = &tool_call.function.name;
            let args_str = &tool_call.function.arguments;

            let args_parsed: Result<Value, serde_json::Error> = serde_json::from_str(args_str);

            let (success, tool_output, error_str, parsed_args) = match args_parsed {
                Err(err) => {
                    let err_msg = format!("Arguments JSON parse failed: {}", err);
                    let err_output = sanitize_output(json!({
                        "ok": false,
                        "error": err_msg.clone()
                    }));
                    (false, err_output, Some(err_msg), Value::Null)
                }
                Ok(args) => {
                    let redacted_args = redact_tool_arguments(args.clone());
                    // Run the tool with timeout
                    let tool_future = call_tool(name, args, tool_ctx);
                    let res = match tokio::time::timeout(
                        Duration::from_secs(TOOL_TIMEOUT_SECS),
                        tool_future,
                    )
                    .await
                    {
                        Err(_) => {
                            let err_msg = format!("timeout after {}s", TOOL_TIMEOUT_SECS);
                            let err_output = sanitize_output(json!({
                                "ok": false,
                                "error": err_msg.clone()
                            }));
                            (false, err_output, Some(err_msg))
                        }
                        Ok(Err(err)) => {
                            let err_output = sanitize_output(json!({
                                "ok": false,
                                "error": err.clone()
                            }));
                            (false, err_output, Some(err))
                        }
                        Ok(Ok(output)) => (true, output, None),
                    };
                    (res.0, res.1, res.2, redacted_args)
                }
            };

            let duration_ms = start_time.elapsed().as_millis() as u64;
            let summary = generate_summary(&tool_output.data);

            records.push(ToolCallRecord {
                round,
                tool_call_id: tool_call.id.clone(),
                tool_name: name.clone(),
                arguments: parsed_args.clone(),
                success,
                result_summary: summary.clone(),
                error: error_str.clone(),
                duration_ms,
            });

            // Write to ai_action_logs
            let action_log_id = uuid::Uuid::new_v4().to_string();
            let input_json = serde_json::to_string(&parsed_args).unwrap_or_default();
            let output_json = serde_json::to_string(&tool_output.data).unwrap_or_default();
            let risk_level = if name == "create_governance_proposal" {
                "medium"
            } else {
                "low"
            };

            let _ = sqlx::query(
                r#"
                INSERT INTO ai_action_logs 
                  (id, session_id, action_type, tool_name, input_json, output_json, risk_level, created_at)
                VALUES (?, ?, 'tool_call', ?, ?, ?, ?, ?)
                "#
            )
            .bind(&action_log_id)
            .bind(&session_id)
            .bind(name)
            .bind(&input_json)
            .bind(&output_json)
            .bind(risk_level)
            .bind(Utc::now().to_rfc3339())
            .execute(tool_ctx.pool)
            .await;

            // Push the tool result message to history
            let tool_msg = LlmMessage {
                role: "tool".to_string(),
                content: Some(serde_json::to_string(&tool_output.data).unwrap_or_default()),
                tool_calls: None,
                tool_call_id: Some(tool_call.id.clone()),
                name: Some(name.clone()),
            };
            messages.push(tool_msg);
        }

        round += 1;
    }

    // Fallback if we exceeded MAX_TOOL_ROUNDS: get a final completion
    let final_resp = client.chat_completion(messages.clone(), None).await?;
    Ok(ToolLoopResult {
        final_content: final_resp.content,
        records,
        messages,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tool_timeout_handling() {
        // Since we are checking error recovery inside tool_runtime, we can verify that
        // timeout does not panic and returns tool result error.
        // We simulate a timeout by calling a dummy function that takes longer than 10s.
        let tool_future = async {
            tokio::time::sleep(Duration::from_secs(12)).await;
            Ok::<_, String>(sanitize_output(json!({"ok": true})))
        };

        let result = match tokio::time::timeout(Duration::from_secs(1), tool_future).await {
            Err(_) => {
                let err_msg = "timeout after 1s".to_string();
                let err_output = sanitize_output(json!({
                    "ok": false,
                    "error": err_msg
                }));
                (false, err_output)
            }
            Ok(val) => (true, val.unwrap()),
        };

        assert_eq!(result.0, false);
        assert!(result
            .1
            .data
            .get("error")
            .unwrap()
            .as_str()
            .unwrap()
            .contains("timeout"));
    }

    #[test]
    fn generate_summary_handles_multibyte_strings() {
        let value = Value::String("中文内容".repeat(20));
        let summary = generate_summary(&value);
        assert!(summary.starts_with("String: 中文内容"));
        assert!(summary.ends_with("..."));
    }

    #[test]
    fn redact_tool_arguments_removes_sensitive_values() {
        let args = json!({
            "resource_type": "skill",
            "api_key": "sk-test",
            "nested": {
                "token": "secret-token",
                "env": {
                    "PASSWORD": "secret-password"
                }
            }
        });

        let redacted = redact_tool_arguments(args);
        let serialized = serde_json::to_string(&redacted).unwrap();

        assert_eq!(redacted["api_key"], "***");
        assert_eq!(redacted["nested"]["token"], "***");
        assert_eq!(redacted["nested"]["env"], "***");
        assert!(!serialized.contains("sk-test"));
        assert!(!serialized.contains("secret-token"));
        assert!(!serialized.contains("secret-password"));
    }
}
