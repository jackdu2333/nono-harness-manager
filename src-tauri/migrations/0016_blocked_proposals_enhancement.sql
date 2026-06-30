-- Blocked proposals enhancement fields (acknowledged and rewrite tracking)
ALTER TABLE intelligence_proposals ADD COLUMN acknowledged_at TEXT NULL;
ALTER TABLE intelligence_proposals ADD COLUMN acknowledged_by TEXT NULL;
ALTER TABLE intelligence_proposals ADD COLUMN linked_from TEXT NULL;
