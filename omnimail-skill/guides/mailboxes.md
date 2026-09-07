# Mailboxes

## Overview

Mailboxes are internal OmniMail email addresses. They belong to a user. An agent can be granted access to one or more mailboxes.

## Tools

- `list_managed_mailboxes` — list mailboxes the agent can access.
- `create_mailbox` — create a new mailbox in a domain the agent is authorized for.
- `update_mailbox_status` — enable or disable a mailbox.
- `delete_mailbox` — delete a mailbox (only if grant allows).

## Rules

- Only operate on mailboxes present in `list_agent_grants`.
- Creation requires `mailboxes:create` scope.
- Status changes require `mailboxes:manage` scope.
- Deletion requires `mailboxes:delete` scope.
- Never change mailbox ownership or grants.

## Example

```json
{
  "domain": "example.com",
  "localPart": "support"
}
```
