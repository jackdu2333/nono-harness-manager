// Index Consistency 检查 — 9 项
// 检查跨表引用完整性和重复索引

use super::super::types::HealthIssue;
use sqlx::SqlitePool;

pub async fn check(pool: &SqlitePool) -> Result<(usize, Vec<HealthIssue>), String> {
    let mut issues = Vec::new();
    let mut checked = 0usize;

    // 1. project_resource_bindings → project_id 不存在
    let orphan_bindings: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT b.id, b.project_id, b.resource_type, b.resource_id \
         FROM project_resource_bindings b \
         LEFT JOIN projects p ON b.project_id = p.id \
         WHERE p.id IS NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for (bid, pid, rtype, rid) in orphan_bindings {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "error",
                "Index",
                "index",
                "Binding 引用不存在的 project",
                format!("binding {bid} → project_id={pid} 不存在"),
                "删除失效 binding 或修正 project_id。",
            )
            .with_resource(Some(format!("binding:{bid}")), None)
            .with_resource_id("Binding", &bid)
            .with_evidence(&format!(
                "project_id={pid}, resource_type={rtype}, resource_id={rid}"
            )),
        );
    }

    // 2. project_resource_bindings → resource 不存在
    let orphan_resources: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT b.id, b.resource_type, b.resource_id, b.project_id \
         FROM project_resource_bindings b \
         WHERE b.resource_type = 'Skill' AND b.resource_id NOT IN (SELECT id FROM skills) \
            OR b.resource_type = 'Agent' AND b.resource_id NOT IN (SELECT id FROM agents) \
            OR b.resource_type = 'MCP' AND b.resource_id NOT IN (SELECT id FROM mcp_servers) \
            OR b.resource_type = 'Memory' AND b.resource_id NOT IN (SELECT id FROM memory_sources) \
            OR b.resource_type = 'Knowledge' AND b.resource_id NOT IN (SELECT id FROM knowledge_bases)",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for (bid, rtype, rid, pid) in orphan_resources {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "error",
                "Index",
                "index",
                "Binding 引用不存在的 resource",
                format!("binding {bid} → resource_type={rtype}, resource_id={rid} 不存在"),
                "删除失效 binding 或修正引用。",
            )
            .with_resource(Some(format!("binding:{bid}")), None)
            .with_resource_id("Binding", &bid)
            .with_evidence(&format!(
                "resource_type={rtype}, resource_id={rid}, project_id={pid}"
            )),
        );
    }

    // 3. skills.source_id 悬空引用
    let orphan_skills: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT s.id, s.name, s.source_id \
         FROM skills s \
         LEFT JOIN skill_sources ss ON s.source_id = ss.id \
         WHERE s.source_id IS NOT NULL AND s.source_id != '' AND ss.id IS NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for (sid, sname, source_id) in orphan_skills {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "warning",
                "Index",
                "index",
                "Skill source_id 悬空",
                format!("Skill '{sname}' 的 source_id={source_id} 不存在"),
                "修正 source_id 或清除引用。",
            )
            .with_resource(Some(sname), None)
            .with_resource_id("Skill", &sid)
            .with_evidence(&format!("source_id={source_id}")),
        );
    }

    // 4. agent_resource_usage_events → resource 不存在
    let orphan_events: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT e.id, e.resource_type, e.resource_id \
         FROM agent_resource_usage_events e \
         WHERE e.resource_type = 'skill' AND e.resource_id NOT IN (SELECT id FROM skills) \
            OR e.resource_type = 'mcp_server' AND e.resource_id NOT IN (SELECT id FROM mcp_servers) \
            OR e.resource_type = 'agent' AND e.resource_id NOT IN (SELECT id FROM agents)",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for (eid, rtype, rid) in orphan_events {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "warning",
                "Index",
                "index",
                "Usage event 引用不存在的 resource",
                format!("event {eid} → resource_type={rtype}, resource_id={rid}"),
                "清理失效事件或修正引用。",
            )
            .with_resource(Some(format!("event:{eid}")), None)
            .with_resource_id("Event", &eid)
            .with_evidence(&format!("resource_type={rtype}, resource_id={rid}")),
        );
    }

    // 5. intelligence_proposals → resource 不存在
    let orphan_proposals: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT p.id, p.resource_type, p.resource_id \
         FROM intelligence_proposals p \
         WHERE p.resource_type = 'Skill' AND p.resource_id NOT IN (SELECT id FROM skills) \
            OR p.resource_type = 'Agent' AND p.resource_id NOT IN (SELECT id FROM agents) \
            OR p.resource_type = 'MCP' AND p.resource_id NOT IN (SELECT id FROM mcp_servers) \
            OR p.resource_type = 'Memory' AND p.resource_id NOT IN (SELECT id FROM memory_sources)",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for (pid, rtype, rid) in orphan_proposals {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "warning",
                "Index",
                "index",
                "Proposal 引用不存在的 resource",
                format!("proposal {pid} → resource_type={rtype}, resource_id={rid}"),
                "删除失效 proposal 或修正引用。",
            )
            .with_resource(Some(format!("proposal:{pid}")), None)
            .with_resource_id("Proposal", &pid)
            .with_evidence(&format!("resource_type={rtype}, resource_id={rid}")),
        );
    }

    // 6. 重复 skill path
    let dup_skills: Vec<(String, i64)> =
        sqlx::query_as("SELECT path, COUNT(*) as cnt FROM skills GROUP BY path HAVING cnt > 1")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

    for (path, cnt) in dup_skills {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "warning",
                "Index",
                "index",
                "重复 Skill 路径",
                format!("路径被 {cnt} 个 Skill 记录引用: {path}"),
                "清理重复索引，保留唯一记录。",
            )
            .with_resource(Some(path.clone()), Some(path))
            .with_evidence(&format!("count={cnt}")),
        );
    }

    // 7. 重复 memory_sources path
    let dup_mem: Vec<(String, i64)> = sqlx::query_as(
        "SELECT path, COUNT(*) as cnt FROM memory_sources GROUP BY path HAVING cnt > 1",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    for (path, cnt) in dup_mem {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "warning",
                "Index",
                "index",
                "重复 Memory 路径",
                format!("路径被 {cnt} 个 Memory 记录引用: {path}"),
                "清理重复索引。",
            )
            .with_resource(Some(path.clone()), Some(path)),
        );
    }

    // 8. 重复 agent_key (非 ignored)
    let dup_agents: Vec<(String, i64)> = sqlx::query_as(
        "SELECT agent_key, COUNT(*) as cnt FROM agents \
         WHERE agent_key IS NOT NULL AND agent_key != '' AND is_ignored = 0 \
         GROUP BY agent_key HAVING cnt > 1",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    for (key, cnt) in dup_agents {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "warning",
                "Index",
                "index",
                "重复 Agent key",
                format!("agent_key '{key}' 被多个 active Agent 引用 (count={cnt})"),
                "确认是否为重复登记，合并或忽略多余的 Agent。",
            )
            .with_resource(Some(key.clone()), None)
            .with_evidence(&format!("count={cnt}")),
        );
    }

    // 9. 重复 knowledge_bases path
    let dup_kb: Vec<(String, i64)> = sqlx::query_as(
        "SELECT path, COUNT(*) as cnt FROM knowledge_bases GROUP BY path HAVING cnt > 1",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    for (path, cnt) in dup_kb {
        checked += 1;
        issues.push(
            HealthIssue::new(
                "warning",
                "Index",
                "index",
                "重复 Knowledge 路径",
                format!("路径被 {cnt} 个 Knowledge 记录引用: {path}"),
                "清理重复索引。",
            )
            .with_resource(Some(path.clone()), Some(path)),
        );
    }

    Ok((checked, issues))
}
