// MCP tool definitions and handlers.
import type { Env } from '../../app/types'
import type { AgentGrantRow } from './agent-types'
import { listAgentGrants } from './agent-db'
import {
  agentInfo,
  listAgentGrantedExternalAccounts,
  listAgentGrantedMailboxes,
  listAgentGrantsForRuntime,
  listAgentRuntimeEvents,
  ackAgentRuntimeEvent,
} from './agent-runtime-api'
import {
  agentCreateMailbox,
  agentListMailboxMessages,
  agentReadMailboxMessage,
  agentSearchMailboxMessages,
  agentSendMailboxMessage,
} from './agent-mail-api'

export interface McpToolContext {
  env: Env
  agentId: string
}

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>, ctx: McpToolContext) => Promise<unknown>
}

async function withGrants(ctx: McpToolContext): Promise<AgentGrantRow[]> {
  return listAgentGrants({ DB: ctx.env.DB }, ctx.agentId)
}

export const mcpTools: McpTool[] = [
  {
    name: 'agent_info',
    description: '返回当前 Agent 的基本信息。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async (_args, ctx) => {
      const { getAgentById } = await import('./agent-db')
      const agent = await getAgentById({ DB: ctx.env.DB }, ctx.agentId)
      return agent ? agentInfo(agent) : null
    },
  },
  {
    name: 'list_agent_grants',
    description: '列出当前 Agent 拥有的授权。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async (_args, ctx) => listAgentGrantsForRuntime(ctx.env.DB, ctx.agentId),
  },
  {
    name: 'list_managed_mailboxes',
    description: '列出当前 Agent 可以访问的邮箱地址。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async (_args, ctx) => listAgentGrantedMailboxes(ctx.env.DB, ctx.agentId),
  },
  {
    name: 'list_mailbox_messages',
    description: '列出某个邮箱的邮件。',
    inputSchema: {
      type: 'object',
      properties: {
        mailboxAddress: { type: 'string', description: '邮箱地址' },
        folder: { type: 'string', enum: ['inbox', 'sent', 'trash'], default: 'inbox' },
        limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
        cursor: { type: 'number', description: '游标' },
      },
      required: ['mailboxAddress'],
      additionalProperties: false,
    },
    execute: async (args, ctx) => {
      const grants = await withGrants(ctx)
      return agentListMailboxMessages(
        { env: ctx.env, agentId: ctx.agentId, grants },
        String(args.mailboxAddress),
        String(args.folder || 'inbox'),
        Number(args.limit || 20),
        args.cursor == null ? null : Number(args.cursor),
      )
    },
  },
  {
    name: 'read_mailbox_message',
    description: '读取某封邮件的完整内容。',
    inputSchema: {
      type: 'object',
      properties: {
        mailboxAddress: { type: 'string' },
        messageId: { type: 'string' },
      },
      required: ['mailboxAddress', 'messageId'],
      additionalProperties: false,
    },
    execute: async (args, ctx) => {
      const grants = await withGrants(ctx)
      return agentReadMailboxMessage(
        { env: ctx.env, agentId: ctx.agentId, grants },
        String(args.mailboxAddress),
        String(args.messageId),
      )
    },
  },
  {
    name: 'search_mailbox_messages',
    description: '在某个邮箱中搜索邮件。',
    inputSchema: {
      type: 'object',
      properties: {
        mailboxAddress: { type: 'string' },
        query: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
      },
      required: ['mailboxAddress', 'query'],
      additionalProperties: false,
    },
    execute: async (args, ctx) => {
      const grants = await withGrants(ctx)
      return agentSearchMailboxMessages(
        { env: ctx.env, agentId: ctx.agentId, grants },
        String(args.mailboxAddress),
        String(args.query),
        Number(args.limit || 20),
      )
    },
  },
  {
    name: 'send_mailbox_message',
    description: '从某个邮箱发送新邮件或回复。',
    inputSchema: {
      type: 'object',
      properties: {
        mailboxAddress: { type: 'string' },
        to: { type: 'string' },
        subject: { type: 'string' },
        text: { type: 'string' },
        idempotencyKey: { type: 'string' },
      },
      required: ['mailboxAddress', 'to', 'subject', 'text'],
      additionalProperties: false,
    },
    execute: async (args, ctx) => {
      const grants = await withGrants(ctx)
      return agentSendMailboxMessage(
        { env: ctx.env, agentId: ctx.agentId, grants },
        String(args.mailboxAddress),
        {
          to: args.to,
          subject: args.subject,
          text: args.text,
          idempotencyKey: args.idempotencyKey,
        },
      )
    },
  },
  {
    name: 'create_mailbox',
    description: '创建新的邮箱地址。',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        localPart: { type: 'string' },
      },
      required: ['domain', 'localPart'],
      additionalProperties: false,
    },
    execute: async (args, ctx) => {
      const grants = await withGrants(ctx)
      return agentCreateMailbox(
        { env: ctx.env, agentId: ctx.agentId, grants },
        String(args.domain),
        String(args.localPart),
      )
    },
  },
  {
    name: 'list_external_accounts',
    description: '列出当前 Agent 可访问的外部邮箱账号。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async (_args, ctx) => listAgentGrantedExternalAccounts(ctx.env.DB, ctx.agentId),
  },
  {
    name: 'list_agent_events',
    description: '列出 Agent 事件（待处理/已处理）。',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'acked', 'failed', 'all'], default: 'pending' },
        limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
        cursor: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: async (args, ctx) => listAgentRuntimeEvents(
      ctx.env.DB,
      ctx.agentId,
      String(args.status || 'pending'),
      Number(args.limit || 20),
      args.cursor == null ? null : Number(args.cursor),
    ),
  },
  {
    name: 'ack_agent_event',
    description: '确认处理完某个 Agent 事件。',
    inputSchema: {
      type: 'object',
      properties: { eventId: { type: 'string' } },
      required: ['eventId'],
      additionalProperties: false,
    },
    execute: async (args, ctx) => ackAgentRuntimeEvent(
      ctx.env.DB,
      String(args.eventId),
      ctx.agentId,
    ),
  },
]
