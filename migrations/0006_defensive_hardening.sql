-- Migration 0006: Defensive Hardening, Quarantine States, R2 Episode Publication Gate & Index Coverage

-- 1. Add episode publication status column ('PUBLISHED' | 'PENDING_AUDIO' | 'QUARANTINED')
ALTER TABLE episodes ADD COLUMN status TEXT NOT NULL DEFAULT 'PUBLISHED';

-- 2. Strict index coverage on telemetry_articles (status, published_at, canonical url_hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_articles_url_hash
  ON telemetry_articles(url_hash);

CREATE INDEX IF NOT EXISTS idx_telemetry_articles_status
  ON telemetry_articles(status);

CREATE INDEX IF NOT EXISTS idx_telemetry_articles_status_published_at
  ON telemetry_articles(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_articles_published_at
  ON telemetry_articles(published_at DESC);

-- 3. Strict index coverage on episodes (status, published_at)
CREATE INDEX IF NOT EXISTS idx_episodes_published_at
  ON episodes(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_episodes_status_published_at
  ON episodes(status, published_at DESC);
