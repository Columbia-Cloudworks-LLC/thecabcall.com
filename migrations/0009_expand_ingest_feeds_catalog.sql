-- Migration 0009: Expand Inbound RSS & Atom Feed Catalog Across 7 Editorial & Technical Categories (51 Total Sources)

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
  -- 1. Global Wire, Center & Investigative (High-Signal Fact Base)
  (
    6,
    'BBC News (World)',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'International / Center',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    7,
    'ProPublica',
    'https://www.propublica.org/feeds/propublica/main',
    'Investigative / Public Accountability',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    8,
    'The Guardian (World)',
    'https://www.theguardian.com/world/rss',
    'International / Center-Left',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    9,
    'Al Jazeera English',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'Global South / International',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    10,
    'Defense One',
    'https://www.defenseone.com/rss/all/',
    'US National Security & Military',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    11,
    'The Conversation (US)',
    'https://theconversation.com/us/articles.atom',
    'Academic & Research-Driven News',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    12,
    'Reuters (via Google News)',
    'https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US',
    'Global Wire',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),

  -- 2. Right-of-Center, Conservative & Libertarian
  (
    13,
    'Reason Magazine',
    'https://reason.com/feed/',
    'Libertarian / Free Markets & Civil Liberties',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    14,
    'National Review',
    'https://www.nationalreview.com/feed/',
    'Traditional / Establishment Conservative',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    15,
    'The American Conservative',
    'https://www.theamericanconservative.com/feed/',
    'Main Street / Non-Interventionist Right',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    16,
    'The Dispatch',
    'https://thedispatch.com/feed/',
    'Center-Right / Fact-Focused',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    17,
    'City Journal (Manhattan Inst.)',
    'https://www.city-journal.org/rss.xml',
    'Urban Policy, Governance & Culture',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    18,
    'Cato Institute',
    'https://www.cato.org/rss/blog',
    'Libertarian Think Tank / Policy',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    19,
    'American Enterprise Institute',
    'https://www.aei.org/feed/',
    'Neoconservative / Market Policy Think Tank',
    'Economics & Markets',
    5,
    1,
    'nominal'
  ),
  (
    20,
    'The Volokh Conspiracy',
    'https://reason.com/volokh/feed/',
    'Constitutional Law & Legal Theory (hosted on Reason)',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),

  -- 3. Left-of-Center, Progressive & Labor
  (
    21,
    'The Atlantic',
    'https://www.theatlantic.com/feed/all/',
    'Center-Left Institutional & Cultural Analysis',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    22,
    'The American Prospect',
    'https://prospect.org/api/rss/content.rss',
    'Progressive Public Policy & Economics',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    23,
    'Mother Jones',
    'https://www.motherjones.com/feed/',
    'Progressive Investigative Journalism',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    24,
    'Vox',
    'https://www.vox.com/rss/index.xml',
    'Policy Explainers / Center-Left',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    25,
    'The Intercept',
    'https://theintercept.com/feed/?lang=en',
    'National Security, Surveillance & Accountability',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    26,
    'Jacobin',
    'https://jacobin.com/feed/',
    'Democratic Socialist / Labor & Class Analysis',
    'Economics & Markets',
    5,
    1,
    'nominal'
  ),

  -- 4. U.S. Capitol Hill, Legal & Regulatory
  (
    27,
    'SCOTUSblog',
    'https://www.scotusblog.com/feed/',
    'Supreme Court & Constitutional Law',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    28,
    'Lawfare',
    'https://www.lawfaremedia.org/rss.xml',
    'Hard National Security, Cybersecurity & Law',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    29,
    'Roll Call',
    'https://rollcall.com/feed/',
    'Legislative Process & Capitol Hill Mechanics',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    30,
    'The Hill (News)',
    'https://thehill.com/news/feed/',
    'Bipartisan Beltway Reporting',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    31,
    'Politico (Policy & Politics)',
    'https://rss.politico.com/politics-news.xml',
    'Executive Branch & Campaign Mechanics',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),

  -- 5. Macroeconomics, Finance & Geopolitics
  (
    32,
    'Foreign Affairs',
    'https://www.foreignaffairs.com/rss.xml',
    'Deep Geopolitical Strategy (CFR)',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    33,
    'Foreign Policy',
    'https://foreignpolicy.com/feed/',
    'Global Statecraft & Diplomacy',
    'Public Policy & Governance',
    5,
    1,
    'nominal'
  ),
  (
    34,
    'The Economist (World)',
    'https://www.economist.com/the-world-this-week/rss.xml',
    'Classical Liberal Macroeconomics & Global News',
    'Economics & Markets',
    5,
    1,
    'nominal'
  ),
  (
    35,
    'Financial Times (World)',
    'https://www.ft.com/world?format=rss',
    'Global Markets & Sovereign Finance',
    'Economics & Markets',
    5,
    1,
    'nominal'
  ),
  (
    36,
    'Calculated Risk',
    'https://www.calculatedriskblog.com/feeds/posts/default',
    'Data-Heavy US Housing & Macro Indicators',
    'Economics & Markets',
    5,
    1,
    'nominal'
  ),
  (
    37,
    'Marginal Revolution',
    'https://marginalrevolution.com/feed',
    'Tyler Cowen & Alex Tabarrok (Economics/Culture)',
    'Economics & Markets',
    5,
    1,
    'nominal'
  ),

  -- 6. Systems Engineering, Cyber, Science & Infrastructure
  (
    38,
    'Krebs on Security',
    'https://krebsonsecurity.com/feed/',
    'Deep-Dive Cybercrime & Infrastructure Breaches',
    'Technology & Cyber',
    5,
    1,
    'nominal'
  ),
  (
    39,
    'Schneier on Security',
    'https://www.schneier.com/feed/atom/',
    'Security Engineering, Cryptography & Policy',
    'Technology & Cyber',
    5,
    1,
    'nominal'
  ),
  (
    40,
    'The Register',
    'https://www.theregister.com/headlines.atom',
    'Enterprise IT, Cloud Outages & Regulatory Snark',
    'Technology & Cyber',
    5,
    1,
    'nominal'
  ),
  (
    41,
    'IEEE Spectrum',
    'https://spectrum.ieee.org/feeds/feed.rss',
    'Hard Engineering, Energy Grid & Robotics',
    'Infrastructure & Supply Chain',
    5,
    1,
    'nominal'
  ),
  (
    42,
    'MIT Technology Review',
    'https://www.technologyreview.com/feed/',
    'Emerging Tech, AI Governance & Biotech',
    'Technology & Cyber',
    5,
    1,
    'nominal'
  ),
  (
    43,
    'Quanta Magazine',
    'https://www.quantamagazine.org/feed/',
    'Pure Science, Mathematics & Complex Systems',
    'Technology & Cyber',
    5,
    1,
    'nominal'
  ),
  (
    44,
    'BleepingComputer',
    'https://www.bleepingcomputer.com/feed/',
    'Zero-Day Exploits, Ransomware & Outage News',
    'Technology & Cyber',
    5,
    1,
    'nominal'
  ),

  -- 7. Philosophy, Culture & Heterodox Thought
  (
    45,
    'Aeon Magazine',
    'https://aeon.co/feed.rss',
    'Philosophy, Psychology & History Essays',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    46,
    'Noema Magazine (Berggruen)',
    'https://www.noemamag.com/feed/',
    'Governance, Philosophy & Planetary Systems',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    47,
    'UnHerd',
    'https://unherd.com/feed/',
    'Heterodox Political & Cultural Commentary',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    48,
    'Compact Magazine',
    'https://www.compactmag.com/rss/',
    'Post-Liberal / Populist Intellectual Critique',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    49,
    'Quillette',
    'https://quillette.com/rss/',
    'Free Speech, Science & Heterodox Culture',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    50,
    'Astral Codex Ten',
    'https://www.astralcodexten.com/feed',
    'Rationalist / Systems, Psychiatry & Meta-Science',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  ),
  (
    51,
    'The New Atlantis',
    'https://www.thenewatlantis.com/feed',
    'Ethics & Philosophy of Technology and Science',
    'Institutional Leadership',
    5,
    1,
    'nominal'
  );
