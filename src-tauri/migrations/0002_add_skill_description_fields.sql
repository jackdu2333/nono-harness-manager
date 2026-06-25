ALTER TABLE skills ADD COLUMN description_source TEXT;
ALTER TABLE skills ADD COLUMN description_confidence TEXT;
ALTER TABLE skills ADD COLUMN description_updated_at TEXT;
ALTER TABLE skills ADD COLUMN description_is_manual INTEGER DEFAULT 0;
