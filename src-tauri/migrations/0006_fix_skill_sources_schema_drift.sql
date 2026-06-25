-- Fix schema drift: skill_sources was created from an older hand-written schema
-- that lacked source_type, enabled, and scan_depth columns.
-- Rebuild the table to guarantee the correct schema for all installs.

CREATE TABLE IF NOT EXISTS _skill_sources_rebuild (
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

INSERT INTO _skill_sources_rebuild
  (id, name, path, source_type, enabled, scan_depth, last_scanned_at, created_at, updated_at)
SELECT
  id, name, path, NULL, 1, 3,
  last_scanned_at, created_at, updated_at
FROM skill_sources;

DROP TABLE skill_sources;
ALTER TABLE _skill_sources_rebuild RENAME TO skill_sources;
