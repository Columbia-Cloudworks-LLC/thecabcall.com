CREATE TABLE IF NOT EXISTS audit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'owner',
  auth_method TEXT NOT NULL, -- 'google_oauth' | 'magic_link' | 'admin_secret' | 'system_bootstrap'
  actor_ip_hash TEXT,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  before_state_json TEXT,
  after_state_json TEXT,
  replay_command_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_audit_ledger_timestamp ON audit_ledger(timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_target ON audit_ledger(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_action ON audit_ledger(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_actor ON audit_ledger(actor_email);

CREATE TRIGGER IF NOT EXISTS trg_audit_ledger_no_update
BEFORE UPDATE ON audit_ledger
BEGIN
  SELECT RAISE(ABORT, 'Immutable audit_ledger cannot be updated');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_ledger_no_delete
BEFORE DELETE ON audit_ledger
BEGIN
  SELECT RAISE(ABORT, 'Immutable audit_ledger cannot be deleted');
END;

-- Seed GENESIS audit ledger row recording the initialization of the immutable audit system
INSERT OR IGNORE INTO audit_ledger (
  event_id,
  timestamp,
  actor_email,
  actor_role,
  auth_method,
  actor_ip_hash,
  action_type,
  target_type,
  target_id,
  reason,
  before_state_json,
  after_state_json,
  replay_command_json,
  prev_hash,
  entry_hash
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '2026-10-17T00:00:00.000Z',
  'system@thecabcall.com',
  'owner',
  'system_bootstrap',
  'GENESIS',
  'system.bootstrap',
  'audit_ledger',
  'cabcall-db',
  'Initialized immutable SHA-256 hash-chained audit ledger with BEFORE UPDATE and BEFORE DELETE triggers.',
  NULL,
  '{"ledger":"audit_ledger","hash_algorithm":"SHA-256","immutability_triggers":["trg_audit_ledger_no_update","trg_audit_ledger_no_delete"],"status":"active"}',
  '{"op":"noop","target_table":"audit_ledger","target_id":"cabcall-db","note":"Genesis ledger initialization cannot be reverted"}',
  'GENESIS',
  '88660090399fd5b997125b4f2ffaf3586818799fbd07055c727c1f7853aad620'
);
