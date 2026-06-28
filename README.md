# NoNo Harness Manager

## 项目简介

NoNo Harness Manager 是一个 macOS 桌面端 Harness 控制台。它统一管理本机分散的 AI Agent 资产（Agent 客户端、Skills、MCP 资源、记忆目录、知识库等），并通过受控 API 为外部 AI 客户端提供只读上下文和提案入口。

## 产品定位

**本地优先的 Harness 控制台**，强调本地安全、受控接入、用户确认。

- 默认不联网、不上传、不依赖云端。
- 默认只读扫描，不执行未知脚本。
- 外部 AI 和未来内置 AI 都必须通过同一套 Harness API 获取上下文。
- AI 不能直接读写数据库和本地文件；写入必须先生成 proposal，由用户确认后 apply。
- MCP Server 只提供只读工具和提案工具，不提供 apply、删除、启动或任意命令执行。

## 核心功能

### 资产管理

- **Skills 管理**：扫描本地 Skill 目录，提取描述/分类/标签/状态，支持重复检测、批量整理、AI proposal 治理。
- **Agents 管理**：自动发现 Codex / Claude Code / WorkBuddy / Newmax / Cursor / Windsurf 等本机 AI 客户端，记录启动统计。
- **MCP 管理**：扫描 MCP Server 配置，env 自动脱敏，支持 Config 查看和健康检查。
- **Memory / Knowledge / Projects**：本地只读索引、绑定和体检基础版。

### Agent 日志推断统计

系统通过旁路扫描外部 Agent 客户端的本地日志，推断 Skill 与 MCP 资源的可观测使用痕迹。

- 支持 **Codex** (rollout JSONL)、**Antigravity / NoNo Agent** (transcript JSONL)、**WorkBuddy** (structured trace JSON)、**Newmax** (Claude-compatible JSONL) 四类客户端。
- 通过 FNV-1a hash + checkpoint 机制做增量去重，不重复统计。
- Analytics 页面展示 Agent 排行、Skill 排行、MCP 排行、使用趋势、Agent x Skill 交叉矩阵、最近推断事件。
- 统计口径为「可观测调用次数（日志推断）」，不包含 Harness UI 管理操作。

### 侧边栏菜单显隐配置

- Settings 中可配置左侧导航菜单显示哪些页面入口。
- 支持预设：全部显示 / 只显示 Skills / 核心资产模式 / 高级模式。
- 隐藏页面不会删除数据，路由仍保留，直接访问仍可打开。
- Settings 永远显示，不可隐藏。

### Harness API Layer

- **Tauri Commands**：前端通过标准 IPC 调用 Harness Core。
- **harness_cli**：独立 CLI，支持 `list` / `context` / `propose` 命令。
- **MCP Server**：只读 + 提案型，暴露 `harness_list_resources` / `harness_get_resource_context` / `harness_create_proposal`，外部 AI 客户端（Codex、Claude Code 等）可直接接入。

### Trust Policy 自动应用

- 低风险 proposal（仅修改 description / summary / category / tags / confidence / evidence_files）且 confidence >= medium 可自动 apply。
- 高风险字段（path / command / env / launch_command 等）禁止自动应用。
- 所有写操作记录 audit log，支持 before_state / after_state 快照和回滚。

## 隐私说明

- **所有数据默认保存在本地 SQLite，不上传云端。**
- 本工具会扫描本机 Agent 客户端日志，用于推断 Skill / MCP 使用痕迹。
- 日志 evidence 限长 500 字符，并对 token / key / secret / password / authorization 等敏感字段自动脱敏。
- 敏感内容不发送给 AI，除非用户明确确认。
- MCP env 在扫描阶段脱敏存储，不提供「显示原值」功能。

## Known Limitations

- 日志推断统计不是精确调用统计，是基于本地日志的结构化推断。
- 当前支持 Codex / Antigravity / WorkBuddy / Newmax 四类客户端；Claude Code 适配仍在计划中。
- MCP Server 目前通过调用已构建的 `harness_cli` binary 工作，适合本地使用，不适合生产环境长期常驻。
- Memory / Knowledge / Projects 页面为基础版，后续迭代会增强。

## 技术栈

- **桌面框架**: Tauri v2
- **前端框架**: React + TypeScript + Vite
- **UI & 样式**: Tailwind CSS + shadcn/ui
- **数据管理**: Zustand + TanStack Table
- **本地存储**: SQLite (SQLx migrations)
- **Rust 后端**: SQLx, tokio, walkdir, serde

## 本地启动

确保你已安装 Node.js 和 Rust (cargo)，然后运行：

```bash
# 启动开发环境
npm run tauri dev

# 构建前端
npm run build

# 使用 Harness CLI 查看资源
npm run harness:cli -- list

# 为 MCP Server 构建 release CLI
npm run harness:cli:build

# 启动只读/提案型 MCP Server
npm run harness:mcp
```

`scripts/harness-mcp-server.mjs` 默认调用已构建的 `harness_cli` binary；如果需要指定路径，可设置 `HARNESS_CLI_BIN=/path/to/harness_cli`。

## 分层架构

- **Harness Core**: 本地资源扫描、索引、数据库、权限控制、使用统计和健康检查。
- **Harness API Layer**: 通过 Tauri Commands、CLI、MCP Server 暴露 Harness Core 能力。
- **Harness Intelligence Layer**: 负责生成简介、摘要、分类、标签、治理建议；当前先落 proposal workflow。
- **Harness UI**: 负责用户操作、预览、确认和应用修改。

## License

MIT
