CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  app_path TEXT,
  launch_command TEXT,
  config_path TEXT,
  default_workspace TEXT,
  status TEXT DEFAULT 'active',
  launch_count INTEGER DEFAULT 0,
  last_launched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  source_type TEXT,
  enabled INTEGER DEFAULT 1,
  scan_depth INTEGER DEFAULT 3,
  last_scanned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  skill_type TEXT,
  category TEXT,
  subcategory TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  entry_file TEXT,
  metadata_path TEXT,
  has_metadata INTEGER DEFAULT 0,
  is_executable INTEGER DEFAULT 0,
  total_usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  last_modified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_tags (
  skill_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (skill_id, tag)
);

CREATE TABLE IF NOT EXISTS scan_logs (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  scanned_count INTEGER DEFAULT 0,
  added_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS resource_usage_events (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  agent_id TEXT,
  action TEXT NOT NULL,
  source TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);
