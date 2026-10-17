CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'editor', -- 'owner' | 'admin' | 'editor' | 'auditor'
  auth_provider_pref TEXT NOT NULL DEFAULT 'any', -- 'google' | 'magic_link' | 'any'
  status TEXT NOT NULL DEFAULT 'invited', -- 'active' | 'invited' | 'revoked'
  invited_by_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

CREATE TABLE IF NOT EXISTS admin_magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'login', -- 'login' | 'invite'
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_magic_links_token_hash ON admin_magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_magic_links_email ON admin_magic_links(email);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  auth_method TEXT NOT NULL, -- 'google_oauth' | 'magic_link'
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(email);

-- Bootstrap the Owner account
INSERT OR IGNORE INTO admin_users (
  email,
  display_name,
  role,
  auth_provider_pref,
  status,
  invited_by_email,
  created_at
) VALUES (
  'nicholas.king@columbiacloudworks.com',
  'Nicholas King',
  'owner',
  'google',
  'active',
  'system@thecabcall.com',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
