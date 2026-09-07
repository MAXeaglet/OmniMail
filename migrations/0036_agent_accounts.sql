-- Agent accounts and API keys.
-- Agents are second-class accounts: no password, API-key only.
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  owner_user_id TEXT REFERENCES users(id),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_agents_owner ON agents(owner_user_id);
CREATE INDEX idx_agents_status ON agents(status);

CREATE TABLE agent_api_keys (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX idx_agent_api_keys_agent ON agent_api_keys(agent_id);
CREATE INDEX idx_agent_api_keys_hash ON agent_api_keys(key_hash);
CREATE INDEX idx_agent_api_keys_prefix ON agent_api_keys(prefix);

-- Short-lived agent access sessions.
CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  access_token_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  touched_at INTEGER
);

CREATE INDEX idx_agent_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX idx_agent_sessions_hash ON agent_sessions(access_token_hash);
CREATE INDEX idx_agent_sessions_expiry ON agent_sessions(expires_at);
