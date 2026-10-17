-- Migration 0005: Dynamic Inbound RSS Feeds, Triage Filters & System Thresholds (Issue #10)

CREATE TABLE IF NOT EXISTS ingest_feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL UNIQUE,
  focus_area TEXT NOT NULL,
  domain_sector_override TEXT,
  items_per_poll INTEGER NOT NULL DEFAULT 5,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_polled_at TEXT,
  last_status TEXT DEFAULT 'nominal',
  last_error TEXT,
  total_ingested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ingest_feeds_enabled ON ingest_feeds(enabled);

-- Seed baseline 5 US high-impact feeds
INSERT OR IGNORE INTO ingest_feeds (
  id,
  name,
  url,
  focus_area,
  domain_sector_override,
  items_per_poll,
  enabled,
  last_status
) VALUES
  (
    1,
    'NPR Top News',
    'https://feeds.npr.org/1001/rss.xml',
    'Broad US Top Stories',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    2,
    'PBS NewsHour Nation',
    'https://www.pbs.org/newshour/feeds/rss/nation',
    'Institutional & Policy',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    3,
    'NYT HomePage',
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    'Mainstream Agenda-Setting',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    4,
    'WSJ US Business',
    'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',
    'Corporate, Supply Chain & Fed',
    'Economics & Markets',
    5,
    1,
    'nominal'
  ),
  (
    5,
    'Ars Technica',
    'https://feeds.arstechnica.com/arstechnica/index',
    'Tech, Infrastructure & Security',
    'Technology & Cyber',
    5,
    1,
    'nominal'
  );

CREATE TABLE IF NOT EXISTS ingest_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  filter_type TEXT NOT NULL, -- 'Drop_Keyword_Regex' | 'Require_Keyword_Regex' | 'Boost_Systemic_Prob' | 'Block_Source_Pattern' | 'Force_Working_Tool'
  match_target TEXT NOT NULL DEFAULT 'title_and_excerpt', -- 'title' | 'excerpt' | 'title_and_excerpt' | 'url'
  pattern TEXT NOT NULL,
  scope_feed_id INTEGER,
  action_value TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ingest_filters_enabled ON ingest_filters(enabled);
CREATE INDEX IF NOT EXISTS idx_ingest_filters_type ON ingest_filters(filter_type);

-- Seed baseline low-signal noise drop rules, high-signal boost rules & tool overrides
INSERT OR IGNORE INTO ingest_filters (
  id,
  name,
  description,
  filter_type,
  match_target,
  pattern,
  scope_feed_id,
  action_value,
  enabled,
  hit_count
) VALUES
  (
    1,
    'Sports & Athletic Scores Drop',
    'Immediately drops routine sports game recaps, league scores, and playoff brackets before System-2 synthesis.',
    'Drop_Keyword_Regex',
    'title_and_excerpt',
    '\b(nfl|nba|mlb|nhl|touchdown|playoff|super bowl|world series|premier league|ncaa tournament|quarterback)\b',
    NULL,
    'drop',
    1,
    0
  ),
  (
    2,
    'Celebrity, Red Carpet & Box Office Drop',
    'Excludes entertainment gossip, award shows, red carpet coverage, and box office tallies.',
    'Drop_Keyword_Regex',
    'title_and_excerpt',
    '\b(box office|red carpet|celebrity|oscars|grammys|emmys|kardashian|met gala|movie review|album review)\b',
    NULL,
    'drop',
    1,
    0
  ),
  (
    3,
    'Lifestyle, Recipes, Horoscopes & Puzzles Drop',
    'Filters daily puzzles, horoscopes, recipes, and personal lifestyle advice columns.',
    'Drop_Keyword_Regex',
    'title_and_excerpt',
    '\b(recipe|horoscope|wordle|crossword|connections hint|strands hint|sudoku|cooking tip|hot flashes|night sweats)\b',
    NULL,
    'drop',
    1,
    0
  ),
  (
    4,
    'Retail Deal Alerts & Consumer Product Roundups',
    'Drops e-commerce shopping guides, affiliate product reviews, and seasonal deal alerts.',
    'Drop_Keyword_Regex',
    'title_and_excerpt',
    '\b(deal alert|best headphones|promo code|gift guide|prime day|black friday deals|wirecutter|buying guide|review:)\b',
    NULL,
    'drop',
    1,
    0
  ),
  (
    5,
    'Market Ticker & Ephemeral Roundup Noise',
    'Drops generic intraday stock ticker roundups lacking structural or institutional telemetry.',
    'Drop_Keyword_Regex',
    'title',
    '\b(market talk|roundup:|stock market today: live)\b',
    NULL,
    'drop',
    1,
    0
  ),
  (
    6,
    'Federal & Constitutional Governance Boost',
    'Boosts systemic probability for Supreme Court rulings, federal agency actions, congressional oversight, and statutory friction.',
    'Boost_Systemic_Prob',
    'title_and_excerpt',
    '\b(supreme court|federal reserve|pentagon|doj|faa|sec|fcc|congress|senate|inspector general|constitutional|executive order|subpoena)\b',
    NULL,
    '+0.18',
    1,
    0
  ),
  (
    7,
    'Critical Infrastructure, Grid & Cyber Outage Boost',
    'Boosts systemic probability for cascading infrastructure failures, power grid strain, aviation outages, and cyber incidents.',
    'Boost_Systemic_Prob',
    'title_and_excerpt',
    '\b(outage|power grid|cascading failure|ransomware|zero-day|air traffic|supply chain|pipeline|derailment|water system|telecom)\b',
    NULL,
    '+0.20',
    1,
    0
  ),
  (
    8,
    'Audit, Whistleblower & Post-Mortem Signal Boost',
    'Elevates dispatches involving formal audits, whistleblower disclosures, skipped inspections, and post-mortem investigations.',
    'Boost_Systemic_Prob',
    'title_and_excerpt',
    '\b(whistleblower|audit finds|inspector general|post-mortem|safety violation|skipped maintenance|regulatory filing|consent decree)\b',
    NULL,
    '+0.15',
    1,
    0
  ),
  (
    9,
    'Sponsored & Affiliate URL Block',
    'Blocks outbound article URLs matching known commerce, coupon, or sponsored content path segments.',
    'Block_Source_Pattern',
    'url',
    '(/sponsored/|/affiliate/|/coupons/|/deals/|utm_medium=affiliate)',
    NULL,
    'drop',
    1,
    0
  ),
  (
    10,
    'Force Plumb on Whistleblower & Ethics Breaches',
    'Assigns The Plumb as primary Working Tool when dispatches document falsified logs, bribery, or whistleblower retaliation.',
    'Force_Working_Tool',
    'title_and_excerpt',
    '\b(whistleblower|falsified logs|bribery|inspector general audit|cover-up|ethics violation)\b',
    NULL,
    'plumb',
    1,
    0
  ),
  (
    11,
    'Force Square on Constitutional & Statutory Drift',
    'Assigns The Square as primary Working Tool when dispatches focus on injunctions, statutory authority, or constitutional compliance.',
    'Force_Working_Tool',
    'title_and_excerpt',
    '\b(unconstitutional|statutory authority|court blocks|injunction|violates federal law|regulatory compliance)\b',
    NULL,
    'square',
    1,
    0
  ),
  (
    12,
    'Force 24-Inch Gauge on Maintenance & Budget Backlog',
    'Assigns the 24-Inch Gauge when dispatches center on deferred maintenance, staffing shortages, or appropriations lapses.',
    'Force_Working_Tool',
    'title_and_excerpt',
    '\b(deferred maintenance|staffing shortage|appropriations lapse|government shutdown|budget backlog)\b',
    NULL,
    'twenty_four_inch_gauge',
    1,
    0
  );

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
  (
    'jev_min_systemic_prob',
    '0.70',
    'Minimum Jev (jev-1.14.0) systemic probability threshold [0.50 - 0.95] required to triage an article into System-2 synthesis.'
  ),
  (
    'jev_min_confidence',
    '0.50',
    'Minimum Jev working-tool classification confidence threshold.'
  ),
  (
    'max_net_new_per_run',
    '10',
    'Maximum net-new articles evaluated per scheduled or manual ingestion pass.'
  ),
  (
    'default_items_per_poll',
    '5',
    'Default number of latest RSS/Atom items inspected per feed poll when not overridden on the feed.'
  );
