ALTER TABLE memory_sources ADD COLUMN project_id TEXT;
ALTER TABLE knowledge_bases ADD COLUMN project_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_sources_path ON memory_sources(path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_bases_path ON knowledge_bases(path);

CREATE TABLE IF NOT EXISTS project_resource_bindings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, resource_type, resource_id)
);
