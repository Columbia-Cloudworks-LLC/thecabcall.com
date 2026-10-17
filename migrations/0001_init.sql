-- Migration 0001: Initialize Change Advisory Board (The CAB Call) Schema
-- Compatible with SQLite / D1 / Turso / PostgreSQL

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  episode_number INTEGER NOT NULL,
  series TEXT NOT NULL DEFAULT 'weekly_rollup', -- 'weekly_rollup' | 'legacy_archive'
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  transcript TEXT NOT NULL,
  transcript_sections_json TEXT, -- JSON object with telemetry, signal_vs_panic, forward_posture
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  published_at TEXT NOT NULL,
  dominant_tool TEXT,
  dominant_failure_mode TEXT,
  referenced_incident_ids_json TEXT, -- JSON array of incident IDs + timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telemetry_articles (
  id TEXT PRIMARY KEY,
  incident_code TEXT UNIQUE NOT NULL, -- e.g. #CAB-2026-1042
  slug TEXT UNIQUE NOT NULL,
  url_hash TEXT UNIQUE NOT NULL,
  source_feed TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  domain_sector TEXT NOT NULL,
  jev_confidence REAL NOT NULL,
  primary_tool TEXT NOT NULL,
  secondary_tool TEXT NOT NULL,
  sre_failure_mode TEXT NOT NULL,
  jev_raw_json TEXT NOT NULL, -- Full probability distribution across all 6 Working Tools
  executive_summary TEXT NOT NULL,
  socratic_brief TEXT NOT NULL,
  diagnostic_application TEXT NOT NULL,
  proportionality_check_json TEXT NOT NULL, -- { noise_overblown, structural_signal }
  questions_json TEXT NOT NULL, -- JSON array of 3-4 Socratic questions
  classifier_latency_ms INTEGER NOT NULL DEFAULT 142
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL, -- 'rss_ingest' | 'weekly_rollup'
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  items_evaluated INTEGER NOT NULL DEFAULT 0,
  items_accepted INTEGER NOT NULL DEFAULT 0,
  items_rejected_noise INTEGER NOT NULL DEFAULT 0,
  avg_classifier_latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nominal',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_telemetry_primary_tool ON telemetry_articles(primary_tool);
CREATE INDEX IF NOT EXISTS idx_telemetry_sre_failure_mode ON telemetry_articles(sre_failure_mode);
CREATE INDEX IF NOT EXISTS idx_telemetry_domain_sector ON telemetry_articles(domain_sector);
CREATE INDEX IF NOT EXISTS idx_telemetry_published_at ON telemetry_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_published_at ON episodes(published_at DESC);
