# OmniMail Context

> Glossary for the OmniMail agent design. This file defines canonical terms used across the repository, docs, and code.

## Accounts

- **User**: A human or human-facing identity in OmniMail. Roles are `super_admin`, `admin`, `user`, `temporary`. Users own mailboxes and external accounts.
- **Agent**: A second-class account in OmniMail. It has no password, no web login, and authenticates with API keys. It acts on behalf of users through grants.

## Credentials

- **API Key**: Long-lived credential for an agent. Only the hash is stored. Raw value is shown once at creation.
- **Access Token**: Short-lived bearer token minted from an API key (15 minutes). Scopes are the union of the agent's active grant scopes.

## Authorization

- **Grant**: A relation between an agent and a resource (mailbox, external account, or user). Controls pull access, scopes, and optional trigger behavior.
- **Full Grant**: A grant with `scope = 'full'`. Expands to every available scope for the granted user. Does not grant authority to manage grants.
- **Owner**: A user who created an agent, or an administrator for system agents. Owners manage their own agents' grants and API keys.
- **Resource Type**: `mailbox`, `external_account`, or `user`.

## Mailboxes

- **Mailbox**: An internal OmniMail email address (`user@example.com`). Owned by a user. Can be granted to an agent.
- **Trigger Enabled**: A flag on a grant. When true, new mail delivered to that mailbox creates an agent event.
- **Pull**: The default ability of an agent to list/read/search messages from an authorized mailbox.

## External Accounts

- **External Account**: A third-party email account (Gmail, QQ, Microsoft, NAVER, Yandex, Linux DO, iCloud) connected by a user. Can be granted to an agent.
- **External Read**: Agent can list/read/download attachments from a granted external account.
- **External Send**: Agent can send via a granted external account when the provider supports sending (QQ, Linux DO).

## Events

- **Agent Event**: A record in `agent_events` created when a trigger-enabled mailbox receives a parsed message. Carries `message_id` and `mailbox_id`; the agent reads content via the API.
- **Ack**: Agent confirms it has processed an event. Status transitions from `pending` to `acked`.

## MCP

- **MCP Server**: A Cloudflare Worker endpoint at `/mcp` providing tools, resources, and prompts for AI agents.
- **MCP Tool**: A callable operation exposed through MCP, e.g. `read_mailbox_message`.
- **Skill Package**: `omnimail-skill/` directory containing guides and workflows used by local agents and mirrored into MCP resources/prompts.

## Cloudflare

- **Queue**: Used for asynchronous mail parsing, agent event delivery, and external sync jobs.
- **D1**: SQLite-compatible database for users, mailboxes, grants, events, and metadata.
- **R2**: Object storage for raw mail, bodies, and attachments.
