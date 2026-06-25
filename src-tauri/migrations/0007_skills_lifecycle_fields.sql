-- 0007: Skills lifecycle & curation fields
-- Supports the Skills curation workflow (review / cleanup / evolution).
-- NOTE: `category` and `status` columns already exist (0001/0002).
--   - Lifecycle values (active / deprecated / broken / duplicate) live in `status`.
--   - favorite / archived / needs_review / needs_improvement are orthogonal
--     boolean flags so they can be combined with any lifecycle status.
--   - improvement_* / review_* track the evolution & review notes for each Skill.

ALTER TABLE skills ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN needs_improvement INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN duplicate_group_id TEXT;
ALTER TABLE skills ADD COLUMN improvement_note TEXT;
ALTER TABLE skills ADD COLUMN improvement_status TEXT;
ALTER TABLE skills ADD COLUMN last_improved_at TEXT;
ALTER TABLE skills ADD COLUMN review_note TEXT;
ALTER TABLE skills ADD COLUMN reviewed_at TEXT;
