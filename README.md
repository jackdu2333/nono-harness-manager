# NoNo Harness Manager

## 1. 项目简介
NoNo Harness Manager 是一个 macOS 桌面端 Harness 控制台。它的主要目标是统一管理本机分散的 AI Agent 资产（包括 Agent 客户端、Skills、MCP 资源、记忆目录、知识库等），并通过受控 API 为外部 AI 客户端提供只读上下文和提案入口。

## 2. 产品定位
作为一个**本地优先的 Harness 控制台**，它强调**本地安全、受控接入、用户确认**。
- 默认不联网、不上传、不依赖云端。
- 默认只读扫描，不执行未知脚本。
- 外部 AI 和未来内置 AI 都必须通过同一套 Harness API 获取上下文。
- AI 不能直接读写数据库和本地文件；写入必须先生成 proposal，由用户确认后 apply。
- MCP Server 第一阶段只提供只读工具和提案工具，不提供 apply、删除、启动或任意命令执行。

## 3. 当前阶段
当前处于 **Phase 2.1 Stabilization**。
- 已落地：AppShell、Agents、Skills、MCP 三个核心模块雏形。
- 已落地：Memory / Knowledge / Projects / Analytics / Health Check 的本地只读索引、绑定、统计和体检基础版。
- 已落地：SQLx migrations 统一数据库初始化，包含 scan_logs、resource_usage_events、settings，以及 AI-ready 字段和表。
- 已落地：Harness API Layer，包括 Tauri Commands、`harness_cli`、只读/提案型 MCP Server。
- 已落地：Skills / MCP 的 `description`、`summary`、`category`、`tags`、`confidence`、`evidence_files`、`manual_override`、`last_analyzed_at` 等 AI-ready 字段。
- 已落地：统一 `path_guard`，扫描禁止覆盖 `/`、home 根目录和 `.ssh`、`.gnupg`、Keychains、Messages、Mail 等敏感目录。
- 已落地：Agent 启动统计、usage events、CLI / IDE Plugin 不假启动。
- Phase 2.1 重点：补强安全上下文摘录、proposal 校验、audit log 前后快照、扫描去重、外部 MCP 接入稳定性，以及本地资产治理的基础页面闭环。

## 4. 分层架构
- **Harness Core**: 本地资源扫描、索引、数据库、权限控制、使用统计和健康检查。
- **Harness API Layer**: 通过 Tauri Commands、CLI、MCP Server 暴露 Harness Core 能力。
- **Harness Intelligence Layer**: 负责生成简介、摘要、分类、标签、治理建议；当前先落 proposal workflow。
- **Harness UI**: 负责用户操作、预览、确认和应用修改。

## 5. 技术栈
- **桌面框架**: Tauri v2
- **前端框架**: React + TypeScript + Vite
- **UI & 样式**: Tailwind CSS + shadcn/ui
- **数据管理**: Zustand + TanStack Table
- **本地存储**: SQLite
- **Rust 后端**: SQLx, tokio, walkdir, serde

## 6. 本地启动方式
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
