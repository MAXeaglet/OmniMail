# Summarize Inbox

## Goal

Produce a concise summary of the latest messages in one or more mailboxes.

## Steps

1. Call `list_agent_grants` to identify authorized mailboxes.
2. For each relevant mailbox, call `list_mailbox_messages` with `limit=20`.
3. Collect subject, sender, preview, and timestamp.
4. Optionally call `read_mailbox_message` for important messages.
5. Produce a categorized summary in natural language.

## Example

```
User: Summarize my inbox
Agent:
  - 5 new messages
  - 2 from Alice about the project
  - 1 from Bob about the invoice
  - ...
```
