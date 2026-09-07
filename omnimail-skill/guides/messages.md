# Messages

## Overview

Messages are emails in a mailbox. Agents can read, search, and send messages from authorized mailboxes.

## Tools

- `list_mailbox_messages` — list messages with pagination.
- `read_mailbox_message` — read full message body.
- `search_mailbox_messages` — search by sender, recipient, subject, and body.
- `send_mailbox_message` — send a new message or reply.
- `download_attachment` — download an attachment from a message.

## Rules

- Always use `mailboxId` from `list_managed_mailboxes`.
- Prefer searches over full listing when possible.
- Read message details only when needed.
- Sending requires `messages:send` scope on the mailbox.
- Attachments are read on demand; do not assume they are included in listing.

## Example

```json
{
  "mailboxId": "mb_123",
  "limit": 10,
  "cursor": null
}
```
