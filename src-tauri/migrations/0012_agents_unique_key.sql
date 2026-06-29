-- Fix: ON CONFLICT(agent_key) requires a UNIQUE constraint, not just an index
-- 部分唯一索引：仅对非 NULL agent_key 强制唯一，允许 NULL 值共存

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_agent_key_unique
ON agents(agent_key)
WHERE agent_key IS NOT NULL;
