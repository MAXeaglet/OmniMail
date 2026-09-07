import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppContext } from '../context'
import { clientIp } from '../../shared/http/api-helpers'
import {
  addAgentGrant,
  createAgent,
  ensureAgentOwner,
  generateAgentApiKey,
  listAgentGrantsForAdmin,
  listAgents,
  removeAgentGrant,
  revokeAgentApiKey,
} from '../../features/agent/agent-admin-api'
import {
  ackAgentRuntimeEvent,
  agentInfo,
  canAccessExternalAccount,
  canAccessMailbox,
  listAgentGrantedExternalAccounts,
  listAgentGrantedMailboxes,
  listAgentGrantsForRuntime,
  listAgentRuntimeEvents,
} from '../../features/agent/agent-runtime-api'
import {
  exchangeAgentApiKey,
} from '../../features/agent/agent-token'
import { listAgentGrants } from '../../features/agent/agent-db'
import {
  agentCreateMailbox,
  agentListMailboxMessages,
  agentReadMailboxMessage,
  agentSearchMailboxMessages,
  agentSendMailboxMessage,
} from '../../features/agent/agent-mail-api'
import type { AgentIdentity } from '../../features/agent/agent-token'

export const agentRoutes = new Hono<AppContext>()

function requireAgent(context: Context<AppContext>): AgentIdentity | null {
  const agent = context.get('agent')
  if (!agent) return null
  return agent
}

// Public: exchange API key for access token.
agentRoutes.post('/v1/agent/token', async (context) => {
  const body = await context.req.json<{ apiKey?: unknown }>().catch(() => ({} as {
    apiKey?: unknown
  }))
  if (typeof body.apiKey !== 'string') {
    return context.json({ error: 'apiKey 必须为字符串。' }, 400)
  }
  const result = await exchangeAgentApiKey(context.env.DB, body.apiKey)
  if (!result) return context.json({ error: 'API Key 无效或已过期。' }, 401)
  return context.json({
    tokenType: 'Bearer',
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    scopes: result.scopes.split(' '),
    agent: {
      id: result.agent.id,
      name: result.agent.name,
      status: result.agent.status,
    },
  })
})

// Agent management (admin or owner using user token)
agentRoutes.get('/v1/agents', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agents = await listAgents(context.env.DB, user)
  return context.json({ agents })
})

agentRoutes.post('/v1/agents', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const body = await context.req.json<{
    name?: unknown
    description?: unknown
  }>().catch(() => ({} as { name?: unknown; description?: unknown }))
  const result = await createAgent(context.env.DB, user, body)
  if ('error' in result) return context.json({ error: result.error }, result.status as 400)
  return context.json({ ok: true }, 201)
})

agentRoutes.get('/v1/agents/:id', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agent = await ensureAgentOwner(context.env.DB, context.req.param('id'), user)
  if (!agent || 'error' in agent) {
    if (agent && 'error' in agent) return context.json({ error: agent.error }, agent.status as 400)
    return context.json({ error: 'Agent 不存在。' }, 404)
  }
  return context.json({
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      ownerUserId: agent.owner_user_id,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
    },
  })
})

agentRoutes.post('/v1/agents/:id/api-keys', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agent = await ensureAgentOwner(context.env.DB, context.req.param('id'), user)
  if (!agent || 'error' in agent) {
    if (agent && 'error' in agent) return context.json({ error: agent.error }, agent.status as 400)
    return context.json({ error: 'Agent 不存在。' }, 404)
  }
  const body = await context.req.json<{ name?: unknown }>().catch(() => ({} as { name?: unknown }))
  const name = typeof body.name === 'string' ? body.name : ''
  const result = await generateAgentApiKey(context.env.DB, agent.id, name)
  return context.json(result, 201)
})

agentRoutes.post('/v1/agents/:id/api-keys/:keyId/revoke', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agent = await ensureAgentOwner(context.env.DB, context.req.param('id'), user)
  if (!agent || 'error' in agent) {
    if (agent && 'error' in agent) return context.json({ error: agent.error }, agent.status as 400)
    return context.json({ error: 'Agent 不存在。' }, 404)
  }
  const ok = await revokeAgentApiKey(context.env.DB, context.req.param('keyId'), agent.id)
  if (!ok) return context.json({ error: 'API Key 不存在或已撤销。' }, 404)
  return context.json({ ok: true })
})

agentRoutes.get('/v1/agents/:id/grants', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agent = await ensureAgentOwner(context.env.DB, context.req.param('id'), user)
  if (!agent || 'error' in agent) {
    if (agent && 'error' in agent) return context.json({ error: agent.error }, agent.status as 400)
    return context.json({ error: 'Agent 不存在。' }, 404)
  }
  const grants = await listAgentGrantsForAdmin(context.env.DB, agent.id)
  return context.json({ grants })
})

agentRoutes.post('/v1/agents/:id/grants', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agent = await ensureAgentOwner(context.env.DB, context.req.param('id'), user)
  if (!agent || 'error' in agent) {
    if (agent && 'error' in agent) return context.json({ error: agent.error }, agent.status as 400)
    return context.json({ error: 'Agent 不存在。' }, 404)
  }
  const body = await context.req.json<{
    resourceType?: unknown
    resourceId?: unknown
    provider?: unknown
    includeExternal?: unknown
    scope?: unknown
    triggerEnabled?: unknown
  }>().catch(() => ({} as {
    resourceType?: unknown
    resourceId?: unknown
    provider?: unknown
    includeExternal?: unknown
    scope?: unknown
    triggerEnabled?: unknown
  }))
  const result = await addAgentGrant(context.env.DB, agent.id, body)
  if ('error' in result) return context.json({ error: result.error }, result.status as 400)
  return context.json({ ok: true }, 201)
})

agentRoutes.delete('/v1/agents/:id/grants/:grantId', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agent = await ensureAgentOwner(context.env.DB, context.req.param('id'), user)
  if (!agent || 'error' in agent) {
    if (agent && 'error' in agent) return context.json({ error: agent.error }, agent.status as 400)
    return context.json({ error: 'Agent 不存在。' }, 404)
  }
  const ok = await removeAgentGrant(context.env.DB, context.req.param('grantId'), agent.id)
  if (!ok) return context.json({ error: '授权不存在。' }, 404)
  return context.json({ ok: true })
})

agentRoutes.patch('/v1/agents/:id', async (context) => {
  const user = context.get('user')
  if (!user) return context.json({ error: '请先登录。' }, 401)
  const agent = await ensureAgentOwner(context.env.DB, context.req.param('id'), user)
  if (!agent || 'error' in agent) {
    if (agent && 'error' in agent) return context.json({ error: agent.error }, agent.status as 400)
    return context.json({ error: 'Agent 不存在。' }, 404)
  }
  const body = await context.req.json<{
    name?: unknown
    description?: unknown
    status?: unknown
  }>().catch(() => ({} as { name?: unknown; description?: unknown; status?: unknown }))
  const name = typeof body.name === 'string' ? body.name.trim() : agent.name
  const description = typeof body.description === 'string' ? body.description.trim() : agent.description
  const status = body.status === 'disabled' || body.status === 'active'
    ? body.status
    : agent.status
  await context.env.DB.prepare(
    `UPDATE agents SET name = ?, description = ?, status = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(name, description, status, Math.floor(Date.now() / 1000), agent.id).run()
  return context.json({ ok: true })
})

// Agent runtime (agent token only)
agentRoutes.get('/v1/agent/info', (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  return context.json({ agent: agentInfo(identity.agent) })
})

agentRoutes.get('/v1/agent/grants', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const grants = await listAgentGrantsForRuntime(context.env.DB, identity.agent.id)
  return context.json({ grants })
})

agentRoutes.get('/v1/agent/mailboxes', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const mailboxes = await listAgentGrantedMailboxes(context.env.DB, identity.agent.id)
  return context.json({ mailboxes })
})

agentRoutes.get('/v1/agent/external-accounts', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const accounts = await listAgentGrantedExternalAccounts(context.env.DB, identity.agent.id)
  return context.json({ accounts })
})

agentRoutes.get('/v1/agent/events', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const status = context.req.query('status') || 'pending'
  const limit = Math.min(Math.max(Number(context.req.query('limit')) || 20, 1), 50)
  const cursorRaw = context.req.query('cursor')
  const cursor = cursorRaw ? Number(cursorRaw) : null
  const events = await listAgentRuntimeEvents(context.env.DB, identity.agent.id, status, limit, cursor)
  return context.json({ events })
})

agentRoutes.post('/v1/agent/events/:id/ack', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const result = await ackAgentRuntimeEvent(context.env.DB, context.req.param('id'), identity.agent.id)
  if (!result.ok) return context.json({ error: '事件不存在或已处理。' }, 404)
  return context.json({ ok: true })
})

agentRoutes.get('/v1/agent/mailboxes/:address/messages', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const grants = await listAgentGrants({ DB: context.env.DB }, identity.agent.id)
  const folder = context.req.query('folder') || 'inbox'
  const limit = Math.min(Math.max(Number(context.req.query('limit')) || 20, 1), 50)
  const cursorRaw = context.req.query('cursor')
  const cursor = cursorRaw ? Number(cursorRaw) : null
  const result = await agentListMailboxMessages({
    env: context.env,
    agentId: identity.agent.id,
    grants,
  }, context.req.param('address'), folder, limit, cursor)
  if ('error' in result) return context.json({ error: result.error }, 403)
  return context.json(result)
})

agentRoutes.get('/v1/agent/mailboxes/:address/messages/:messageId', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const grants = await listAgentGrants({ DB: context.env.DB }, identity.agent.id)
  const result = await agentReadMailboxMessage({
    env: context.env,
    agentId: identity.agent.id,
    grants,
  }, context.req.param('address'), context.req.param('messageId'))
  if ('error' in result) return context.json({ error: result.error }, 403)
  return context.json(result)
})

agentRoutes.get('/v1/agent/mailboxes/:address/search', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const grants = await listAgentGrants({ DB: context.env.DB }, identity.agent.id)
  const query = context.req.query('q') || ''
  const limit = Math.min(Math.max(Number(context.req.query('limit')) || 20, 1), 50)
  const result = await agentSearchMailboxMessages({
    env: context.env,
    agentId: identity.agent.id,
    grants,
  }, context.req.param('address'), query, limit)
  if ('error' in result) return context.json({ error: result.error }, 403)
  return context.json(result)
})

agentRoutes.post('/v1/agent/mailboxes/:address/messages', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const grants = await listAgentGrants({ DB: context.env.DB }, identity.agent.id)
  const body = await context.req.json<{
    to?: unknown
    subject?: unknown
    text?: unknown
    idempotencyKey?: unknown
  }>().catch(() => ({} as { to?: unknown; subject?: unknown; text?: unknown; idempotencyKey?: unknown }))
  const result = await agentSendMailboxMessage({
    env: context.env,
    agentId: identity.agent.id,
    grants,
  }, context.req.param('address'), body)
  if ('error' in result) return context.json({ error: result.error }, 403)
  return context.json(result)
})

agentRoutes.post('/v1/agent/mailboxes', async (context) => {
  const identity = requireAgent(context)
  if (!identity) return context.json({ error: '需要 Agent Token。' }, 401)
  const grants = await listAgentGrants({ DB: context.env.DB }, identity.agent.id)
  const body = await context.req.json<{ domain?: unknown; localPart?: unknown }>().catch(() => ({} as {
    domain?: unknown
    localPart?: unknown
  }))
  const result = await agentCreateMailbox({
    env: context.env,
    agentId: identity.agent.id,
    grants,
  }, typeof body.domain === 'string' ? body.domain : '', typeof body.localPart === 'string' ? body.localPart : '')
  if ('error' in result) return context.json({ error: result.error }, 403)
  return context.json(result, 201)
})
