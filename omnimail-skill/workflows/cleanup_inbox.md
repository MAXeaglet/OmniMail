# Cleanup Inbox

## Goal

Help the user organize and clean up an inbox.

## Steps

1. Call `list_mailbox_messages` to inspect messages.
2. Identify newsletters, old messages, or spam-like content.
3. Report a cleanup plan without deleting anything.
4. If the user approves, use mailbox management tools if available.
5. Do not delete messages unless explicitly requested and permitted.

## Rules

- Never delete without explicit user approval.
- Do not mark messages as read unless asked.
- Do not move messages in the first version.
- Always explain the proposed actions before performing them.
