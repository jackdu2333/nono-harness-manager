use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::time::Duration;

const API_KEY_PREFIX: &str = "enc:";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmMessage {
    pub role: String,
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String,
    pub r#type: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolDefinition {
    pub r#type: String,
    pub function: FunctionDefinition,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Debug, Clone)]
pub struct LlmConfig {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub api_key: String,
    pub timeout_secs: u64,
    pub max_tokens: u32,
    pub temperature: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmResponse {
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub finish_reason: Option<String>,
    pub usage: Option<LlmUsage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct ProviderCapabilities {
    pub supports_tools: bool,
    pub supports_parallel_tool_calls: bool,
    pub requires_auth: bool,
}

#[derive(Clone)]
pub struct LlmClient {
    pub config: LlmConfig,
    pub http_client: reqwest::Client,
}

fn decode_api_key(stored: &str) -> Option<String> {
    if let Some(encoded) = stored.strip_prefix(API_KEY_PREFIX) {
        B64.decode(encoded.as_bytes())
            .ok()
            .and_then(|b| String::from_utf8(b).ok())
    } else {
        None
    }
}

impl LlmClient {
    pub async fn from_pool(pool: &SqlitePool) -> Result<Self, String> {
        let row = sqlx::query(
            "SELECT enabled, provider, base_url, model, api_key_ref FROM ai_settings WHERE id = 'default'"
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "AI settings not configured. Please configure in settings.".to_string())?;

        let enabled = row.get::<i32, _>("enabled") != 0;
        if !enabled {
            return Err("AI is currently disabled in settings.".to_string());
        }

        let provider = row.get::<String, _>("provider");
        let base_url = row
            .get::<Option<String>, _>("base_url")
            .ok_or_else(|| "Base URL is required".to_string())?;
        let model = row
            .get::<Option<String>, _>("model")
            .ok_or_else(|| "Model name is required".to_string())?;
        let api_key_ref = row.get::<Option<String>, _>("api_key_ref");

        let api_key = if provider == "openai_compatible" {
            let enc_key =
                api_key_ref.ok_or_else(|| "API Key is required for this provider".to_string())?;
            decode_api_key(&enc_key).ok_or_else(|| "Failed to decode API Key".to_string())?
        } else {
            api_key_ref
                .and_then(|k| decode_api_key(&k))
                .unwrap_or_default()
        };

        let config = LlmConfig {
            provider,
            base_url,
            model,
            api_key,
            timeout_secs: 30,
            max_tokens: 2000,
            temperature: 0.7,
        };

        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        Ok(Self {
            config,
            http_client,
        })
    }

    pub fn get_capabilities(&self) -> ProviderCapabilities {
        let supports_tools = if self.config.provider == "openai_compatible" {
            true
        } else {
            let m = self.config.model.to_lowercase();
            m.contains("llama3")
                || m.contains("qwen2.5")
                || m.contains("mistral")
                || m.contains("mixtral")
                || m.contains("command-r")
                || m.contains("gemini")
                || m.contains("gpt")
        };

        ProviderCapabilities {
            supports_tools,
            supports_parallel_tool_calls: false,
            requires_auth: self.config.provider == "openai_compatible",
        }
    }

    pub async fn chat_completion(
        &self,
        messages: Vec<LlmMessage>,
        tools: Option<Vec<ToolDefinition>>,
    ) -> Result<LlmResponse, String> {
        let api_url = {
            let b = self.config.base_url.trim_end_matches('/');
            format!("{}/v1/chat/completions", b)
        };

        let mut req_body = json!({
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
            "parallel_tool_calls": false
        });

        if let Some(t) = tools {
            if !t.is_empty() && self.get_capabilities().supports_tools {
                req_body["tools"] = json!(t);
            }
        }

        let mut req = self
            .http_client
            .post(&api_url)
            .header("Content-Type", "application/json");

        if !self.config.api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.config.api_key));
        }

        let response = req
            .json(&req_body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        let resp_val: Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

        if !status.is_success() {
            let err_msg = resp_val
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown server error");
            return Err(format!("LLM Error ({}): {}", status, err_msg));
        }

        let choice = resp_val
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|c| c.first())
            .ok_or_else(|| "Empty choices in response".to_string())?;

        let message_val = choice
            .get("message")
            .ok_or_else(|| "Missing message in choice".to_string())?;

        let content = message_val
            .get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let tool_calls: Option<Vec<ToolCall>> = message_val
            .get("tool_calls")
            .and_then(|tc| serde_json::from_value(tc.clone()).ok());

        let finish_reason = choice
            .get("finish_reason")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let usage: Option<LlmUsage> = resp_val
            .get("usage")
            .and_then(|u| serde_json::from_value(u.clone()).ok());

        Ok(LlmResponse {
            content,
            tool_calls,
            finish_reason,
            usage,
        })
    }

    pub async fn test_connection(
        provider: &str,
        base_url: &str,
        model: &str,
        api_key: &str,
    ) -> Result<crate::commands::ai::TestConnectionResult, String> {
        let url = match provider {
            "openai_compatible" => {
                let base = base_url.trim_end_matches('/');
                format!("{}/v1/models", base)
            }
            "ollama" => {
                let base = base_url.trim_end_matches('/');
                format!("{}/api/tags", base)
            }
            _ => {
                return Ok(crate::commands::ai::TestConnectionResult {
                    success: false,
                    message: format!("Unsupported provider: {}", provider),
                    model_info: None,
                });
            }
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| format!("Failed to create client: {}", e))?;

        let mut req = client.get(&url);

        if provider == "openai_compatible" && !api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }

        let resp = req.send().await;
        match resp {
            Ok(res) => {
                let status = res.status();
                if status.is_success() {
                    let body = res.text().await.unwrap_or_default();
                    let found = body.contains(model);
                    Ok(crate::commands::ai::TestConnectionResult {
                        success: true,
                        message: if found {
                            format!("连接成功，模型 {} 已找到", model)
                        } else {
                            "连接成功，但未找到指定模型（连接本身正常）".to_string()
                        },
                        model_info: if found { Some(model.to_string()) } else { None },
                    })
                } else {
                    let msg = match status.as_u16() {
                        401 => "认证失败：API Key 无效或已过期".to_string(),
                        403 => "权限不足：请检查 API Key 权限".to_string(),
                        404 => "端点不存在：请检查 Base URL".to_string(),
                        code => format!("HTTP 错误: {}", code),
                    };
                    Ok(crate::commands::ai::TestConnectionResult {
                        success: false,
                        message: msg,
                        model_info: None,
                    })
                }
            }
            Err(e) => Ok(crate::commands::ai::TestConnectionResult {
                success: false,
                message: format!("连接失败: {}", e),
                model_info: None,
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_message_serialization() {
        let msg = LlmMessage {
            role: "user".to_string(),
            content: Some("hello".to_string()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        };
        let serialized = serde_json::to_string(&msg).unwrap();
        assert!(serialized.contains(r#""role":"user""#));
        assert!(serialized.contains(r#""content":"hello""#));
        assert!(!serialized.contains("tool_calls"));
    }

    #[test]
    fn test_llm_response_parsing_only_tool_calls() {
        let raw_json = json!({
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": "gpt-4",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": null,
                    "tool_calls": [{
                        "id": "call_123",
                        "type": "function",
                        "function": {
                            "name": "get_dashboard_summary",
                            "arguments": "{}"
                        }
                    }]
                },
                "finish_reason": "tool_calls"
            }]
        });

        let choice = raw_json["choices"].as_array().unwrap().first().unwrap();
        let message_val = &choice["message"];
        let content = message_val
            .get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let tool_calls: Option<Vec<ToolCall>> = message_val
            .get("tool_calls")
            .and_then(|tc| serde_json::from_value(tc.clone()).ok());

        assert!(content.is_none());
        assert!(tool_calls.is_some());
        let calls = tool_calls.unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].function.name, "get_dashboard_summary");
    }
}
