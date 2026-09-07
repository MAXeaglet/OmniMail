# OmniMail Agent Design

> Status: draft  
> Date: 2025-09-07

This document captures the complete agent-native design for OmniMail. It is the working specification for a fork implementation and for PRs back to upstream.

## 1. Goal

Allow AI agents to manage one or more email accounts through a first-class agent identity, a permissioned API, and MCP support, while staying Cloudflare-native.

## 2. Concepts

### Agent

- Second-class account type in addition to `user`.
- No password, no web login.
- Authenticated by one or more API keys.
- Owned by a user or system-level (`owner_user_id = NULL`).

### Grant

- Links an agent to a resource.
- Resource types: `mailbox`, `external_account`, `user`.
- Always pull-able.
- Optionally trigger-enabled.

### Agent Event

- Created when a trigger-enabled internal mailbox receives a message.
- Stored in D1 + Cloudflare Queue.
- Acked by agent.

### MCP Server

- Cloudflare Worker endpoint at `/mcp`.
- Uses Streamable HTTP / SSE.
- Same Worker as core API; internally calls `/api/v1/agent/*`.

## 3. Tables

### agents

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  owner_user_id TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### agent_api_keys

```sql
CREATE TABLE agent_api_keys (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
```

### agent_grants

```sql
CREATE TABLE agent_grants (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  include_external INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL,
  trigger_enabled INTEGER NOT NULL DEFAULT 0,
  webhook_config TEXT,
  granted_by TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
```

### agent_events

```sql
CREATE TABLE agent_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'mail.new',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_attempt_at INTEGER,
  acked_at INTEGER
);
```

## 4. Authentication

1. Agent is created. One or more API keys are generated.
2. Raw key shown once, only hash stored.
3. MCP client configures `OMNIMAIL_API_KEY`.
4. Client calls `POST /api/v1/agent/token` to exchange API key for 15-minute access token.
5. Access token scopes = union of active grant scopes.
6. No refresh token. API key is reused when token expires.

## 5. Authorization

Every tool/API call must pass:

1. Token identifies an agent.
2. The agent's grants are loaded.
3. The required scope for the operation is present (or `full` grant expands).
4. The concrete resource is covered by a grant.
5. The underlying user's own capabilities (`can_reply`, `can_create_mailboxes`, etc.) are respected.
6. User + agent outbound rate limits are both enforced.

## 6. API Surface

### REST (`/api/v1/agent/*`)

- `POST /api/v1/agent/token`
- `GET /api/v1/agent/info`
- `GET /api/v1/agent/grants`
- `GET /api/v1/agent/mailboxes`
- `POST /api/v1/agent/mailboxes`
- `PATCH /api/v1/agent/mailboxes/{id}`
- `DELETE /api/v1/agent/mailboxes/{id}`
- `GET /api/v1/agent/mailboxes/{mailboxId}/messages`
- `GET /api/v1/agent/mailboxes/{mailboxId}/messages/{messageId}`
- `POST /api/v1/agent/mailboxes/{mailboxId}/messages`
- `GET /api/v1/agent/mailboxes/{mailboxId}/search?q=...`
- `GET /api/v1/agent/mailboxes/{mailboxId}/messages/{messageId}/attachments/{attachmentId}`
- `GET /api/v1/agent/external-accounts`
- `GET /api/v1/agent/external-accounts/{accountId}/messages`
- `GET /api/v1/agent/external-accounts/{accountId}/messages/{messageId}`
- `GET /api/v1/agent/external-accounts/{accountId}/messages/{messageId}/attachments/{attachmentId}`
- `POST /api/v1/agent/external-accounts/{accountId}/messages` (QQ / Linux DO only)
- `GET /api/v1/agent/events`
- `POST /api/v1/agent/events/{eventId}/ack`

### MCP (`/mcp`)

- `tools/list`
- `tools/call`
- `resources/list`
- `prompts/list`

## 7. MCP Tools

- `agent_info`
- `list_agent_grants`
- `list_managed_mailboxes`
- `list_mailbox_messages`
- `read_mailbox_message`
- `send_mailbox_message`
- `search_mailbox_messages`
- `download_attachment`
- `create_mailbox`
- `update_mailbox_status`
- `delete_mailbox`
- `list_external_accounts`
- `list_external_messages`
- `read_external_message`
- `download_external_attachment`
- `send_external_message`
- `list_agent_events`
- `ack_agent_event`

## 8. Skill

The project ships an optional `omnimail-skill/` directory containing guides and workflows. The MCP server builds `resources` and `prompts` from the same Markdown files.

## 9. PR Strategy

Work first in a fork, then split into small PRs:

1. Agent identity/authorization infrastructure
2. Agent mail API + events
3. MCP server
4. Skill package

## 10. Out of Scope (First Version)

- Webhook outbound delivery (reserved in schema)
- Draft support in MCP
- Star/archive/move/delete mail in MCP
- Agent management of grants
