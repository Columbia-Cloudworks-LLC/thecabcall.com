CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL, -- 'rss_ingest' | 'system2_synthesize' | 'weekly_rollup'
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  items_evaluated INTEGER NOT NULL DEFAULT 0,
  items_accepted INTEGER NOT NULL DEFAULT 0,
  items_rejected_noise INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nominal', -- 'nominal' | 'degraded' | 'critical'
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at DESC);

-- Seed Phase 1 & Phase 2 baseline D1 pipeline execution records
INSERT INTO pipeline_runs (
  run_type,
  started_at,
  completed_at,
  items_evaluated,
  items_accepted,
  items_rejected_noise,
  avg_latency_ms,
  status,
  notes
) VALUES
  (
    'rss_ingest',
    '2026-10-17T03:52:10.000Z',
    '2026-10-17T03:52:14.210Z',
    10,
    9,
    1,
    118,
    'nominal',
    'Ingested 10 net-new US RSS dispatches via TypeSafe Jev (jev-1.14.0): 9 triaged (>=0.60 systemic), 1 dropped as market noise.'
  ),
  (
    'system2_synthesize',
    '2026-10-17T04:18:05.000Z',
    '2026-10-17T04:18:19.450Z',
    5,
    5,
    0,
    2890,
    'nominal',
    'Synthesized 5 triaged D1 incidents (IDs 26–30) into bounded Socratic briefs via Gemini System-2.'
  ),
  (
    'weekly_rollup',
    '2026-10-17T04:22:30.000Z',
    '2026-10-17T04:22:46.800Z',
    10,
    9,
    1,
    3120,
    'nominal',
    'Published CAB Weekly Brief #43 (cab-weekly-brief-43-2026-10-17.mp3) to R2 cabcall-audio and D1 episodes table.'
  );
