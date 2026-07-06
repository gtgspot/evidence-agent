CREATE TABLE IF NOT EXISTS authority_sources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  authority_kind TEXT NOT NULL,
  jurisdiction TEXT,
  version TEXT,
  version_date TEXT,
  citation TEXT,
  source_uri TEXT NOT NULL,
  source_type TEXT NOT NULL,
  checksum TEXT,
  parser_version TEXT,
  is_official INTEGER DEFAULT 1,
  ingested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authority_sections (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  provision_type TEXT NOT NULL,
  citation TEXT NOT NULL,
  citation_norm TEXT NOT NULL,
  heading TEXT,
  body_text TEXT NOT NULL,
  canonical_ref TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES authority_sources(id),
  UNIQUE(source_id, ordinal)
);

CREATE TABLE IF NOT EXISTS authority_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_estimate INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES authority_sources(id),
  FOREIGN KEY (section_id) REFERENCES authority_sections(id),
  UNIQUE(section_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS authority_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  from_section_id TEXT NOT NULL,
  to_section_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  mention_citation TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES authority_sources(id),
  FOREIGN KEY (from_section_id) REFERENCES authority_sections(id),
  FOREIGN KEY (to_section_id) REFERENCES authority_sections(id),
  UNIQUE(from_section_id, to_section_id, relation, mention_citation)
);

CREATE INDEX IF NOT EXISTS idx_authority_sources_ingested ON authority_sources(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_authority_sections_source ON authority_sections(source_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_authority_sections_citation_norm ON authority_sections(citation_norm);
CREATE INDEX IF NOT EXISTS idx_authority_chunks_source ON authority_chunks(source_id, section_id);
CREATE INDEX IF NOT EXISTS idx_authority_links_source ON authority_links(source_id);
