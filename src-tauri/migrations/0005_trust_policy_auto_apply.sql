ALTER TABLE intelligence_proposals ADD COLUMN risk_level TEXT;
ALTER TABLE intelligence_proposals ADD COLUMN risk_reasons TEXT;
ALTER TABLE intelligence_proposals ADD COLUMN auto_applied INTEGER DEFAULT 0;
ALTER TABLE intelligence_proposals ADD COLUMN trust_policy_version TEXT;

INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES
  ('auto_apply_low_risk', 'true', datetime('now')),
  ('require_evidence_files', 'true', datetime('now')),
  ('allowed_auto_apply_resource_types', 'skill,mcp_server', datetime('now')),
  ('allowed_auto_apply_fields', 'description,summary,category,tags,confidence,evidence_files', datetime('now')),
  ('min_confidence_for_auto_apply', 'medium', datetime('now')),
  ('max_auto_apply_batch_size', '20', datetime('now'));
