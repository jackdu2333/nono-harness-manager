use sqlx::SqlitePool;
use serde_json::Value;

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

pub fn sanitize_output(value: Value) -> ToolOutput {
    let raw_str = serde_json::to_string(&value).unwrap_or_default();
    let char_count = raw_str.chars().count();
    let max_chars = 6000;
    if char_count > max_chars {
        let truncated_str = raw_str.chars().take(max_chars).collect::<String>();
        let mut warnings = Vec::new();
        warnings.push("Output truncated to 6000 characters.".to_string());
        ToolOutput {
            data: Value::String(truncated_str),
            output_chars: max_chars,
            truncated: true,
            warnings,
        }
    } else {
        ToolOutput {
            data: value,
            output_chars: char_count,
            truncated: false,
            warnings: Vec::new(),
        }
    }
}

pub async fn call_tool(
    name: &str,
    args: Value,
    ctx: &ToolContext<'_>,
) -> Result<ToolOutput, String> {
    match name {
        "get_dashboard_summary" => {
            super::tools::dashboard::get_dashboard_summary(ctx).await
        }
        "get_skill_analysis" => {
            super::tools::skill::get_skill_analysis(ctx).await
        }
        "get_agent_analysis" => {
            super::tools::agent::get_agent_analysis(ctx).await
        }
        "get_mcp_analysis" => {
            super::tools::mcp::get_mcp_analysis(ctx).await
        }
        "list_pending_proposals" => {
            super::tools::proposal::list_pending_proposals(ctx).await
        }
        "list_resources" => {
            let resource_type = args.get("resource_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_type".to_string())?
                .to_string();
            let limit = args.get("limit")
                .and_then(|v| v.as_i64())
                .unwrap_or(20);
            super::tools::resource::list_resources(resource_type, limit, ctx).await
        }
        "get_resource_context" => {
            let resource_type = args.get("resource_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_type".to_string())?
                .to_string();
            let resource_id = args.get("resource_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_id".to_string())?
                .to_string();
            super::tools::resource::get_resource_context(resource_type, resource_id, ctx).await
        }
        "create_governance_proposal" => {
            let resource_type = args.get("resource_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_type".to_string())?
                .to_string();
            let resource_id = args.get("resource_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: resource_id".to_string())?
                .to_string();
            let proposal_type = args.get("proposal_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: proposal_type".to_string())?
                .to_string();
            let proposed_changes = args.get("proposed_changes")
                .ok_or_else(|| "Missing required parameter: proposed_changes".to_string())?
                .clone();
            super::tools::proposal::create_governance_proposal(
                resource_type,
                resource_id,
                proposal_type,
                proposed_changes,
                ctx,
            ).await
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}
