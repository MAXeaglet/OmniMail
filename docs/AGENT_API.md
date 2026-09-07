# OmniMail Agent API

OmniMail 支持 Agent 作为第二类账户，通过 API Key 访问邮箱资源并可通过 MCP 协议与 AI 代理集成。

## 身份模型

- Agent 没有密码，不登录网页。
- Agent 通过 `agent_api_keys` 中的 API Key 换取短期 Access Token。
- Agent 被授权后可以访问指定的内部邮箱、外部账号或某个用户的全部内容。
- Agent 的所有操作都受 `agent_grants` 约束。

## 认证

### 换取 Access Token

```http
POST /api/v1/agent/token
Content-Type: application/json

{
  "apiKey": "om_ak_..."
}
```

响应：

```json
{
  "tokenType": "Bearer",
  "accessToken": "om_agent_at_...",
  "expiresIn": 900,
  "scopes": ["messages:read", "messages:send"],
  "agent": {
    "id": "agent-id",
    "name": "My Agent",
    "status": "active"
  }
}
```

后续请求：

```http
Authorization: Bearer om_agent_at_...
```

### MCP

MCP 端点位于 `POST /mcp`（Streamable HTTP）和 `GET /mcp`（SSE）。

本地 stdio 客户端可以使用 `mcp-bridge/` 作为薄桥接。

## 管理 API（仅 owner / 管理员）

- `POST /api/v1/agents` — 创建 Agent
- `GET /api/v1/agents` — 列出 Agent
- `GET /api/v1/agents/{id}` — Agent 详情
- `PATCH /api/v1/agents/{id}` — 更新 Agent
- `POST /api/v1/agents/{id}/api-keys` — 生成 API Key
- `POST /api/v1/agents/{id}/api-keys/{keyId}/revoke` — 吊销 API Key
- `GET /api/v1/agents/{id}/grants` — 查看授权
- `POST /api/v1/agents/{id}/grants` — 添加授权
- `DELETE /api/v1/agents/{id}/grants/{grantId}` — 移除授权

## Agent 运行时 API（仅 Agent Token）

- `GET /api/v1/agent/info`
- `GET /api/v1/agent/grants`
- `GET /api/v1/agent/mailboxes`
- `GET /api/v1/agent/mailboxes/{address}/messages`
- `GET /api/v1/agent/mailboxes/{address}/messages/{messageId}`
- `POST /api/v1/agent/mailboxes/{address}/messages`
- `GET /api/v1/agent/mailboxes/{address}/search?q=...`
- `POST /api/v1/agent/mailboxes`
- `GET /api/v1/agent/external-accounts`
- `GET /api/v1/agent/events`
- `POST /api/v1/agent/events/{id}/ack`

## MCP 工具

| 工具 | 说明 |
| --- | --- |
| `agent_info` | 当前 Agent 信息 |
| `list_agent_grants` | 授权列表 |
| `list_managed_mailboxes` | 可访问邮箱 |
| `list_mailbox_messages` | 邮件列表 |
| `read_mailbox_message` | 读取邮件 |
| `search_mailbox_messages` | 搜索邮件 |
| `send_mailbox_message` | 发信 |
| `download_attachment` | 下载附件 |
| `create_mailbox` | 创建邮箱 |
| `update_mailbox_status` | 启停邮箱 |
| `delete_mailbox` | 删除邮箱 |
| `list_external_accounts` | 外部账号列表 |
| `list_external_messages` | 外部邮件列表 |
| `read_external_message` | 读取外部邮件 |
| `send_external_message` | 外部发信（QQ / LinuxDO） |
| `list_agent_events` | 事件列表 |
| `ack_agent_event` | 确认事件 |

## Skill

`omnimail-skill/` 提供 Markdown 指南和工作流。MCP 的 `resources/list` 和 `prompts/list` 与这些文件保持一致。
