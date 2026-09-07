# Agent API Key and Token Exchange

- Status: accepted
- Date: 2025-09-07

## Context

Agents are programmatic clients. They should not use passwords. Existing device tokens use password + optional MFA to mint short-lived access tokens. Agents need a different credential that can be stored in a local config or secret manager and used by MCP clients.

## Decision

- Agents use one or more API keys (`agent_api_keys`).
- Raw API keys are shown only once at creation.
- Only SHA-256 hashes are stored.
- An API key is exchanged for a short-lived access token through `POST /api/v1/agent/token`.
- Agent access tokens reuse the existing device-token model (`client = agent`) and are valid for 15 minutes.
- No refresh token is used for agents; when the access token expires the client uses the API key again.
- Agent access token scopes are the union of all scopes in the agent's active grants.
- API keys support multiple keys, rotation, revocation, and an optional expiry.

## Consequences

- No password is needed for agents.
- MCP clients only need to configure `OMNIMAIL_API_KEY`.
- Repeated key exchange is cheap; the MCP server can cache the access token in memory.
- Revoked grants are only reflected after the next token exchange.
