# Agent Events and Trigger Semantics

- Status: accepted
- Date: 2025-09-07

## Context

Some mailboxes act as "trigger" entries for an agent, while all authorized mailboxes are anyway pull-able. Incoming OmniMail internal messages flow through Email Routing → Worker → Queue → D1/R2. We want to notify an agent when such a message has been fully parsed and stored.

External mailboxes are not real-time; they use periodic sync and should stay pull-only in the first version.

## Decision

- Every grant is pull-able by default.
- `trigger_enabled = true` on a mailbox grant (or on the effective grant for a mailbox) makes it a trigger entry.
- When an internal message is parsed successfully, the worker inserts an event into `agent_events` if any trigger grant applies.
- The event is also enqueued in Cloudflare Queue for delivery/retry.
- Events carry only `message_id` and `mailbox_id`; the agent reads the message via `/api/v1/agent/*`.
- Events are acked by the agent; status transitions `pending → acked` or `pending → failed`.
- Events are retained for 7 days after being acked/failed; pending events older than 24 hours are retried or failed.
- A future webhook delivery path is reserved through `agent_grants.webhook_config`.

## Consequences

- No new mailbox concept is introduced; any authorized mailbox can become a trigger entry.
- The main mail flow is unchanged: only an additional event row + queue message is created after parsing.
- The agent can always pull even when no trigger is configured.
