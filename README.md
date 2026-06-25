# NoNo Harness Manager

## 1. 项目简介
NoNo Harness Manager 是一个 macOS 桌面端本地 Agent Harness 管理器。它的主要目标是统一管理本机分散的 AI Agent 资产（包括 Agent 客户端、Skills、MCP 资源、记忆目录、知识库等）。

## 2. 产品定位
作为一个**桌面控制台**，它强调**本地安全**。
- 默认不联网、不上传、不依赖云端。
- 默认只读扫描，不执行未知脚本。
- 所有的操作系统底层能力（文件读写、扫描等）通过 Rust 后端提供。

## 3. 当前阶段
当前处于 **Phase 0 & Phase 1**。
- 核心功能：落地 Skills 管理面板 MVP。
- 整体框架：搭建 App Shell 导航，为 Agents, MCP, Memory 等模块建立占位页面。
- 明确不做：第一阶段不执行脚本，不做真实 MCP 调用统计，不连接云同步。

## 4. 技术栈
- **桌面框架**: Tauri v2
- **前端框架**: React + TypeScript + Vite
- **UI & 样式**: Tailwind CSS + shadcn/ui
- **数据管理**: Zustand + TanStack Table
- **本地存储**: SQLite
- **Rust 后端**: SQLx, tokio, walkdir, serde

## 5. 本地启动方式
确保你已安装 Node.js 和 Rust (cargo)，然后运行：
```bash
# 启动开发环境
npm run tauri dev
```
