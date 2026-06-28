<p align="center">
  <h1 align="center">NoNo Harness Manager</h1>
  <p align="center">Local-first macOS control center for managing AI Agent resources — Skills, MCP servers, agents, analytics, and governance proposals.</p>
</p>

---

## Overview

**NoNo Harness Manager** is a local-first macOS desktop application that helps you index, inspect, organize, and safely expose local AI-agent resources to external Agent clients through a controlled Harness API, CLI, and read-only/proposal-based MCP Server.

It is **not** a cloud platform, a generic file manager, or a replacement for Codex / Claude Code. It is a **local asset management and safe-context layer** that lets external AI clients inspect your indexed resources and create management proposals — without directly modifying your files or database.

> NoNo Harness Manager is local-first. It does not send your local resources, logs, skills, MCP configs, or database to any cloud service by default.

---

## Core Capabilities

### Skills Management

- Scan local Skill directories from supported or manually added sources, such as Codex, WorkBuddy, Newmax, and generic skill folders.
- Display skill name, source, category, applicable clients, description, status
- Filter by source, applicable client, category, and status
- Mark skills as: commonly used, needs review, needs improvement, archived
- Duplicate detection (same-source cross-check)
- Safe index removal and safe-delete local source files (move to Trash)
- Skill detail panel with governance notes and metadata editing

### MCP Management

- Scan and display local MCP Server configurations
- Show command, args, tools, and source paths
- MCP env values are **redacted at scan time** — no "show original value" capability
- Health check for missing paths or broken configs

### Agents Management

- Auto-discover local AI clients when detectable: Codex, Antigravity / NoNo Agent, WorkBuddy, Newmax, Cursor, Windsurf, Claude Code, Claude Desktop, Gemini-based agents
- Log analytics adapters currently support **Codex / Antigravity / WorkBuddy / Newmax**. Claude Code log adapter is planned.
- Display client path, type (App / CLI / IDE Plugin), status, config directory
- Launch agents directly from Harness (App type only; CLI / IDE Plugin show "needs manual launch")
- Track launch count and usage events

### Analytics (Log-Inferred Statistics)

Analytics shows **observable usage traces** inferred from local Agent client logs — not precise call counts.

- Agent client ranking
- Skill usage ranking
- MCP Server usage ranking
- MCP Tool call ranking
- Agent x Skill cross matrix
- Agent x MCP cross matrix
- 7-day / 30-day / all-time trends
- Recent log-inferred events

> All statistics are "observable call counts (log-inferred)". They do not include Harness UI management operations. Low-confidence events are excluded from main rankings by default.

### Settings

- **Sidebar menu visibility**: choose which navigation entries appear in the left sidebar
- Presets: Show All / Skills Only / Core Assets (Skills + Agents + MCP) / Advanced (everything)
- Settings is always visible and cannot be hidden
- Hidden pages keep their routes — direct access still works

---

## Supported Resource Types

| Resource | Status | Description |
|---|---|---|
| Skills | Beta | Scan, index, filter, govern, AI proposals |
| MCP Servers | Beta | Scan, index, health check, config view |
| Agents | Beta | Auto-discover, launch tracking, usage stats |
| Memory | Soon | Local read-only index and binding |
| Knowledge | Soon | Local read-only index and binding |
| Projects | Soon | Project binding and resource linking |
| Proposals | Beta | AI proposal workflow with Trust Policy |
| Analytics | Beta | Log-inferred usage statistics |
| Health Check | Soon | Global health diagnostics |

---

## How Agent Clients Connect to Harness

There are two ways for external AI clients (Codex, Claude Code, WorkBuddy, Newmax, etc.) to access Harness:

### Method 1: MCP Server (Recommended)

NoNo Harness Manager ships with a **read-only / proposal-based MCP Server**. Any MCP-compatible client can connect to read safe context and create governance proposals.

**Available MCP Tools:**

| Tool | Access | Description |
|---|---|---|
| `harness_list_resources` | Read-only | List indexed skills or MCP servers |
| `harness_get_resource_context` | Read-only | Get safe, redacted context for one resource (e.g. SKILL.md excerpt, README excerpt) |
| `harness_create_proposal` | Proposal only | Create a metadata governance proposal (does not auto-apply) |

**What the MCP Server does NOT provide:**

- No direct file deletion
- No direct database modification
- No `apply` proposal
- No arbitrary command execution
- No agent launch

#### Build the CLI first

```bash
npm run harness:cli:build
```

#### Start the MCP Server

```bash
npm run harness:mcp
```

Or run directly:

```bash
node scripts/harness-mcp-server.mjs
```

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `HARNESS_CLI_BIN` | Auto-detected from `target/release/` or `target/debug/` | Path to the built `harness_cli` binary |
| `HARNESS_DB_PATH` | Default App data dir | Path to `harness.db` |

#### MCP Configuration Example

Add this to your Agent client's MCP configuration file (location varies by client — see your client's docs):

```json
{
  "mcpServers": {
    "nono-harness-manager": {
      "command": "node",
      "args": [
        "/absolute/path/to/nono-harness-manager/scripts/harness-mcp-server.mjs"
      ],
      "env": {
        "HARNESS_CLI_BIN": "/absolute/path/to/harness_cli",
        "HARNESS_DB_PATH": "/absolute/path/to/harness.db"
      }
    }
  }
}
```

> Different Agent clients store MCP configs in different locations. Check your client's documentation for where to place this configuration.

### Method 2: Harness CLI

The `harness_cli` binary can be used directly for testing and scripting:

```bash
# List resources
npm run harness:cli -- list skill
npm run harness:cli -- list mcp_server

# Get safe context for a resource
npm run harness:cli -- context skill <skill_id>
npm run harness:cli -- context mcp_server <mcp_server_id>

# Create a governance proposal
npm run harness:cli -- propose skill <skill_id> update_metadata '{"description":"...","category":"...","tags":["..."]}'
```

Proposals created via CLI enter the pending queue — they do **not** modify resources directly. Apply, reject, and rollback are handled by the Harness Trust Policy workflow.

---

## How AI Safely Manages Local Resources

The governance workflow is designed so that AI can help organize resources, but **cannot directly modify your files or database**:

```
1. Harness scans and indexes local resources
2. External AI requests resource list (via MCP / CLI)
3. AI reads safe context for a specific resource
4. AI creates a proposal (description, category, tags, etc.)
5. Harness evaluates the proposal via Trust Policy
   ├─ Low risk + confidence >= medium + evidence files → auto-apply
   ├─ Medium risk → pending review (user confirms)
   └─ High risk → blocked or manual review
6. User reviews in Harness UI
7. Only Trust-Policy-approved or user-confirmed proposals are applied
8. All writes are recorded in audit logs with before/after snapshots
```

**Trust Policy rules:**

- **Auto-apply** is allowed only for: `description`, `summary`, `category`, `tags`, `confidence`, `evidence_files` on `skill` or `mcp_server` resources
- **Forbidden fields** (always blocked): `path`, `command`, `args`, `env`, `launch_command`, `source_path`, `status`, `enabled`, `delete`, `execute`
- All applied proposals can be rolled back

---

## Privacy & Security

| Principle | Implementation |
|---|---|
| **Local-first** | All data stored in local SQLite. No cloud upload by default. |
| **Read-only scanning** | Only scans user-authorized or auto-detected directories. |
| **Path guard** | Blocks scanning `/`, home root, `.ssh`, `.gnupg`, Keychains, Messages, Mail, and other sensitive paths. |
| **Log evidence limits** | Evidence strings are truncated to 500 characters. |
| **Metadata redaction** | `metadata_json` recursively redacts `token`, `key`, `secret`, `password`, `authorization`, `bearer`, `api_key` fields. |
| **MCP env redaction** | MCP server env values are redacted at scan time. No "show original" capability. |
| **No dangerous MCP tools** | MCP Server exposes only list, context, and proposal tools. No apply, delete, launch, or shell execution. |
| **Menu hiding is not security** | Hiding a sidebar entry is UI simplification, not access control. Hidden pages keep their routes. |

---

## Installation & Development

### Prerequisites

> **Note:** This repository is open source, but the npm package is marked `private` to prevent accidental publishing to npm.

- macOS (Apple Silicon recommended)
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable toolchain)
- [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/)

### Development

```bash
# Clone the repository
git clone https://github.com/jackdu2333/nono-harness-manager.git
cd nono-harness-manager

# Install dependencies
npm install

# Start the development app
npm run tauri dev
```

### Build

```bash
# Build the frontend
npm run build

# Build the desktop app
npm run tauri build

# Build the Harness CLI (release mode, for MCP Server)
npm run harness:cli:build
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Harness UI                  │
│     (React + Tailwind + shadcn/ui)           │
├─────────────────────────────────────────────┤
│            Harness Intelligence Layer        │
│   (Trust Policy · Proposals · Audit Logs)    │
├─────────────────────────────────────────────┤
│              Harness API Layer               │
│  (Tauri Commands · CLI · MCP Server)         │
├─────────────────────────────────────────────┤
│                 Harness Core                 │
│  (Scanner · Indexer · SQLite · Path Guard)   │
└─────────────────────────────────────────────┘
```

- **Harness Core**: Local resource scanning, indexing, SQLite database, path safety, usage statistics, health checks
- **Harness API Layer**: Exposes Core capabilities via Tauri Commands (internal), CLI, and MCP Server (external)
- **Harness Intelligence Layer**: Trust Policy evaluation, proposal lifecycle, audit logging with rollback
- **Harness UI**: User-facing operations, previews, confirmations, and analytics

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Tauri v2 |
| Frontend | React + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| State | Zustand + TanStack Table |
| Database | SQLite via SQLx migrations |
| Backend | Rust (tokio, walkdir, serde, sqlx) |

---

## Screenshots

Screenshots will be added soon.

| Skills | Analytics | Settings |
|---|---|---|
| _Skills page screenshot_ | _Analytics page screenshot_ | _Settings page screenshot_ |

---

## Known Limitations

- **macOS only** — no Windows or Linux support yet
- Analytics is **log-inferred**, not precise call counting. Results depend on log format availability
- Supported log adapters: **Codex**, **Antigravity / NoNo Agent**, **WorkBuddy**, **Newmax**
- **Claude Code** log adapter is planned but not yet implemented
- MCP Server runs via `harness_cli` subprocess per call — suitable for local use, not production-grade long-running
- Memory / Knowledge / Projects pages are basic versions
- Log formats may change with client updates; adapters need ongoing maintenance
- Some pages are marked Beta or Soon

---

## Roadmap

- [ ] Claude Code log adapter
- [ ] Finer-grained confidence calibration for log inference
- [ ] Low-confidence event confirmation UI
- [ ] MCP tool schema display enhancement
- [ ] Release packaging (dmg / Homebrew)
- [ ] More Agent client adapters (Gemini CLI, etc.)
- [ ] Built-in lightweight Copilot panel (Phase 3)
- [ ] Batch governance workflows

---

## License

[MIT](LICENSE) - Copyright (c) 2026 jackdu
