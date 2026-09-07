# External Accounts

## Overview

External accounts are third-party mail accounts connected to OmniMail (Gmail, QQ, Microsoft, NAVER, Yandex, Linux DO, iCloud). An agent may be granted read access and, for QQ and Linux DO, send access.

## Tools

- `list_external_accounts` — list granted external accounts.
- `list_external_messages` — list messages in an external account.
- `read_external_message` — read full message body.
- `download_external_attachment` — download an attachment.
- `send_external_message` — send a message (QQ and Linux DO only).

## Rules

- Use `accountId` from `list_external_accounts`.
- External bodies/attachments are fetched on demand; they are not stored in OmniMail.
- Only QQ and Linux DO support sending.
- Never attempt to send from a read-only external account.

## Example

```json
{
  "accountId": "ext_123",
  "limit": 10
}
```
