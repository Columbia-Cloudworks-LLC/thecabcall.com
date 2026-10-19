-- Migration 0010: Archive Pagination & Cross-Axis Matrix Indexes (Epic #44 / Issue #43)
-- Optimizes 1,000+ item server-side LIMIT/OFFSET pagination, 6x6 matrix aggregation,
-- and Working Tool / Structural Failure Mode hub queries on telemetry_articles.

CREATE INDEX IF NOT EXISTS idx_telemetry_matrix_lookup
  ON telemetry_articles(status, is_hidden, primary_tool, sre_failure_mode, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_secondary_tool_lookup
  ON telemetry_articles(status, is_hidden, secondary_tool, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_failure_published_lookup
  ON telemetry_articles(status, is_hidden, sre_failure_mode, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_source_feed_lookup
  ON telemetry_articles(status, is_hidden, source_feed, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_pinned_published_lookup
  ON telemetry_articles(status, is_hidden, is_pinned DESC, published_at DESC, id DESC);
