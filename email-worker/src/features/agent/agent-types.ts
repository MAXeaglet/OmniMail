// Agent domain types for OmniMail.

export type AgentStatus = 'active' | 'disabled'

export interface AgentRow {
  id: string
  name: string
  description: string
  status: AgentStatus
  owner_user_id: string | null
  created_by: string
  created_at: number
  updated_at: number
}

export interface AgentAccount {
  id: string
  name: string
  description: string
  status: AgentStatus
  ownerUserId: string | null
}

export interface AgentApiKeyRow {
  id: string
  agent_id: string
  key_hash: string
  prefix: string
  name: string
  status: 'active' | 'revoked'
  expires_at: number | null
  created_at: number
  last_used_at: number | null
}

export type AgentGrantResourceType = 'mailbox' | 'external_account' | 'user'

export interface AgentGrantRow {
  id: string
  agent_id: string
  resource_type: AgentGrantResourceType
  resource_id: string
  provider: string
  include_external: number
  scope: string
  trigger_enabled: number
  webhook_config: string | null
  granted_by: string
  expires_at: number | null
  created_at: number
}

export interface AgentGrant {
  id: string
  agentId: string
  resourceType: AgentGrantResourceType
  resourceId: string
  provider: string
  includeExternal: boolean
  scopes: string[]
  triggerEnabled: boolean
  webhookConfig: unknown | null
  grantedBy: string
  expiresAt: number | null
  createdAt: number
}

export type AgentEventStatus = 'pending' | 'acked' | 'failed'

export interface AgentEventRow {
  id: string
  agent_id: string
  mailbox_address: string
  message_id: string
  event_type: string
  status: AgentEventStatus
  attempts: number
  created_at: number
  last_attempt_at: number | null
  acked_at: number | null
}

export interface AgentEvent {
  id: string
  agentId: string
  mailboxAddress: string
  messageId: string
  eventType: string
  status: AgentEventStatus
  attempts: number
  createdAt: number
  lastAttemptAt: number | null
  ackedAt: number | null
}

export const AGENT_EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const AGENT_PENDING_TTL_MS = 24 * 60 * 60 * 1000

// Scopes used by agent grants. Reuse existing device scopes plus mailbox management.
export const AGENT_FULL_SCOPES = [
  'messages:read',
  'messages:write',
  'messages:send',
  'messages:search',
  'messages:attachments:read',
  'mailboxes:read',
  'mailboxes:create',
  'mailboxes:manage',
  'mailboxes:delete',
  'gmail:accounts:read',
  'gmail:messages:read',
  'gmail:attachments:read',
  'qq-mail:accounts:read',
  'qq-mail:messages:read',
  'qq-mail:attachments:read',
  'qq-mail:messages:send',
  'microsoft:accounts:read',
  'microsoft:messages:read',
  'microsoft:attachments:read',
  'microsoft:folders:read',
  'naver-mail:accounts:read',
  'naver-mail:messages:read',
  'naver-mail:attachments:read',
  'yandex-mail:accounts:read',
  'yandex-mail:messages:read',
  'yandex-mail:attachments:read',
  'linuxdo-mail:account:read',
  'linuxdo-mail:messages:read',
  'linuxdo-mail:messages:send',
  'icloud:accounts:read',
  'icloud:messages:read',
].join(' ')

export function expandAgentScope(scope: string): string[] {
  if (scope.trim() === 'full') {
    return AGENT_FULL_SCOPES.split(/\s+/)
  }
  return scope.split(/\s+/).filter(Boolean)
}

export function agentScopeAllows(scopes: string, required: string): boolean {
  const expanded = expandAgentScope(scopes)
  if (expanded[0] === '*') return true
  return expanded.includes(required)
}
