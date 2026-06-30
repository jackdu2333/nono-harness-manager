// Health Check 类型定义
// 模块加权评分模型 — 支持 module_scores / status / score_explanation

use serde::Serialize;
use std::collections::HashMap;

/// 单条健康问题
#[derive(Debug, Serialize, Clone)]
pub struct HealthIssue {
    pub severity: String,
    pub source: String,
    pub title: String,
    pub resource_name: Option<String>,
    pub resource_path: Option<String>,
    pub description: String,
    pub suggestion: String,
    pub status: String,
    /// 问题分类: path / metadata / index / status / analytics / proposal / security
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// 资源类型: Agent / Skill / MCP / Memory / Knowledge / Project / Proposal / Analytics / Index
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_type: Option<String>,
    /// 资源 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_id: Option<String>,
    /// 证据描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<String>,
}

impl HealthIssue {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        severity: &str,
        source: &str,
        category: &str,
        title: impl Into<String>,
        description: impl Into<String>,
        suggestion: impl Into<String>,
    ) -> Self {
        Self {
            severity: severity.to_string(),
            source: source.to_string(),
            category: Some(category.to_string()),
            title: title.into(),
            description: description.into(),
            suggestion: suggestion.into(),
            resource_name: None,
            resource_path: None,
            resource_type: None,
            resource_id: None,
            evidence: None,
            status: "open".to_string(),
        }
    }

    pub fn with_resource(
        mut self,
        name: impl Into<Option<String>>,
        path: impl Into<Option<String>>,
    ) -> Self {
        self.resource_name = name.into();
        self.resource_path = path.into();
        self
    }

    pub fn with_resource_id(mut self, rtype: &str, id: &str) -> Self {
        self.resource_type = Some(rtype.to_string());
        self.resource_id = Some(id.to_string());
        self
    }

    pub fn with_evidence(mut self, evidence: impl Into<String>) -> Self {
        self.evidence = Some(evidence.into());
        self
    }
}

/// 单模块评分
#[derive(Debug, Serialize, Clone)]
pub struct HealthModuleScore {
    pub module: String,
    pub label: String,
    pub weight: f64,
    pub score: f64,
    pub penalty: f64,
    pub issue_counts: HashMap<String, usize>,
    pub status: String, // healthy / warning / error / critical / not_applicable
}

/// 检查范围统计
#[derive(Debug, Serialize, Clone, Default)]
pub struct CheckSummary {
    pub checked_resources: usize,
    pub checked_categories: Vec<String>,
    pub issue_counts: HashMap<String, usize>,
    pub score_explanation: Vec<String>,
    /// 模块评分明细
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub module_scores: Vec<HealthModuleScore>,
}

/// 完整的健康体检报告
#[derive(Debug, Serialize)]
pub struct HealthReport {
    pub score: i64,
    /// 健康状态: healthy / good / needs_attention / degraded / critical / not_ready
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    pub issues: Vec<HealthIssue>,
    pub generated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<CheckSummary>,
}

/// 健康状态判定
pub fn score_to_status(score: i64, checked_resources: usize) -> &'static str {
    if checked_resources == 0 {
        return "not_ready";
    }
    match score {
        90..=100 => "healthy",
        75..=89 => "good",
        60..=74 => "needs_attention",
        40..=59 => "degraded",
        _ => "critical",
    }
}
