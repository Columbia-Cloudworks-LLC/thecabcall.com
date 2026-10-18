-- Migration 0008 (Epic #33 / Issues #34–#38): Podcast Archive Unification & Episode Description Data Cleanup
-- Adds structured columns for extended episode overview notes, external source dossiers, and internal site source pages.
-- Data sanitization and cryptographic audit_ledger entries (episode.update) are executed via scripts/import-legacy-episodes.ts.

ALTER TABLE episodes ADD COLUMN extended_notes TEXT;
ALTER TABLE episodes ADD COLUMN sources_json TEXT;
ALTER TABLE episodes ADD COLUMN source_pages_json TEXT;
