# OmniMail Agent Skill

## Overview

OmniMail is a self-hosted, Cloudflare-native webmail platform. This skill teaches an AI agent how to manage one or more mailboxes through the OmniMail MCP server.

The agent operates through MCP tools. It can:

- List and manage authorized mailboxes
- Read, search, and send messages
- Handle trigger events from configured mailboxes
- Access external email accounts where granted

## Prerequisites

- An OmniMail instance with the agent feature enabled.
- An agent account and API key.
- The MCP server endpoint configured in the agent client.

## How To Use

1. Call `agent_info` to identify yourself.
2. Call `list_agent_grants` to see which mailboxes and accounts you can access.
3. Call `list_mailbox_messages` to pull messages from an authorized mailbox.
4. Use `read_mailbox_message` when you need full content.
5. Use `send_mailbox_message` to send a reply or new message from an authorized mailbox.
6. Use `list_agent_events` to see trigger notifications.
7. After processing a trigger event, call `ack_agent_event`.

## Important Rules

- NEVER attempt to operate on a mailbox or account that is not in your grants.
- NEVER try to create, modify, or delete grants.
- Respect the underlying user's sending permissions and rate limits.
- Do not send messages without a clear user request or workflow.
- Prefer `read_mailbox_message` over full mailbox downloads.
- External account sending is only available for QQ and Linux DO providers.

## Guides

- [Mailboxes](guides/mailboxes.md)
- [Messages](guides/messages.md)
- [External Accounts](guides/external.md)
- [Security](guides/security.md)

## Workflows

- [Summarize Inbox](workflows/summarize_inbox.md)
- [Classify Mail](workflows/classify_mail.md)
- [Draft Reply](workflows/draft_reply.md)
- [Customer Support](workflows/customer_support.md)
- [Cleanup Inbox](workflows/cleanup_inbox.md)

## MCP Server Configuration

```
OMNIMAIL_API_KEY=om_ak_...
OMNIMAIL_INSTANCE_URL=https://mail.example.com
MCP_TRANSPORT=stdio   # or http
```
