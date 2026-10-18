-- Migration 0006 (Issue #11): Editorial Pipeline, De-Alarmist Title Rewriting, Image Attachments & Pipeline Transforms

ALTER TABLE telemetry_articles ADD COLUMN original_title TEXT;
ALTER TABLE telemetry_articles ADD COLUMN title_rewritten INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_articles ADD COLUMN title_rewrite_reason TEXT;
ALTER TABLE telemetry_articles ADD COLUMN image_url TEXT;
ALTER TABLE telemetry_articles ADD COLUMN image_alt TEXT;
ALTER TABLE telemetry_articles ADD COLUMN image_caption TEXT;
ALTER TABLE telemetry_articles ADD COLUMN image_source_type TEXT;
ALTER TABLE telemetry_articles ADD COLUMN editorial_notes TEXT;
ALTER TABLE telemetry_articles ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_articles ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;

-- Backfill original_title = title for all existing rows so provenance is never lost
UPDATE telemetry_articles
SET original_title = title
WHERE original_title IS NULL OR TRIM(original_title) = '';

CREATE INDEX IF NOT EXISTS idx_telemetry_articles_pinned_hidden
  ON telemetry_articles(is_hidden, is_pinned DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_transforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transform_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_transforms_enabled
  ON pipeline_transforms(enabled);

INSERT OR IGNORE INTO pipeline_transforms (
  id,
  transform_key,
  name,
  description,
  enabled,
  config_json
) VALUES
  (
    1,
    'auto_deescalate_titles',
    'Auto De-Escalate Alarmist Headlines',
    'Automatically rewrites alarmist, partisan, or clickbait headlines during System-2 synthesis into neutral, operational SRE incident titles while preserving original_title for audit disclosure.',
    1,
    '{"mode":"alarmist_only","stripAllCaps":true,"preserveOriginalInAudit":true}'
  ),
  (
    2,
    'auto_extract_rss_images',
    'Auto Extract Source RSS Media & Images',
    'Extracts <media:content>, <media:thumbnail>, <enclosure type="image/*">, or <img> URLs from RSS/Atom items during ingestion and attaches them to telemetry_articles.',
    1,
    '{"requireHttps":true,"extractFromHtmlImg":true}'
  ),
  (
    3,
    'auto_generate_fallback_cards',
    'Auto Generate Working Tool Telemetry Cards',
    'Attaches a dynamic SVG Working Tool + Structural Failure Mode visual telemetry card when an incident has no extracted or uploaded source image.',
    0,
    '{"cardStyle":"blueprint_brass","includeIncidentCode":true}'
  ),
  (
    4,
    'custom_system2_directive',
    'Custom System-2 Synthesis Directive',
    'Custom editorial prompt addendum injected into Gemini System-2 synthesis for bespoke analytical framing.',
    0,
    '{"directive":"Emphasize verifiable physical-layer and statutory control loops over speculative commentary."}'
  );
