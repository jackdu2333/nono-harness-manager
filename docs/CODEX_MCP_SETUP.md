# Codex MCP Setup

这份文档说明如何让 Codex 通过 NoNo Harness Manager MCP Server 读取 Harness 资源、获取安全上下文，并创建 AI 治理提案。proposal 创建后会由 Harness Core 的本地 Trust Policy 自动评估；Codex 不能直接 apply。

## 1. 构建 harness_cli

MCP Server 不直接执行 `cargo run`。它会调用已经构建好的 `harness_cli` binary。

```bash
cd /Users/jackdu/Documents/AGENT/harness-maneger/nono-harness-manager
npm run harness:cli:build
```

构建完成后，默认 binary 路径是：

```text
/Users/jackdu/Documents/AGENT/harness-maneger/nono-harness-manager/src-tauri/target/release/harness_cli
```

开发环境也可以只构建 debug binary：

```bash
cargo build --manifest-path src-tauri/Cargo.toml --bin harness_cli
```

MCP Server 的查找顺序：

1. `HARNESS_CLI_BIN` 指定的路径
2. `src-tauri/target/release/harness_cli`
3. `src-tauri/target/debug/harness_cli`

## 2. Codex 配置示例

编辑 Codex 配置文件：

```bash
open ~/.codex/config.toml
```

加入 MCP Server 配置：

```toml
[mcp_servers.nono_harness]
command = "node"
args = ["/Users/jackdu/Documents/AGENT/harness-maneger/nono-harness-manager/scripts/harness-mcp-server.mjs"]

[mcp_servers.nono_harness.env]
HARNESS_CLI_BIN = "/Users/jackdu/Documents/AGENT/harness-maneger/nono-harness-manager/src-tauri/target/release/harness_cli"
```

如需使用独立测试数据库，可临时增加：

```toml
HARNESS_DB_PATH = "/tmp/nono-harness-test.db"
```

正常使用时不要设置 `HARNESS_DB_PATH`，让 `harness_cli` 读取应用默认数据库。

## 3. 可用工具

### harness_list_resources

只读。列出 Harness 资源。

参数：

```json
{
  "resource_type": "skill"
}
```

`resource_type` 可选值：

- `skill`
- `mcp_server`

不传 `resource_type` 时返回当前支持的全部资源类型。

### harness_get_resource_context

只读。获取单个资源的安全上下文。

参数：

```json
{
  "resource_type": "skill",
  "resource_id": "skill-id"
}
```

Skill context 会返回：

- 资源基础字段：名称、简介、摘要、分类、标签、置信度
- `safe_context.path`
- `safe_context.entry_file`
- `safe_context.safe_content_excerpt`
- `safe_context.excerpt_evidence_files`
- `evidence_files`

`safe_content_excerpt` 只会读取 Skill 入口目录下允许文件的前 2KB，例如 `README.md`、`SKILL.md`、`skill.yaml`、`skill.json`。

MCP Server context 会返回：

- `source_path`
- `command`
- `args`
- 已脱敏存储的 `env`

敏感值在扫描阶段已经脱敏，无法通过 MCP Server 取回原值。

### harness_create_proposal

写 proposal，但不直接 apply。用于让 AI 生成治理建议，然后交给 Harness Core 的 Trust Policy 判断是否可自动应用。

参数：

```json
{
  "resource_type": "skill",
  "resource_id": "skill-id",
  "proposal_type": "description_update",
  "proposed_changes": {
    "description": "这个 Skill 用于...",
    "summary": "一句话摘要",
    "category": "编程开发",
    "tags": ["codex", "skill"],
    "confidence": "medium",
    "evidence_files": ["SKILL.md"]
  }
}
```

`proposed_changes` 只允许以下字段：

- `description`
- `summary`
- `category`
- `tags`
- `confidence`
- `evidence_files`

创建 proposal 时会校验资源是否真实存在。不存在的资源会被拒绝。

proposal 创建成功后，Harness 会立即运行本地 Trust Policy：

- `low` 且满足自动应用策略：自动 apply，proposal 状态变为 `applied`，`auto_applied = 1`
- `medium`：状态变为 `pending_review`
- `high`：状态变为 `blocked`

Trust Policy 只判断本地权限和风险，不判断内容写得好不好。

## 4. 不能做什么

第一阶段 MCP Server 只开放只读工具和提案工具，明确不能做：

- 不能 apply proposal
- 不能删除资源
- 不能启动 Agent
- 不能执行任意 shell 命令
- 不能读取任意本地文件
- 不能绕过 `path_guard` 扫描敏感目录
- 不能获取已脱敏 env 的原始值
- 不能直接写数据库字段

AI 只能通过 Harness API 获取受控上下文，并生成 proposal。是否自动 apply 只由 Harness Core 的本地 Trust Policy 决定；手动 apply、reject、rollback 只在客户端内执行，并写入 audit log。

## 5. Trust Policy 自动应用规则

低风险自动应用需要同时满足：

- `resource_type` 是 `skill` 或 `mcp_server`
- `proposal_type` 是 `ai_metadata_update`、`description_update`、`classification_update` 或 `mcp_description_update`
- `proposed_changes` 只包含 `description`、`summary`、`category`、`tags`、`confidence`、`evidence_files`
- `confidence` 是 `high` 或 `medium`
- `evidence_files` 非空，并能在本机资源上下文中验证
- apply 前能记录 `before_state`
- apply 后能记录 `after_state`
- audit log 可完整记录
- 变更可通过 apply audit 的 `before_state` 回滚

以下字段一旦出现，会被判为高风险并阻止自动应用：

- `path`
- `app_path`
- `config_path`
- `default_workspace`
- `launch_command`
- `command`
- `args`
- `env`
- `source_path`
- `status`
- `enabled`
- `scan_depth`
- `delete`
- `execute`

## 6. 本地握手验证

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"ping","params":{}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}' \
  | node scripts/harness-mcp-server.mjs
```

期望结果：

- `initialize` 有响应
- `notifications/initialized` 没有响应
- `ping` 返回 `{}` result
- `tools/list` 返回三个工具

## 7. 常见问题

### harness_cli binary not found

先执行：

```bash
npm run harness:cli:build
```

或者在 Codex 配置中设置：

```toml
HARNESS_CLI_BIN = "/absolute/path/to/harness_cli"
```

### proposal 创建失败：Resource not found

说明传入的 `resource_id` 不存在。应先调用 `harness_list_resources`，再使用列表中真实存在的 `id`。

### proposed_changes 字段被拒绝

说明 AI 试图写入非治理字段，例如 `launch_command`、`path`、`command`。这些字段不允许通过 proposal 修改。
