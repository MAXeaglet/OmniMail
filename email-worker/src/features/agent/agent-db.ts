// Agent persistence helpers.
import type {
  AgentApiKeyRow,
  AgentEventRow,
  AgentGrantRow,
  AgentRow,
} from './agent-types'

export interface AgentDb {
  DB: D1Database
}

const agentColumns = `
  id, name, description, status, owner_user_id, created_by, created_at, updated_at
`
const grantColumns = `
  id, agent_id, resource_type, resource_id, provider, include_external, scope,
  trigger_enabled, webhook_config, granted_by, expires_at, created_at
`
const eventColumns = `
  id, agent_id, mailbox_address, message_id, event_type, status, attempts,
  created_at, last_attempt_at, acked_at
`
const apiKeyColumns = `
  id, agent_id, key_hash, prefix, name, status, expires_at, created_at, last_used_at
`

export async function getAgentById(db: AgentDb, id: string): Promise<AgentRow | null> {
  const row = await db.DB.prepare(`SELECT ${agentColumns} FROM agents WHERE id = ?`)
    .bind(id)
    .first<AgentRow>()
  return row ?? null
}

export async function getAgentByOwner(db: AgentDb, ownerUserId: string): Promise<AgentRow[]> {
  const result = await db.DB.prepare(`SELECT ${agentColumns} FROM agents WHERE owner_user_id = ? ORDER BY created_at DESC`)
    .bind(ownerUserId)
    .all<AgentRow>()
  return result.results
}

export async function getAgentByApiKeyHash(db: AgentDb, hash: string): Promise<{
  key: AgentApiKeyRow
  agent: AgentRow
} | null> {
  const row = await db.DB.prepare(`
    SELECT ak.${apiKeyColumns}, a.id AS agent_id, a.name AS agent_name,
           a.description AS agent_description, a.status AS agent_status,
           a.owner_user_id AS agent_owner_user_id, a.created_by AS agent_created_by,
           a.created_at AS agent_created_at, a.updated_at AS agent_updated_at
    FROM agent_api_keys ak
    JOIN agents a ON a.id = ak.agent_id
    WHERE ak.key_hash = ? AND ak.status = 'active'
  `).bind(hash).first<Record<string, unknown>>()
  if (!row) return null
  return {
    key: {
      id: String(row.id),
      agent_id: String(row.agent_id),
      key_hash: String(row.key_hash),
      prefix: String(row.prefix),
      name: String(row.name),
      status: 'active',
      expires_at: row.expires_at === null ? null : Number(row.expires_at),
      created_at: Number(row.created_at),
      last_used_at: row.last_used_at === null ? null : Number(row.last_used_at),
    },
    agent: {
      id: String(row.agent_id),
      name: String(row.agent_name),
      description: String(row.agent_description),
      status: row.agent_status as AgentRow['status'],
      owner_user_id: row.agent_owner_user_id === null ? null : String(row.agent_owner_user_id),
      created_by: String(row.agent_created_by),
      created_at: Number(row.agent_created_at),
      updated_at: Number(row.agent_updated_at),
    },
  }
}

export async function listAgentGrants(db: AgentDb, agentId: string): Promise<AgentGrantRow[]> {
  const result = await db.DB.prepare(`
    SELECT ${grantColumns}
    FROM agent_grants
    WHERE agent_id = ?
    ORDER BY created_at DESC
  `).bind(agentId).all<AgentGrantRow>()
  return result.results
}

export async function listAgentEvents(
  db: AgentDb,
  agentId: string,
  status: string,
  limit: number,
  cursor: number | null,
): Promise<AgentEventRow[]> {
  const conditions = ['agent_id = ?']
  const bindings: unknown[] = [agentId]
  if (status !== 'all') {
    conditions.push('status = ?')
    bindings.push(status)
  }
  let sql = `
    SELECT ${eventColumns}
    FROM agent_events
    WHERE ${conditions.join(' AND ')}
  `
  if (cursor !== null) {
    bindings.push(cursor)
    sql += ' AND created_at < ?'
  }
  bindings.push(limit)
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?'
  const result = await db.DB.prepare(sql).bind(...bindings).all<AgentEventRow>()
  return result.results
}

export async function ackAgentEvent(
  db: AgentDb,
  eventId: string,
  agentId: string,
  ackedAt: number,
): Promise<boolean> {
  const result = await db.DB.prepare(`
    UPDATE agent_events
    SET status = 'acked', acked_at = ?, last_attempt_at = ?
    WHERE id = ? AND agent_id = ? AND status = 'pending'
  `).bind(ackedAt, ackedAt, eventId, agentId).run()
  return result.meta.changes > 0
}

export async function markAgentEventFailed(
  db: AgentDb,
  eventId: string,
  agentId: string,
  at: number,
): Promise<boolean> {
  const result = await db.DB.prepare(`
    UPDATE agent_events
    SET status = 'failed', last_attempt_at = ?
    WHERE id = ? AND agent_id = ? AND status = 'pending'
  `).bind(at, eventId, agentId).run()
  return result.meta.changes > 0
}

