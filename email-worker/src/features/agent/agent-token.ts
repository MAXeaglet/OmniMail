// Agent token issuance and authentication.
import type { D1Database } from '@cloudflare/workers-types'
import type { AgentRow } from './agent-types'
import { agentScopesForToken } from './agent-auth'
import { listAgentGrants } from './agent-db'

const ACCESS_TOKEN_SECONDS = 15 * 60
const ACCESS_PREFIX = 'om_agent_at_'
const API_KEY_PREFIX = 'om_ak_'

export interface AgentIdentity {
  agent: AgentRow
  scopes: string
}

export async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const token = [...bytes].map((b) => b.toString(36)).join('')
  return `${prefix}${token}`
}

export function validAgentAccessToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith(ACCESS_PREFIX)
    && value.length > ACCESS_PREFIX.length + 20
    && value.length <= 180
}

export function validAgentApiKey(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith(API_KEY_PREFIX)
    && value.length > API_KEY_PREFIX.length + 20
    && value.length <= 180
}

export async function issueAgentToken(
  db: D1Database,
  agentId: string,
  scopes: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000)
  const accessToken = randomToken(ACCESS_PREFIX)
  const accessHash = await sha256(accessToken)
  const sessionId = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO agent_sessions
      (id, agent_id, access_token_hash, scopes, expires_at, created_at, touched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(sessionId, agentId, accessHash, scopes, now + ACCESS_TOKEN_SECONDS, now, now).run()
  return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS }
}

export async function exchangeAgentApiKey(
  db: D1Database,
  apiKey: string,
): Promise<{ agent: AgentRow; accessToken: string; expiresIn: number; scopes: string } | null> {
  if (!validAgentApiKey(apiKey)) return null
  const hash = await sha256(apiKey)
  const now = Math.floor(Date.now() / 1000)
  const row = await db.prepare(
    `SELECT a.id, a.name, a.description, a.status, a.owner_user_id,
            a.created_by, a.created_at, a.updated_at,
            ak.id AS api_key_id
       FROM agent_api_keys ak
       JOIN agents a ON a.id = ak.agent_id
      WHERE ak.key_hash = ? AND ak.status = 'active'
        AND (ak.expires_at IS NULL OR ak.expires_at > ?)`,
  ).bind(hash, now).first<AgentRow & { api_key_id: string }>()
  if (!row) return null
  await db.prepare('UPDATE agent_api_keys SET last_used_at = ? WHERE id = ?')
    .bind(now, row.api_key_id).run()
  const grants = await listAgentGrants({ DB: db }, row.id)
  const scopes = agentScopesForToken(grants)
  const { accessToken, expiresIn } = await issueAgentToken(db, row.id, scopes)
  return { agent: row, accessToken, expiresIn, scopes }
}

export async function authenticateAgentAccessToken(
  db: D1Database,
  accessToken: string,
): Promise<AgentIdentity | null> {
  if (!validAgentAccessToken(accessToken)) return null
  const hash = await sha256(accessToken)
  const now = Math.floor(Date.now() / 1000)
  const row = await db.prepare(
    `SELECT a.id, a.name, a.description, a.status, a.owner_user_id,
            a.created_by, a.created_at, a.updated_at,
            s.scopes
       FROM agent_sessions s
       JOIN agents a ON a.id = s.agent_id
      WHERE s.access_token_hash = ? AND s.expires_at > ? AND a.status = 'active'`,
  ).bind(hash, now).first<AgentRow & { scopes: string }>()
  if (!row) return null
  await db.prepare('UPDATE agent_sessions SET touched_at = ? WHERE id = ?')
    .bind(now, row.id).run()
  return {
    agent: {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      owner_user_id: row.owner_user_id,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    scopes: row.scopes,
  }
}
