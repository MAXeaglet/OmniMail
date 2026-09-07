# Draft Reply

## Goal

Compose a draft reply for a message.

## Steps

1. Call `read_mailbox_message` to read the original message.
2. Identify the mailbox to reply from.
3. Draft a reply preserving context and tone.
4. If the user approves, call `send_mailbox_message` with `inReplyTo` set to the original message ID.
5. If the user only wants a draft, save it in the conversation and do not send.

## Rules

- Never send without user confirmation.
- Respect the user's sending permissions.
- Keep replies concise and relevant.
