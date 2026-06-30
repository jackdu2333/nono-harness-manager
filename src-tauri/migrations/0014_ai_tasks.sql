-- AI Tasks table (Phase 3)
-- Stores analysis task results from built-in AI or rule engine
CREATE TABLE IF NOT EXISTS ai_tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT,
  result_json TEXT,
  error TEXT,
  created_by TEXT NOT NULL DEFAULT 'rule_engine',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_type ON ai_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_at ON ai_tasks(created_at DESC);
