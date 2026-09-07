// Agent runtime API: what an agent can call on itself.
import type { D1Database } from '@cloudflare/workers-types'
import type { AgentRow } from './agent-types'
import {
  ackAgentEvent,
  listAgentEvents,
  listAgentGrants,
} from './agent-db'
import {
  effectiveTriggerForMailbox,
  hasGrantForExternalAccount,
  hasGrantForMailbox,
  grantScopesForExternalAccount,
  grantScopesForMailbox,
} from './agent-auth'
import { expandAgentScope } from './agent-types'

export interface AgentContext {
  agent: AgentRow
  db: D1Database
}

export function agentInfo(agent: AgentRow) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    ownerUserId: agent.owner_user_id,
  }
}

export async function listAgentGrantsForRuntime(
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
    scopes: expandAgentScope(g.scope),
    triggerEnabled: g.trigger_enabled === 1,
    createdAt: g.created_at,
  }))
}

export async function listAgentGrantedMailboxes(
  db: D1Database,
  agentId: string,
) {
  const grants = await listAgentGrants({ DB: db }, agentId)
  const mailboxGrants = grants.filter((g) => g.resource_type === 'mailbox')
  const userGrants = grants.filter((g) => g.resource_type === 'user')
  const output = []
  const seen = new Set<string>()
  for (const g of mailboxGrants) {
    seen.add(g.resource_id)
    output.push({
      mailboxAddress: g.resource_id,
      scopes: expandAgentScope(g.scope),
      triggerEnabled: await effectiveTriggerForMailbox(db, grants, g.resource_id),
    })
  }
  for (const g of userGrants) {
    const rows = await db.prepare(
      'SELECT address FROM mailboxes WHERE user_id = ?',
    ).bind(g.resource_id).all<{ address: string }>()
    for (const row of rows.results) {
      if (seen.has(row.address)) continue
      seen.add(row.address)
      output.push({
        mailboxAddress: row.address,
        scopes: expandAgentScope(g.scope),
        triggerEnabled: await effectiveTriggerForMailbox(db, grants, row.address),
      })
    }
  }
  return output
}

export async function listAgentGrantedExternalAccounts(
  db: D1Database,
  agentId: string,
) {
  const grants = await listAgentGrants({ DB: db }, agentId)
  const externalGrants = grants.filter((g) => g.resource_type === 'external_account')
  return externalGrants.map((g) => ({
    accountId: g.resource_id,
    provider: g.provider,
    scopes: expandAgentScope(g.scope),
  }))
}

export async function canAccessMailbox(
  db: D1Database,
  grants: Awaited<ReturnType<typeof listAgentGrants>>,
  mailboxAddress: string,
  requiredScope: string,
): Promise<boolean> {
  if (!await hasGrantForMailbox(db, grants, mailboxAddress)) return false
  const mailboxOwner = await db.prepare('SELECT user_id FROM mailboxes WHERE address = ?')
    .bind(mailboxAddress)
    .first<{ user_id: string }>()
  const scopes = grantScopesForMailbox(grants, mailboxAddress, mailboxOwner?.user_id ?? null)
  return scopes.has(requiredScope)
}

export async function canAccessExternalAccount(
  grants: Awaited<ReturnType<typeof listAgentGrants>>,
  provider: string,
  accountId: string,
  requiredScope: string,
): Promise<boolean> {
  if (!hasGrantForExternalAccount(grants, provider, accountId)) return false
  const scopes = grantScopesForExternalAccount(grants, provider, accountId)
  return scopes.has(requiredScope)
}

export async function listAgentRuntimeEvents(
  db: D1Database,
  agentId: string,
  status: string,
  limit: number,
  cursor: number | null,
) {
  const events = await listAgentEvents({ DB: db }, agentId, status, limit, cursor)
  return events.map((e) => ({
    id: e.id,
    mailboxAddress: e.mailbox_address,
    messageId: e.message_id,
    eventType: e.event_type,
    status: e.status,
    attempts: e.attempts,
    createdAt: e.created_at,
    lastAttemptAt: e.last_attempt_at,
    ackedAt: e.acked_at,
  }))
}

export async function ackAgentRuntimeEvent(
  db: D1Database,
  eventId: string,
  agentId: string,
) {
  const ok = await ackAgentEvent({ DB: db }, eventId, agentId, Math.floor(Date.now() / 1000))
  return { ok }
}
