// Health Check 引擎
// 模块加权评分模型 — 各模块独立扣分 + 保底/封顶机制

use super::types::*;
use chrono::Utc;
use sqlx::SqlitePool;
use std::collections::HashMap;

/// 模块定义: (key, label, weight)
const MODULES: &[(&str, &str, f64)] = &[
    ("skills", "Skills", 25.0),
    ("agents", "Agents", 20.0),
    ("mcp", "MCP", 20.0),
    ("paths", "Memory / Knowledge / Project", 0.0), // 无独立权重，归入其他
    ("indexes", "Index consistency", 15.0),
    ("proposals", "Proposals", 10.0),
    ("analytics", "Analytics", 10.0),
];

// paths 模块的 issue 分配到以下子模块（各自从邻近权重中分一杯羹）
// 简化处理：paths 归入 indexes 模块评分
const PATHS_MODULE_KEY: &str = "indexes";

/// 模块内单条 issue 扣分权重
fn issue_penalty(severity: &str) -> f64 {
    match severity {
        "critical" => 8.0,
        "error" => 5.0,
        "warning" => 2.0,
        "info" => 1.0,
        _ => 1.0,
    }
}

/// 运行全局健康检查
pub async fn run_global_check(pool: &SqlitePool) -> Result<HealthReport, String> {
    let mut issues = Vec::new();
    let mut checked_resources = 0usize;
    let mut categories = Vec::new();

    categories.push("agents");
    let (n, mut agent_issues) = super::checks::agents::check(pool).await?;
    checked_resources += n;
    issues.append(&mut agent_issues);

    categories.push("skills");
    let (n, mut skill_issues) = super::checks::skills::check(pool).await?;
    checked_resources += n;
    issues.append(&mut skill_issues);

    categories.push("mcp");
    let (n, mut mcp_issues) = super::checks::mcp::check(pool).await?;
    checked_resources += n;
    issues.append(&mut mcp_issues);

    categories.push("paths");
    let (n, mut path_issues) = super::checks::paths::check(pool).await?;
    checked_resources += n;
    issues.append(&mut path_issues);

    categories.push("indexes");
    let (n, mut index_issues) = super::checks::indexes::check(pool).await?;
    checked_resources += n;
    issues.append(&mut index_issues);

    categories.push("proposals");
    let (n, mut proposal_issues) = super::checks::proposals::check(pool).await?;
    checked_resources += n;
    issues.append(&mut proposal_issues);

    categories.push("analytics");
    let (n, mut analytics_issues) = super::checks::analytics::check(pool).await?;
    checked_resources += n;
    issues.append(&mut analytics_issues);

    Ok(build_report(issues, checked_resources, categories))
}

/// 将 issue 的 source 映射到评分模块 key
fn issue_to_module(issue: &HealthIssue) -> &str {
    let source_lower = issue.source.to_lowercase();
    match source_lower.as_str() {
        "skill" => "skills",
        "agent" => "agents",
        "mcp" => "mcp",
        "memory" | "knowledge" | "project" => PATHS_MODULE_KEY,
        "index" => "indexes",
        "proposal" => "proposals",
        "analytics" => "analytics",
        "system" => "indexes", // 系统级归入 indexes
        _ => "indexes",
    }
}

/// 构建完整报告 — 模块加权评分
fn build_report(
    issues: Vec<HealthIssue>,
    checked_resources: usize,
    checked_categories: Vec<&str>,
) -> HealthReport {
    // 空资源场景
    if checked_resources == 0 && issues.is_empty() {
        let warning = HealthIssue::new(
            "warning",
            "System",
            "status",
            "尚未添加可体检资源",
            "当前没有任何已索引的本地资源，无法进行有效体检。",
            "请先执行资源扫描（Skills / Agents / MCP），建立索引后再运行体检。",
        );
        let mut issue_counts: HashMap<String, usize> = HashMap::new();
        *issue_counts.entry("warning".to_string()).or_default() += 1;

        return HealthReport {
            score: 80,
            status: Some("not_ready".to_string()),
            issues: vec![warning],
            generated_at: Utc::now().to_rfc3339(),
            summary: Some(CheckSummary {
                checked_resources: 0,
                checked_categories: checked_categories
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
                issue_counts,
                score_explanation: vec![
                    "base: 80 (empty system)".to_string(),
                    "status: not_ready".to_string(),
                ],
                module_scores: vec![],
            }),
        };
    }

    // 全局 issue_counts
    let mut global_issue_counts: HashMap<String, usize> = HashMap::new();
    for issue in &issues {
        *global_issue_counts
            .entry(issue.severity.clone())
            .or_default() += 1;
    }

    // 计算每个模块的评分
    let mut module_scores = Vec::new();
    let mut total_score = 0.0f64;
    let mut total_weight = 0.0f64;
    let mut global_critical = 0usize;
    let mut global_error = 0usize;
    let mut index_critical = 0usize;

    // 先统计每个模块的 issue
    let module_defs: HashMap<&str, (&str, f64)> = MODULES
        .iter()
        .filter(|(_, _, w)| *w > 0.0)
        .map(|(k, l, w)| (*k, (*l, *w)))
        .collect();

    for (module_key, (label, weight)) in &module_defs {
        let module_issues: Vec<&HealthIssue> = issues
            .iter()
            .filter(|i| issue_to_module(i) == *module_key)
            .collect();

        let mut mod_counts: HashMap<String, usize> = HashMap::new();
        for issue in &module_issues {
            *mod_counts.entry(issue.severity.clone()).or_default() += 1;
        }

        let c_count = *mod_counts.get("critical").unwrap_or(&0);
        let e_count = *mod_counts.get("error").unwrap_or(&0);
        let w_count = *mod_counts.get("warning").unwrap_or(&0);
        let i_count = *mod_counts.get("info").unwrap_or(&0);

        global_critical += c_count;
        global_error += e_count;
        if *module_key == "indexes" {
            index_critical += c_count;
        }

        // 模块内扣分（带上限）
        let critical_penalty = c_count as f64 * issue_penalty("critical");
        let error_penalty = e_count as f64 * issue_penalty("error");
        let warning_penalty = (w_count as f64 * issue_penalty("warning")).min(weight * 0.5);
        let info_penalty = (i_count as f64 * issue_penalty("info")).min(3.0);

        let raw_penalty = critical_penalty + error_penalty + warning_penalty + info_penalty;
        let penalty = raw_penalty.min(*weight);
        let mod_score = (*weight - penalty).max(0.0);

        total_score += mod_score;
        total_weight += *weight;

        let mod_status = if c_count > 0 {
            "critical"
        } else if e_count > 0 {
            "error"
        } else if w_count > 0 {
            "warning"
        } else {
            "healthy"
        };

        module_scores.push(HealthModuleScore {
            module: module_key.to_string(),
            label: label.to_string(),
            weight: *weight,
            score: mod_score,
            penalty,
            issue_counts: mod_counts,
            status: mod_status.to_string(),
        });
    }

    let mut score = total_score.round() as i64;

    // 构建评分明细
    let mut score_explanation = Vec::new();
    for ms in &module_scores {
        score_explanation.push(format!(
            "{}: {}/{} (penalty: -{:.1})",
            ms.label, ms.score as i64, ms.weight as i64, ms.penalty
        ));
    }

    // 保底机制
    if global_critical == 0 && global_error == 0 {
        score = score.max(75);
        score_explanation.push("floor: 75 (no critical/error)".to_string());
    } else if global_critical == 0 {
        score = score.max(60);
        score_explanation.push("floor: 60 (no critical, has error)".to_string());
    }

    // 封顶机制
    if global_critical >= 3 {
        score = score.min(59);
        score_explanation.push("cap: 59 (3+ critical)".to_string());
    } else if global_critical >= 1 {
        if index_critical > 0 {
            score = score.min(69);
            score_explanation.push("cap: 69 (index critical)".to_string());
        } else {
            score = score.min(79);
            score_explanation.push("cap: 79 (has critical)".to_string());
        }
    }

    score = score.clamp(0, 100);
    score_explanation.push(format!("final score: {score}"));

    let status = score_to_status(score, checked_resources).to_string();

    HealthReport {
        score,
        status: Some(status),
        issues,
        generated_at: Utc::now().to_rfc3339(),
        summary: Some(CheckSummary {
            checked_resources,
            checked_categories: checked_categories
                .iter()
                .map(|s| s.to_string())
                .collect(),
            issue_counts: global_issue_counts,
            score_explanation,
            module_scores,
        }),
    }
}
