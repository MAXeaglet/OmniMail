-- Agent grants and events.
CREATE TABLE agent_grants (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('mailbox', 'external_account', 'user')),
  resource_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  include_external INTEGER NOT NULL DEFAULT 0 CHECK (include_external IN (0, 1)),
  scope TEXT NOT NULL,
  trigger_enabled INTEGER NOT NULL DEFAULT 0 CHECK (trigger_enabled IN (0, 1)),
  webhook_config TEXT,
  granted_by TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_agent_grants_agent ON agent_grants(agent_id);
CREATE INDEX idx_agent_grants_resource ON agent_grants(resource_type, resource_id, provider);
CREATE INDEX idx_agent_grants_scope ON agent_grants(scope);

CREATE TABLE agent_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mailbox_address TEXT NOT NULL COLLATE NOCASE REFERENCES mailboxes(address) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'mail.new',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acked', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at INTEGER NOT NULL,
  last_attempt_at INTEGER,
  acked_at INTEGER
);

CREATE UNIQUE INDEX idx_agent_events_unique
  ON agent_events(agent_id, mailbox_address, message_id);

CREATE INDEX idx_agent_events_status
  ON agent_events(agent_id, status, created_at DESC);

CREATE INDEX idx_agent_events_created
  ON agent_events(created_at DESC, id DESC);
