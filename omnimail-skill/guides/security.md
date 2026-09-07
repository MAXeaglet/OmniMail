# Security

## Overview

OmniMail agents are powerful but constrained. The security model is designed to let agents manage mail without exposing unrelated data or allowing self-escalation.

## Core Principles

1. **Least privilege**: The agent can only access resources covered by active grants.
2. **No auth manipulation**: The agent cannot create or modify grants.
3. **User capabilities respected**: Underlying user permissions like `can_reply`, `can_send`, `can_create_mailboxes` still apply.
4. **Rate limits**: User and agent outbound rate limits are both enforced.
5. **Credentials are server-side**: API keys are hashed; tokens are short-lived.
6. **No sensitive data in events**: Agent events carry only IDs, not mail content.

## Access Checks

Every tool call enforces:

1. Agent identity from token.
2. Required scope from agent grants.
3. Concrete resource covered by a grant.
4. Underlying user capabilities.
5. Rate limits.

## Prohibited Actions

- Creating, modifying, or deleting grants.
- Accessing mailboxes not in grants.
- Sending from accounts without send scope.
- Modifying users, domains, or system settings.
- Creating other agents.

## Leak Prevention

- External account credentials are never returned.
- Attachments are only available through authenticated APIs.
- Webhook delivery (future) must be configured by owner/admin, not the agent.
