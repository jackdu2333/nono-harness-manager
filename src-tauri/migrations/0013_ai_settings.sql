-- AI Provider Settings (Phase 2)
-- Single-row table: only one active AI provider configuration
CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'openai_compatible',
  base_url TEXT,
  model TEXT,
  api_key_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Insert default row if not exists
INSERT OR IGNORE INTO ai_settings (id, enabled, provider, base_url, model, api_key_ref, created_at, updated_at)
VALUES ('default', 0, 'openai_compatible', NULL, NULL, NULL, datetime('now'), datetime('now'));
