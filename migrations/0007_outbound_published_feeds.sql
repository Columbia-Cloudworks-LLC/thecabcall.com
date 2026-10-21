-- Migration 0007 (Issue #12): Outbound Published Feeds & Syndication Studio

CREATE TABLE IF NOT EXISTS outbound_feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  author_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  cover_image_url TEXT,
  language TEXT NOT NULL DEFAULT 'en-us',
  category TEXT NOT NULL DEFAULT 'Technology',
  max_items INTEGER NOT NULL DEFAULT 50,
  use_deescalated_titles INTEGER NOT NULL DEFAULT 1,
  include_original_title_note INTEGER NOT NULL DEFAULT 1,
  include_attached_images INTEGER NOT NULL DEFAULT 1,
  include_full_socratic_brief INTEGER NOT NULL DEFAULT 1,
  include_audit_ledger_footer INTEGER NOT NULL DEFAULT 1,
  filter_working_tool TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outbound_feeds_slug
  ON outbound_feeds(slug);

CREATE INDEX IF NOT EXISTS idx_outbound_feeds_enabled
  ON outbound_feeds(enabled);

INSERT OR IGNORE INTO outbound_feeds (
  id,
  slug,
  title,
  subtitle,
  description,
  author_name,
  owner_email,
  cover_image_url,
  language,
  category,
  max_items,
  use_deescalated_titles,
  include_original_title_note,
  include_attached_images,
  include_full_socratic_brief,
  include_audit_ledger_footer,
  filter_working_tool,
  enabled
) VALUES
  (
    1,
    'podcast-rss',
    'Change Advisory Board (The CAB Call)',
    'Weekly Systems Dispatches & Craft Failure Analysis',
    'Conversational deep-dives analyzing live Trestleboard ledger dispatches alongside foundational essays on Site Reliability Engineering and the Working Tools of Freemasonry.',
    'Change Advisory Board',
    'telemetry@thecabcall.com',
    'https://thecabcall.com/media/podcast-cover-square.png',
    'en-us',
    'Technology',
    50,
    1,
    1,
    1,
    1,
    1,
    NULL,
    1
  ),
  (
    2,
    'incidents-rss',
    'Change Advisory Board — The Trestleboard Case Briefs',
    'De-Alarmed Craftsman''s Briefs & Structural Post-Mortems (RSS 2.0)',
    'Synthesized Craftsman''s Briefs examining current events through Site Reliability Engineering and the Six Working Tools of Freemasonry. Separates Partisan Heat & Spin (The Noise) from The Actual Foundation (The Signal).',
    'Change Advisory Board',
    'telemetry@thecabcall.com',
    NULL,
    'en-us',
    'Technology',
    50,
    1,
    1,
    1,
    1,
    1,
    NULL,
    1
  ),
  (
    3,
    'incidents-json',
    'Change Advisory Board — The Trestleboard Case Ledger',
    'Structured JSON Feed 1.1 of Craftsman''s Briefs',
    'Craftsman''s Briefs examining current events through Site Reliability Engineering failure analysis and the Six Working Tools of Freemasonry.',
    'Change Advisory Board',
    'telemetry@thecabcall.com',
    NULL,
    'en-US',
    'Technology',
    50,
    1,
    1,
    1,
    1,
    1,
    NULL,
    1
  );
