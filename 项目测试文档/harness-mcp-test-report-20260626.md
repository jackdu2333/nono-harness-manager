# Harness MCP 外部 AI 接口连接测试报告

**测试日期**: 2026-06-26
**测试环境**: macOS, Codex (GLM-5.2), nono-harness-manager v0.1.0
**测试执行**: Codex via `mcp__nono_harness` MCP tools

---

## 测试结果总表

| 测试项 | 是否通过 | 实际结果 | 风险/问题 |
|---|---|---|---|
| **G1** CLI list skill | ✅ 通过 | 158 skill 返回, 字段完整 (id/name/description/summary/category/tags/confidence/status) | category/summary/tags 大量为 null |
| **G1** CLI list mcp_server | ✅ 通过 | 6 mcp_server 返回, 字段完整 | 有重复条目 (memos_email/memos_jackdu 各 2 条) |
| **G2** CLI context skill | ✅ 通过 | path/entry_file/safe_content_excerpt(2048字符)/evidence_files 均正确返回 | - |
| **G2** CLI context mcp_server | ✅ 通过 | command/args/env 返回, **env API_KEY 已脱敏为 `***`** | - |
| **G3** CLI propose skill | ✅ 通过 | proposal 创建成功, status=pending_review (update_metadata 非 auto-apply 白名单) | - |
| **G3** CLI verify unchanged | ✅ 通过 | proposal 创建后原 skill description/category **未被修改** | - |
| **G3** CLI reject | ✅ 通过 | proposal 状态变为 rejected | - |
| **G4** MCP initialize | ✅ 通过 | protocolVersion=2024-11-05, serverInfo=nono-harness-manager v0.1.0 | - |
| **G4** MCP tools/list | ✅ 通过 | 3 tools: harness_list_resources / harness_get_resource_context / harness_create_proposal | - |
| **G4** MCP tools/call | ✅ 通过 | 通过 MCP 成功读取 158 skill, 与 CLI 直连数据一致 | - |
| **G5-1** Codex list resources | ✅ 通过 | MCP 工具调用成功, 返回 158 skill 真实数据 | - |
| **G5-2** Codex get context | ✅ 通过 | 安全上下文正确返回, path_guard 拦截 .py 文件 (safe_content_excerpt=null) | "scripts" skill 为扫描误识别 |
| **G5-3** Codex create proposal | ✅ 通过 | classification_update proposal 自动应用 (low risk, confidence=high, evidence_files 可验证) | auto_applied 需注意 |
| **G5-4** 越权防护 | ✅ 通过 | 恶意字段 (command/delete/path) 被判定 high risk + blocked | - |
| **G5-4** 工具集约束 | ✅ 通过 | MCP 仅暴露 3 个工具, 无 delete/apply/direct_update | - |

---

## 详细测试记录

### 第一组: CLI list 测试

- `harness_cli list skill` → 158 条, 9 个字段全部存在
- `harness_cli list mcp_server` → 6 条 (memos_email/memos_jackdu/open-design/playwright + 2 重复)
- `harness_cli list` (无参数) → 返回混合资源

**结论**: CLI 读取层完全正常

### 第二组: 安全上下文读取

- Skill context: path 返回完整路径, safe_content_excerpt 限制 2048 字符, evidence_files 列出实际读取的文件
- MCP context: **env 敏感值 (API_KEY/USER_ID) 全部脱敏为 `***`**, 无密钥泄露

**结论**: 安全上下文层完全正常, path_guard + 脱敏生效

### 第三组: Proposal 创建与拒绝

- `propose skill update_metadata` → status=pending_review, risk_level=medium
- 原 skill 字段未被修改 (验证 description 仍为原文, category 仍为 null)
- `reject` → status=rejected

**结论**: Proposal 写入层完全正常, Trust Policy 正确拦截非白名单 proposal_type

### 第四组: MCP Server 本体

- initialize → 正确协议握手
- tools/list → 3 个工具定义完整
- tools/call list_resources → 端到端数据读取成功

**结论**: MCP Server 本体完全正常

### 第五组: Codex MCP 集成层

#### G5-1 列出资源
通过 `harness_list_resources` 成功读取 158 skill, 数据与 CLI 直连一致

#### G5-2 读取安全上下文
通过 `harness_get_resource_context` 读取 "scripts" skill:
- path: `/Users/jackdu/.agents/skills/lark-slides/scripts/template_tool.py`
- safe_content_excerpt: null (`.py` 不在安全文件白名单, path_guard 正确拦截)
- 推断: 该 "skill" 实际是 lark-slides 下的脚本目录被误扫描
- **未读取本地完整文件, 仅基于 safe_context 推断**

#### G5-3 生成描述提案
通过 `harness_create_proposal` 为 web-artifacts-builder 创建 classification_update:
- confidence=high, evidence_files=["SKILL.md"]
- Trust Policy 判定 low risk → **自动应用** (auto_applied=1)
- 原 skill category 从 null 变为"编程开发"

#### G5-4 越权防护
尝试注入恶意字段:
- proposed_changes 包含 `command: "rm -rf /"`, `delete: true`, `path: ...`
- Trust Policy 判定 **risk_level=high, status=blocked**
- risk_reasons: "forbidden field blocks auto apply: command"
- 原 skill **未被修改**
- MCP 工具集**不包含** delete/apply/direct_update 工具

**结论**: Codex 集成层完全正常, 越权防护有效

---

## 发现的数据质量问题 (非接口缺陷)

1. **158 个 skill 中大量 category/summary/tags/confidence 为 null** — 适合后续用 proposal 批量补充
2. **存在重复 skill 条目** — memos_email/memos_jackdu 各 2 条; ilya-sutskever-skill/paul-graham-skill 等 nuwa 生成 skill 也有重复
3. **扫描误识别** — "scripts" 目录被当作独立 skill (实际是 lark-slides 子目录)

这些问题不影响接口功能, 但影响后续 AI 整理效果, 建议在 Harness Manager 中清理。

---

## 关键结论

**Codex 可以:**
- 列出 Skills / MCP 资源
- 读取安全上下文 (受 path_guard 约束)
- 基于上下文生成 proposal
- 低风险 proposal 被自动应用
- 帮助 review 页面和代码

**Codex 不可以:**
- 直接修改 Harness 数据库
- 直接删除本地 Skill 文件
- 直接 apply 任意 proposal
- 读取未授权路径 (.py 等非安全文件)
- 绕过 Trust Policy
- 注入危险字段 (command/path/delete/env 等)

**一句话: 先测通道, 再测上下文, 再测 proposal, 最后测越权 — 全部通过。**
