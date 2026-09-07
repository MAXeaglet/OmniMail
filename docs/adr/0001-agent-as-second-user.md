# Agent As Second-Class User

- Status: accepted
- Date: 2025-09-07

## Context

OmniMail currently has four user roles: `super_admin`, `admin`, `user`, and `temporary`. All clients (Web, Android, Chrome Extension) operate as a user. External email accounts are owned by users.

We want to support AI agents that can manage multiple mailboxes. An agent is not a human user, but it needs identity, credentials, and authorization so it can safely read, send, and manage mail on behalf of one or more users.

## Decision

Introduce `agents` as a second-class account type, separate from `users`.

- An agent has no password.
- An agent authenticates with API keys.
- An agent is owned by a user (`owner_user_id`) or is a system-level agent (`owner_user_id = NULL`).
- An agent does not log into the web UI.
- An agent operates through `/api/v1/agent/*` and the MCP server.

## Consequences

- Existing user/device/session logic remains untouched.
- Agent authorization is expressed through a new `agent_grants` table.
- Agent access is always constrained by grants, never by implicit user ownership.
- The MCP server is one consumer of the agent API.
