# Agent Grants: Resource-level Authorization

- Status: accepted
- Date: 2025-09-07

## Context

Agents can manage one or more mailboxes. We need a precise authorization model that lets an owner grant access to internal mailboxes, external email accounts, or everything belonging to a user. At the same time we want a shortcut ("full grant") for convenience.

## Decision

Authorize agents through a single `agent_grants` table:

```sql
agent_grants (
  id,
  agent_id,
  resource_type,        -- 'mailbox' | 'external_account' | 'user'
  resource_id,
  include_external,     -- for 'user' grants
  scope,                -- space-separated scopes, or 'full'
  trigger_enabled,      -- default false
  webhook_config,       -- JSON, reserved for future
  granted_by,
  expires_at,
  created_at
)
```

### Resource types

- `mailbox`: exact internal mailbox.
- `external_account`: exact external account (Gmail, QQ, Microsoft, etc.).
- `user`: all mailboxes of that user; optionally includes external accounts when `include_external = true`.

### Full grant

`scope = 'full'` is a shortcut. The server expands it to every read/send/manage scope for the granted user. It does **not** grant authority to modify grants.

### Trigger semantics

- Every grant may have `trigger_enabled`.
- `mailbox` grants override `user` grants for that mailbox.
- `external_account` grants do not produce trigger events.

## Consequences

- A single table covers mailboxes, external accounts, and user-wide grants.
- The server must expand `user` grants when checking a concrete mailbox.
- Agent access tokens take the union of scopes from active grants.
