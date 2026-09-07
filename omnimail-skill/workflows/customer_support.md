# Customer Support

## Goal

Handle a customer support inbox on behalf of a user or team.

## Steps

1. Call `list_agent_events` to find new support requests.
2. For each event, call `read_mailbox_message`.
3. Classify request type: question, bug report, refund, account, etc.
4. Draft a response using the appropriate tone and policy.
5. Confirm with the user before sending.
6. Call `ack_agent_event` after handling.

## Rules

- Never expose internal information.
- Never send without approval.
- Follow the organization's support policy if provided.
- Escalate issues that are not clearly answerable.
