-- Agents Discovery V2: 拆分路径字段 + 置信度 + evidence + 用户确认
-- 解决 app_path 混用问题，支持 detector registry 多信号验证

ALTER TABLE agents ADD COLUMN agent_key TEXT;
ALTER TABLE agents ADD COLUMN cli_path TEXT;
ALTER TABLE agents ADD COLUMN log_path TEXT;
ALTER TABLE agents ADD COLUMN bundle_id TEXT;
ALTER TABLE agents ADD COLUMN detection_source TEXT;
ALTER TABLE agents ADD COLUMN confidence TEXT DEFAULT 'verified';
ALTER TABLE agents ADD COLUMN evidence_json TEXT;
ALTER TABLE agents ADD COLUMN is_user_confirmed INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN is_ignored INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN last_detected_at TEXT;

-- 迁移已有数据：给现有 agent 补充 agent_key
UPDATE agents SET agent_key = 'codex' WHERE name = 'Codex' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'claude_code' WHERE name = 'Claude Code' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'claude_desktop' WHERE name = 'Claude Desktop' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'cursor' WHERE name = 'Cursor' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'windsurf' WHERE name = 'Windsurf' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'newmax' WHERE name = 'Newmax' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'workbuddy' WHERE lower(name) LIKE '%workbuddy%' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'antigravity' WHERE name = 'NoNo Agent Core' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'antigravity_cli' WHERE name = 'NoNo CLI' AND agent_key IS NULL;
UPDATE agents SET agent_key = 'antigravity_ide' WHERE name = 'NoNo IDE Plugin' AND agent_key IS NULL;

-- 迁移日志路径：CLI 类 agent 的 log_path 从 app_path 推断
UPDATE agents SET log_path = app_path || '/projects' WHERE agent_key = 'claude_code' AND log_path IS NULL;
UPDATE agents SET log_path = app_path || '/sessions' WHERE agent_key = 'codex' AND log_path IS NULL;
UPDATE agents SET log_path = app_path || '/projects' WHERE agent_key = 'newmax' AND log_path IS NULL;

-- config_path 已经有的保持不变；app_path 对于 CLI 类实际是 config 目录
-- 把 CLI 类的 config_path 补上
UPDATE agents SET config_path = app_path WHERE agent_key IN ('codex', 'claude_code', 'newmax') AND config_path IS NULL;

-- WorkBuddy 的 log_path
UPDATE agents SET log_path = '/Users/' || (SELECT name FROM agents WHERE agent_key='workbuddy' LIMIT 1) WHERE agent_key = 'workbuddy' AND log_path IS NULL;

-- 创建索引加速筛选
CREATE INDEX IF NOT EXISTS idx_agents_confidence ON agents(confidence);
CREATE INDEX IF NOT EXISTS idx_agents_is_ignored ON agents(is_ignored);
CREATE INDEX IF NOT EXISTS idx_agents_agent_key ON agents(agent_key);
