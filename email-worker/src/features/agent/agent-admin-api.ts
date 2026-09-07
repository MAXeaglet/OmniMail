// Agent management API for owners and admins.
import type { D1Database } from '@cloudflare/workers-types'
import type { UserRow } from '../../app/types'
import type { AgentRow } from './agent-types'
import type { AgentGrantResourceType } from './agent-types'
import { randomToken, sha256 } from './agent-token'
import {
  getAgentById,
  getAgentByOwner,
  listAgentGrants,
} from './agent-db'

const API_KEY_PREFIX = 'om_ak_'

export interface ManagedAgentInput {
  name?: unknown
  description?: unknown
  status?: unknown
  ownerUserId?: unknown
}

function toAgentOutput(agent: AgentRow) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    ownerUserId: agent.owner_user_id,
    createdAt: agent.created_at,
    updatedAt: agent.updated_at,
  }
}

export async function createAgent(
  db: D1Database,
  creator: Pick<UserRow, 'id' | 'role'>,
  body: ManagedAgentInput,
): Promise<{ ok: true } | { error: string; status: number }> {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!name || name.length > 80) {
    return { error: 'Agent 名称需要在 1–80 个字符之间。', status: 400 }
  }
  const now = Math.floor(Date.now() / 1000)
  const id = crypto.randomUUID()
  const ownerUserId = creator.role === 'admin' || creator.role === 'super_admin'
    ? null
    : creator.id
  await db.prepare(
    `INSERT INTO agents (id, name, description, status, owner_user_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
  ).bind(id, name, description, ownerUserId, creator.id, now, now).run()
  return { ok: true }
}

export async function listAgents(
  db: D1Database,
  user: Pick<UserRow, 'id' | 'role'>,
): Promise<AgentRow[]> {
  if (user.role === 'admin' || user.role === 'super_admin') {
    const result = await db.prepare(
      `SELECT id, name, description, status, owner_user_id, created_by, created_at, updated_at
       FROM agents ORDER BY created_at DESC`,
    ).all<AgentRow>()
    return result.results
  }
  return getAgentByOwner({ DB: db }, user.id)
}

export async function ensureAgentOwner(
  db: D1Database,
  agentId: string,
  user: Pick<UserRow, 'id' | 'role'>,
): Promise<AgentRow | { error: string; status: number } | null> {
  const agent = await getAgentById({ DB: db }, agentId)
  if (!agent) return { error: 'Agent 不存在。', status: 404 }
  if (user.role === 'admin' || user.role === 'super_admin') return agent
  if (agent.owner_user_id !== user.id) {
    return { error: '无权操作此 Agent。', status: 403 }
  }
  return agent
}

export async function generateAgentApiKey(
  db: D1Database,
  agentId: string,
  name: string,
): Promise<{ apiKey: string } | { error: string; status: number }> {
  const now = Math.floor(Date.now() / 1000)
  const raw = randomToken(API_KEY_PREFIX)
  const hash = await sha256(raw)
  const id = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO agent_api_keys (id, agent_id, key_hash, prefix, name, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
  ).bind(id, agentId, hash, raw.slice(0, 12), name, now).run()
  return { apiKey: raw }
}

export async function revokeAgentApiKey(
  db: D1Database,
  apiKeyId: string,
  agentId: string,
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE agent_api_keys SET status = 'revoked'
     WHERE id = ? AND agent_id = ? AND status = 'active'`,
  ).bind(apiKeyId, agentId).run()
  return result.meta.changes > 0
}

export async function addAgentGrant(
  db: D1Database,
  agentId: string,
  body: {
    resourceType?: unknown
    resourceId?: unknown
    provider?: unknown
    includeExternal?: unknown
    scope?: unknown
    triggerEnabled?: unknown
  },
): Promise<{ ok: true } | { error: string; status: number }> {
  const resourceType = body.resourceType as AgentGrantResourceType
  if (resourceType !== 'mailbox' && resourceType !== 'external_account' && resourceType !== 'user') {
    return { error: '无效的 resourceType。', status: 400 }
  }
  if (typeof body.resourceId !== 'string' || !body.resourceId) {
    return { error: 'resourceId 不能为空。', status: 400 }
  }
  const scope = typeof body.scope === 'string' && body.scope.trim() ? body.scope.trim() : 'messages:read'
  const now = Math.floor(Date.now() / 1000)
  const id = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO agent_grants
      (id, agent_id, resource_type, resource_id, provider, include_external, scope, trigger_enabled, granted_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    agentId,
    resourceType,
    body.resourceId,
    typeof body.provider === 'string' ? body.provider : '',
    body.includeExternal === true ? 1 : 0,
    scope,
    body.triggerEnabled === true ? 1 : 0,
    'owner',
    now,
  ).run()
  return { ok: true }
}

export async function removeAgentGrant(
  db: D1Database,
  grantId: string,
  agentId: string,
): Promise<boolean> {
  const result = await db.prepare(
    `DELETE FROM agent_grants WHERE id = ? AND agent_id = ?`,
  ).bind(grantId, agentId).run()
  return result.meta.changes > 0
}

export async function listAgentGrantsForAdmin(
  db: D1Database,
  agentId: string,
) {
  const grants = await listAgentGrants({ DB: db }, agentId)
  return grants.map((g) => ({
    id: g.id,
    resourceType: g.resource_type,
    resourceId: g.resource_id,
    provider: g.provider,
    includeExternal: g.include_external === 1,
    scopes: g.scope.split(/\s+/),
    triggerEnabled: g.trigger_enabled === 1,
    createdAt: g.created_at,
  }))
}
