# Classify Mail

## Goal

Categorize incoming messages into meaningful groups.

## Steps

1. Call `list_agent_events` for pending trigger events.
2. For each event, call `read_mailbox_message` using `messageId`.
3. Classify by sender, subject, keywords, and body.
4. Present the classification and suggested actions.
5. Call `ack_agent_event` after processing each event.

## Categories

- Customer Support
- Billing / Invoice
- Project Updates
- Newsletters
- Spam / Suspicious
- Personal

## Note

Do not permanently modify messages in the first version.
