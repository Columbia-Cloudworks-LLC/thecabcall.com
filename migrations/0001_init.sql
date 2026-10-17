CREATE TABLE IF NOT EXISTS telemetry_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_hash TEXT NOT NULL UNIQUE,
  source_feed TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  raw_excerpt TEXT NOT NULL,
  published_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_systemic_prob REAL NOT NULL,
  jev_confidence REAL NOT NULL,
  primary_tool TEXT NOT NULL,
  secondary_tool TEXT,
  sre_failure_mode TEXT NOT NULL,
  jev_raw_json TEXT NOT NULL,
  socratic_brief TEXT,
  questions_json TEXT,
  status TEXT NOT NULL DEFAULT 'triaged' -- 'dropped' | 'triaged' | 'synthesized'
);

CREATE INDEX IF NOT EXISTS idx_telemetry_published ON telemetry_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_tool ON telemetry_articles(primary_tool, status);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_number INTEGER,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  transcript TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 300,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL
);
