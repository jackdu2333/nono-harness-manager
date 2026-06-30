use crate::ai::llm_client::{FunctionDefinition, ToolDefinition};
use serde_json::{json, Value};

#[derive(Debug, Clone)]
pub struct RegisteredTool {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

pub fn get_all_tool_definitions() -> Vec<ToolDefinition> {
    get_registered_tools()
        .into_iter()
        .map(|t| ToolDefinition {
            r#type: "function".to_string(),
            function: FunctionDefinition {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        })
        .collect()
}

pub fn find_tool(name: &str) -> Option<RegisteredTool> {
    get_registered_tools()
        .into_iter()
        .find(|t| t.name == name)
}

fn get_registered_tools() -> Vec<RegisteredTool> {
    vec![
        RegisteredTool {
            name: "get_dashboard_summary".to_string(),
            description: "Get general summary stats of skills, agents, MCP servers, and governance proposals in the Harness database. Read-only.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false
            }),
        },
        RegisteredTool {
            name: "get_skill_analysis".to_string(),
            description: "Retrieve overview stats and samples of skills needing review, needing improvement, duplicate groups, and archived skills. Read-only.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false
            }),
        },
        RegisteredTool {
            name: "get_agent_analysis".to_string(),
            description: "Retrieve overview stats and lists of broken, candidate (unconfirmed), active, and ignored agents. Read-only.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false
            }),
        },
        RegisteredTool {
            name: "get_mcp_analysis".to_string(),
            description: "List all MCP servers and their current status, with desensitized environment variable properties. Read-only.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false
            }),
        },
        RegisteredTool {
            name: "list_pending_proposals".to_string(),
            description: "List all active, pending governance proposals (e.g. metadata/description/path fix proposals) submitted in Harness. Read-only.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false
            }),
        },
        RegisteredTool {
            name: "list_resources".to_string(),
            description: "List summary descriptions of all resources for a specific resource type (skill, mcp_server, or agent) up to limit. Read-only.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "resource_type": {
                        "type": "string",
                        "enum": ["skill", "mcp_server", "agent"]
                    },
                    "limit": {
                        "type": "integer",
                        "default": 20,
                        "maximum": 50
                    }
                },
                "required": ["resource_type"],
                "additionalProperties": false
            }),
        },
        RegisteredTool {
            name: "get_resource_context".to_string(),
            description: "Get detail parameters, safe file excerpts, pathways, and evidence logs for a single resource. Read-only.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "resource_type": {
                        "type": "string",
                        "enum": ["skill", "mcp_server", "agent"]
                    },
                    "resource_id": {
                        "type": "string"
                    }
                },
                "required": ["resource_type", "resource_id"],
                "additionalProperties": false
            }),
        },
        RegisteredTool {
            name: "create_governance_proposal".to_string(),
            description: "Create an intelligence metadata governance proposal to update description, metadata, or suggest status change. Subject to local Trust Policy.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "resource_type": {
                        "type": "string",
                        "enum": ["skill", "mcp_server", "agent"]
                    },
                    "resource_id": {
                        "type": "string"
                    },
                    "proposal_type": {
                        "type": "string",
                        "enum": [
                            "update_metadata", "improve_description", "suggest_archive", "suggest_merge", "improve_ai_readiness",
                            "update_agent_metadata", "suggest_agent_confirmation", "suggest_agent_ignore", "fix_agent_paths", "explain_agent_launch_strategy", "improve_agent_detection_rule",
                            "update_mcp_metadata", "suggest_mcp_health_fix", "improve_mcp_description", "improve_tool_schema"
                        ]
                    },
                    "proposed_changes": {
                        "type": "object"
                    }
                },
                "required": ["resource_type", "resource_id", "proposal_type", "proposed_changes"],
                "additionalProperties": false
            }),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_tools_registered() {
        let tools = get_all_tool_definitions();
        assert_eq!(tools.len(), 8);
    }

    #[test]
    fn test_tool_schemas_have_no_additional_properties() {
        for tool in get_registered_tools() {
            let add_prop = tool.parameters.get("additionalProperties");
            assert!(add_prop.is_some());
            assert_eq!(add_prop.unwrap().as_bool(), Some(false));
        }
    }

    #[test]
    fn test_list_resources_requires_type() {
        let tool = find_tool("list_resources").unwrap();
        let required = tool.parameters.get("required").unwrap().as_array().unwrap();
        assert!(required.iter().any(|v| v.as_str() == Some("resource_type")));
    }
}
