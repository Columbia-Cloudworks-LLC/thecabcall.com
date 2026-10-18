-- Migration 0007 (Epic #5): Legacy Podcast Archive Artwork, Widescreen Banner & AI Generation Disclaimer Columns

ALTER TABLE episodes ADD COLUMN artwork_url TEXT;
ALTER TABLE episodes ADD COLUMN artwork_widescreen_url TEXT;
ALTER TABLE episodes ADD COLUMN ai_disclaimer TEXT;
