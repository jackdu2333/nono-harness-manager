use serde_json::Value;
use sqlx::SqlitePool;

pub struct ToolContext<'a> {
    pub pool: &'a SqlitePool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct ToolOutput {
    pub data: Value,
    pub output_chars: usize,
    pub truncated: bool,
    pub warnings: Vec<String>,
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key.to_lowercase();
    normalized == "key"
        || normalized == "env"
        || normalized.ends_with("_key")
        || normalized.contains("token")
        || normalized.contains("secret")
        || normalized.contains("password")
        || normalized.contains("authorization")
        || normalized.contains("bearer")
        || normalized.contains("api_key")
        || normalized.contains("access_token")
        || normalized.contains("refresh_token")
        || normalized.contains("cookie")
}

fn redact_sensitive_fields_inner(value: Value, redacted: &mut bool) -> Value {
    match value {
        Value::Object(map) => {
            let mut result = serde_json::Map::new();
            for (key, val) in map {
                if is_sensitive_key(&key) {
                    *redacted = true;
                    result.insert(key, Value::String("***".to_string()));
                } else {
                    result.insert(key, redact_sensitive_fields_inner(val, redacted));
                }
            }
            Value::Object(result)
        }
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(|item| redact_sensitive_fields_inner(item, redacted))
                .collect(),
        ),
        other => other,
    }
}

pub fn redact_sensitive_fields(value: Value) -> Value {
    let mut redacted = false;
    redact_sensitive_fields_inner(value, &mut redacted)
}

pub fn sanitize_output(value: Value) -> ToolOutput {
    let original_str = serde_json::to_string(&value).unwrap_or_default();
    let redacted_value = redact_sensitive_fields(value);
    let raw_str = serde_json::to_string(&redacted_value).unwrap_or_default();
    let redacted = original_str != raw_str;
    let char_count = raw_str.chars().count();
    let max_chars = 6000;
    let mut warnings = Vec::new();
    if redacted {
        warnings.push("Sensitive fields redacted from tool output.".to_string());
    }
    if char_count > max_chars {
        let truncated_str = raw_str.chars().take(max_chars).collect::<String>();
        warnings.push("Output truncated to 6000 characters.".to_string());
        ToolOutput {
            data: Value::String(truncated_str),
            output_chars: char_count,
            truncated: true,
            warnings,
        }
    } else {
        ToolOutput {
            data: redacted_value,
            output_chars: char_count,
            truncated: false,
            warnings,
        }
    }
}

pub async fn call_tool(
    name: &str,
    args: Value,
    ctx: &ToolContext<'_>,
) -> Result<ToolOutput, String> {
    match name {
        "get_dashboard_summary" => super::tools::dashboard::get_dashboard_summary(ctx).await,
        "get_skill_analysis" => super::tools::skill::get_skill_analysis(ctx).await,
        "get_agent_analysis" => super::tools::agent::get_agent_analysis(ctx).await,
        "get_mcp_analysis" => super::tools::mcp::get_mcp_analysis(ctx).await,
        "list_pending_proposals" => super::tools::proposal::list_pending_proposals(ctx).await,
        "list_resources" => {
            let resource_type = args
                .get("resource_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_type".to_string())?
                .to_string();
            let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(20);
            super::tools::resource::list_resources(resource_type, limit, ctx).await
        }
        "get_resource_context" => {
            let resource_type = args
                .get("resource_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_type".to_string())?
                .to_string();
            let resource_id = args
                .get("resource_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_id".to_string())?
                .to_string();
            super::tools::resource::get_resource_context(resource_type, resource_id, ctx).await
        }
        "create_governance_proposal" => {
            let resource_type = args
                .get("resource_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_type".to_string())?
                .to_string();
            let resource_id = args
                .get("resource_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_id".to_string())?
                .to_string();
            let proposal_type = args
                .get("proposal_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: proposal_type".to_string())?
                .to_string();
            let proposed_changes = args
                .get("proposed_changes")
                .ok_or_else(|| "Missing required parameter: proposed_changes".to_string())?
                .clone();
            super::tools::proposal::create_governance_proposal(
                resource_type,
                resource_id,
                proposal_type,
                proposed_changes,
                ctx,
            )
            .await
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sanitize_output_redacts_sensitive_fields_recursively() {
        let output = sanitize_output(json!({
            "ok": true,
            "api_key": "sk-test",
            "nested": {
                "authorization": "Bearer abc",
                "items": [
                    { "refresh_token": "refresh" },
                    { "name": "safe" }
                ]
            }
        }));

        assert!(!output.truncated);
        assert_eq!(output.data["api_key"], "***");
        assert_eq!(output.data["nested"]["authorization"], "***");
        assert_eq!(output.data["nested"]["items"][0]["refresh_token"], "***");
        assert_eq!(output.data["nested"]["items"][1]["name"], "safe");
        assert!(output.warnings.iter().any(|w| w.contains("redacted")));
    }

    #[test]
    fn sanitize_output_redacts_before_truncating() {
        let output = sanitize_output(json!({
            "token": "very-secret-token",
            "body": "x".repeat(7000)
        }));

        assert!(output.truncated);
        let data = output.data.as_str().unwrap_or_default();
        assert!(!data.contains("very-secret-token"));
        assert!(output.warnings.iter().any(|w| w.contains("redacted")));
    }
}
