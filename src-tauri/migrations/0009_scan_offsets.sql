-- 创建日志增量扫描位置表，避免重复读取庞大的日志
CREATE TABLE IF NOT EXISTS scan_offsets (
  file_path TEXT PRIMARY KEY,
  last_modified TEXT NOT NULL,
  last_bytes_read INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
