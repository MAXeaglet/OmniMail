// Agent authorization helpers.
import type { D1Database } from '@cloudflare/workers-types'
import type { AgentGrantRow } from './agent-types'
import { expandAgentScope } from './agent-types'
import { listAgentGrants } from './agent-db'

export interface AgentAuthContext {
  agentId: string
  grants: AgentGrantRow[]
}

export async function loadAgentAuth(
  db: D1Database,
  agentId: string,
): Promise<AgentAuthContext> {
  const grants = await listAgentGrants({ DB: db }, agentId)
  return { agentId, grants }
}

export async function mailboxOwnerUserId(
  db: D1Database,
  mailboxAddress: string,
): Promise<string | null> {
  const row = await db.prepare('SELECT user_id FROM mailboxes WHERE address = ?')
    .bind(mailboxAddress)
    .first<{ user_id: string }>()
  return row?.user_id ?? null
}

export function grantScopesForUser(grants: AgentGrantRow[], userId: string): Set<string> {
  const scopes = new Set<string>()
  for (const grant of grants) {
    if (grant.resource_type === 'user' && grant.resource_id === userId) {
      for (const scope of expandAgentScope(grant.scope)) scopes.add(scope)
    }
  }
  return scopes
}

export function grantScopesForMailbox(
  grants: AgentGrantRow[],
  mailboxAddress: string,
  mailboxUserId: string | null,
): Set<string> {
  const scopes = new Set<string>()
  for (const grant of grants) {
    if (grant.resource_type === 'mailbox' && grant.resource_id === mailboxAddress) {
      for (const scope of expandAgentScope(grant.scope)) scopes.add(scope)
    }
    if (grant.resource_type === 'user' && mailboxUserId !== null && grant.resource_id === mailboxUserId) {
      for (const scope of expandAgentScope(grant.scope)) scopes.add(scope)
    }
  }
  return scopes
}

export function grantScopesForExternalAccount(
  grants: AgentGrantRow[],
  provider: string,
  accountId: string,
): Set<string> {
  const scopes = new Set<string>()
  for (const grant of grants) {
    if (grant.resource_type === 'external_account'
      && grant.resource_id === accountId
      && (grant.provider === '' || grant.provider === provider)) {
      for (const scope of expandAgentScope(grant.scope)) scopes.add(scope)
    }
  }
  return scopes
}

export async function hasGrantForMailbox(
  db: D1Database,
  grants: AgentGrantRow[],
  mailboxAddress: string,
): Promise<boolean> {
  if (grants.some((g) => g.resource_type === 'mailbox' && g.resource_id === mailboxAddress)) {
    return true
  }
  const userId = await mailboxOwnerUserId(db, mailboxAddress)
  if (userId === null) return false
  return grants.some((g) => g.resource_type === 'user' && g.resource_id === userId)
}

export function hasGrantForExternalAccount(
  grants: AgentGrantRow[],
  provider: string,
  accountId: string,
): boolean {
  return grants.some((g) =>
    g.resource_type === 'external_account'
    && g.resource_id === accountId
    && (g.provider === '' || g.provider === provider),
  )
}

export async function effectiveTriggerForMailbox(
  db: D1Database,
  grants: AgentGrantRow[],
  mailboxAddress: string,
): Promise<boolean> {
  const exact = grants.find((g) =>
    g.resource_type === 'mailbox' && g.resource_id === mailboxAddress,
  )
  if (exact) return exact.trigger_enabled === 1
  const userId = await mailboxOwnerUserId(db, mailboxAddress)
  if (userId === null) return false
  const userGrant = grants.find((g) =>
    g.resource_type === 'user' && g.resource_id === userId,
  )
  return userGrant?.trigger_enabled === 1
}

export function agentScopesForToken(grants: AgentGrantRow[]): string {
  const set = new Set<string>()
  for (const grant of grants) {
    for (const scope of expandAgentScope(grant.scope)) set.add(scope)
  }
  return [...set].join(' ')
}
