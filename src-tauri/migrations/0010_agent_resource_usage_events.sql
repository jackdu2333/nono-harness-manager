-- 创建 Agent 日志推断使用统计事件表
CREATE TABLE IF NOT EXISTS agent_resource_usage_events (
  id TEXT PRIMARY KEY,
  agent_client TEXT NOT NULL,         -- 'Codex', 'Antigravity' 等
  agent_id TEXT,                      -- 关联的 agents 表 id (若匹配上)
  agent_session_id TEXT,              -- 关联的会话 id
  resource_type TEXT NOT NULL,        -- 'skill', 'mcp_server', 'mcp_tool'
  resource_id TEXT,                   -- 关联的 skills.id 或者是 mcp_servers.id
  resource_name TEXT,                 -- 资源的可读名称
  usage_kind TEXT NOT NULL,           -- 'skill_invoked', 'skill_referenced', 'mcp_tool_called', 'mcp_server_used'
  event_source TEXT NOT NULL,         -- 默认 'log_inferred'
  confidence TEXT NOT NULL,           -- 'high', 'medium', 'low'
  evidence TEXT,                      -- 推断证据 (如日志片段、命令行等)
  source_file TEXT NOT NULL,          -- 来源日志文件路径
  source_offset INTEGER NOT NULL,     -- 来源日志文件的字节偏移
  event_hash TEXT NOT NULL UNIQUE,    -- 签名去重哈希值 (唯一索引)
  event_time TEXT NOT NULL,           -- 日志中事件发生的时间 (时序统计关键)
  created_at TEXT NOT NULL,           -- 数据库记录入库时间
  metadata_json TEXT                  -- 其他辅助元数据 JSON 格式
);

-- 创建 Agent 日志增量扫描 Checkpoint 表
CREATE TABLE IF NOT EXISTS agent_log_scan_checkpoints (
  id TEXT PRIMARY KEY,
  agent_client TEXT NOT NULL,         -- 客户端标识
  source_file TEXT NOT NULL,          -- 监控的日志文件绝对路径
  last_offset INTEGER NOT NULL,       -- 上次扫描完成时的字节位置
  last_mtime TEXT NOT NULL,           -- 上次扫描完成时的文件修改时间
  last_scanned_at TEXT NOT NULL,      -- 本次扫描时间
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_agent_file UNIQUE (agent_client, source_file)
);

-- 为统计和趋势分析创建必要的索引
CREATE INDEX IF NOT EXISTS idx_agent_usage_client_time ON agent_resource_usage_events (agent_client, event_time);
CREATE INDEX IF NOT EXISTS idx_agent_usage_resource_time ON agent_resource_usage_events (resource_type, resource_id, event_time);
CREATE INDEX IF NOT EXISTS idx_agent_usage_source_time ON agent_resource_usage_events (event_source, event_time);
CREATE INDEX IF NOT EXISTS idx_agent_usage_confidence_time ON agent_resource_usage_events (confidence, event_time);
CREATE INDEX IF NOT EXISTS idx_agent_usage_kind_time ON agent_resource_usage_events (usage_kind, event_time);
