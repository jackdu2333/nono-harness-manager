ALTER TABLE skills ADD COLUMN summary TEXT;
ALTER TABLE skills ADD COLUMN tags TEXT;
ALTER TABLE skills ADD COLUMN confidence TEXT;
ALTER TABLE skills ADD COLUMN evidence_files TEXT;
ALTER TABLE skills ADD COLUMN manual_override INTEGER DEFAULT 0;
ALTER TABLE skills ADD COLUMN last_analyzed_at TEXT;

ALTER TABLE mcp_servers ADD COLUMN summary TEXT;
ALTER TABLE mcp_servers ADD COLUMN tags TEXT;
ALTER TABLE mcp_servers ADD COLUMN confidence TEXT;
ALTER TABLE mcp_servers ADD COLUMN evidence_files TEXT;
ALTER TABLE mcp_servers ADD COLUMN manual_override INTEGER DEFAULT 0;
ALTER TABLE mcp_servers ADD COLUMN last_analyzed_at TEXT;

CREATE TABLE IF NOT EXISTS memory_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  memory_type TEXT,
  description TEXT,
  summary TEXT,
  category TEXT,
  tags TEXT,
  confidence TEXT,
  evidence_files TEXT,
  manual_override INTEGER DEFAULT 0,
  last_analyzed_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT,
  scope TEXT,
  description TEXT,
  summary TEXT,
  category TEXT,
  tags TEXT,
  confidence TEXT,
  evidence_files TEXT,
  manual_override INTEGER DEFAULT 0,
  last_analyzed_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,
  description TEXT,
  summary TEXT,
  category TEXT,
  tags TEXT,
  confidence TEXT,
  evidence_files TEXT,
  manual_override INTEGER DEFAULT 0,
  last_analyzed_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intelligence_proposals (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  proposed_changes TEXT NOT NULL,
  evidence_files TEXT,
  confidence TEXT,
  status TEXT DEFAULT 'pending',
  created_by TEXT,
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  proposal_id TEXT,
  before_state TEXT,
  after_state TEXT,
  created_at TEXT NOT NULL
);
