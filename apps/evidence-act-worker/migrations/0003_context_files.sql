CREATE TABLE IF NOT EXISTS context_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  content_text TEXT NOT NULL,
  source_path TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_context_files_name ON context_files(name);
CREATE INDEX IF NOT EXISTS idx_context_files_updated_at ON context_files(updated_at DESC);
