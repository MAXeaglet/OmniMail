# MCP Server on Cloudflare Workers

- Status: accepted
- Date: 2025-09-07

## Context

OmniMail is Cloudflare-native: Worker, D1, R2, Queue, Workflows. An MCP server that runs as a separate Node process would break the self-hosted, Git-deployed, zero-ops model. We need the MCP server to live on the same Worker while still supporting local/stdio clients.

## Decision

- MCP Server runs on the same Cloudflare Worker.
- Public endpoint: `GET /mcp` (SSE) and `POST /mcp` (Streamable HTTP / JSON).
- MCP routes are separate from `/api/v1/agent/*`.
- MCP internally authenticates with API key, exchanges it for an access token, then calls `/api/v1/agent/*` over HTTP inside the same Worker.
- Tool logic is transport-agnostic.
- A local stdio bridge is an optional thin client that forwards stdio to the remote HTTP MCP endpoint. It is not part of the core deployment.
- MCP uses `@modelcontextprotocol/sdk` or a Cloudflare-compatible wrapper.

## Consequences

- No extra Node service is required for production.
- Local agents that only support stdio can still connect through the optional bridge.
- MCP can be deployed and released together with OmniMail through Git + Wrangler.
- We keep a clean separation: `/api/v1/agent/*` is the stable REST API, `/mcp` is the agent-protocol adapter.
