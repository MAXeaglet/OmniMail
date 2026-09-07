
// Agent external mail operations. These adapt provider APIs into internal JSON.
import type { Env, SessionUser } from '../../app/types'
import type { AgentGrantRow } from './agent-types'
import { findExternalAccount } from './agent-external-api'

export interface AgentExternalContext {
  env: Env
  agentId: string
  grants: AgentGrantRow[]
}

function jsonBody(value: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }
}

function scopePrefixForProvider(provider: string): string {
  switch (provider) {
    case 'gmail': return 'gmail'
    case 'microsoft': return 'microsoft'
    case 'qq': return 'qq-mail'
    case 'naver': return 'naver-mail'
    case 'yandex': return 'yandex-mail'
    case 'linuxdo': return 'linuxdo-mail'
    case 'icloud': return 'icloud'
    default: return provider
  }
}

function scopeForRead(provider: string): string {
  return `${scopePrefixForProvider(provider)}:messages:read`
}

function scopeForAttachments(provider: string): string {
  return `${scopePrefixForProvider(provider)}:attachments:read`
}

function scopeForSend(provider: string): string {
  return `${scopePrefixForProvider(provider)}:messages:send`
}

async function userIdForAccount(
  ctx: AgentExternalContext,
  provider: string,
  accountId: string,
): Promise<SessionUser | null> {
  const account = await findExternalAccount(ctx.env.DB, provider, accountId)
  if (!account) return null
  const row = await ctx.env.DB.prepare(
    `SELECT id, email, display_name, role, status, mailbox_limit,
            storage_quota_bytes, storage_used_bytes, can_create_mailboxes,
            can_reply, can_translate, temporary_expires_at
       FROM users WHERE id = ?`,
  ).bind(account.userId).first<{
    id: string
    email: string
    display_name: string
    role: SessionUser['role']
    status: string
    mailbox_limit: number
    storage_quota_bytes: number
    storage_used_bytes: number
    can_create_mailboxes: number
    can_reply: number
    can_translate: number
    temporary_expires_at: number | null
  }>()
  if (!row || row.status !== 'active') return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mailboxLimit: row.mailbox_limit,
    storageQuotaBytes: row.storage_quota_bytes,
    storageUsedBytes: row.storage_used_bytes,
    canCreateMailboxes: Boolean(row.can_create_mailboxes),
    canReply: Boolean(row.can_reply),
    canTranslate: Boolean(row.can_translate),
    temporaryExpiresAt: row.temporary_expires_at,
  }
}

async function hasExternalScope(
  ctx: AgentExternalContext,
  provider: string,
  accountId: string,
  required: string,
): Promise<SessionUser | { error: string }> {
  const user = await userIdForAccount(ctx, provider, accountId)
  if (!user) return { error: '外部账号不存在或用户不可用。' }
  const grant = ctx.grants.find((g) =>
    g.resource_type === 'external_account'
    && g.resource_id === accountId
    && (g.provider === '' || g.provider === provider),
  )
  const userGrant = ctx.grants.find((g) => g.resource_type === 'user' && g.include_external === 1)
  const scopes = (grant || userGrant)?.scope.split(/\s+/) || []
  if (!scopes.includes(required)) return { error: 'Agent 没有访问此外部邮箱的权限。' }
  return user
}

export async function agentListExternalMessages(
  ctx: AgentExternalContext,
  provider: string,
  accountId: string,
  query: string,
  limit: number,
): Promise<{ ok: true; messages: unknown[] } | { error: string }> {
  const userOrError = await hasExternalScope(ctx, provider, accountId, scopeForRead(provider))
  if ('error' in userOrError) return userOrError
  const user = userOrError
  const url = new URL('http://internal')
  url.searchParams.set('accountId', accountId)
  url.searchParams.set('limit', String(limit))
  if (query) url.searchParams.set('q', query)
  const request = new Request(url, { method: 'GET' })
  if (provider === 'gmail') {
    const { listGmailMessages } = await import('../gmail/gmail-api')
    const response = await listGmailMessages(ctx.env, user, request)
    const body = await response.json<{ messages?: unknown[] }>()
    return { ok: true, messages: body.messages || [] }
  }
  if (provider === 'qq') {
    const { listQqMailMessages } = await import('../qq-mail/qq-mail-message-api')
    const response = await listQqMailMessages(ctx.env, user, request)
    const body = await response.json<{ messages?: unknown[] }>()
    return { ok: true, messages: body.messages || [] }
  }
  if (provider === 'microsoft') {
    const { listMicrosoftMessages } = await import('../microsoft/microsoft-message-api')
    const response = await listMicrosoftMessages(ctx.env, user, request)
    const body = await response.json<{ messages?: unknown[] }>()
    return { ok: true, messages: body.messages || [] }
  }
  if (provider === 'naver') {
    const { listNaverMailMessages } = await import('../naver-mail/naver-mail-message-api')
    const response = await listNaverMailMessages(ctx.env, user, request)
    const body = await response.json<{ messages?: unknown[] }>()
    return { ok: true, messages: body.messages || [] }
  }
  if (provider === 'yandex') {
    const { listYandexMailMessages } = await import('../yandex-mail/yandex-mail-message-api')
    const response = await listYandexMailMessages(ctx.env, user, request)
    const body = await response.json<{ messages?: unknown[] }>()
    return { ok: true, messages: body.messages || [] }
  }
  if (provider === 'linuxdo') {
    const { listLinuxDoMailInbox } = await import('../linux-do-mail/linux-do-mail-api')
    const response = await listLinuxDoMailInbox(ctx.env, user, request)
    const body = await response.json<{ messages?: unknown[] }>()
    return { ok: true, messages: body.messages || [] }
  }
  return { error: `不支持的邮箱来源：${provider}` }
}

export async function agentReadExternalMessage(
  ctx: AgentExternalContext,
  provider: string,
  accountId: string,
  messageId: string,
): Promise<{ ok: true; message: unknown } | { error: string }> {
  const userOrError = await hasExternalScope(ctx, provider, accountId, scopeForRead(provider))
  if ('error' in userOrError) return userOrError
  const user = userOrError
  if (provider === 'gmail') {
    const { getGmailMessage } = await import('../gmail/gmail-api')
    const response = await getGmailMessage(ctx.env, user, accountId, messageId)
    const body = await response.json<{ message?: unknown }>()
    return { ok: true, message: body.message || {} }
  }
  if (provider === 'qq') {
    const { getQqMailMessage } = await import('../qq-mail/qq-mail-message-api')
    const response = await getQqMailMessage(ctx.env, user, accountId, messageId)
    const body = await response.json<{ message?: unknown }>()
    return { ok: true, message: body.message || {} }
  }
  if (provider === 'microsoft') {
    const { getMicrosoftMessage } = await import('../microsoft/microsoft-message-api')
    const response = await getMicrosoftMessage(ctx.env, user, accountId, messageId)
    const body = await response.json<{ message?: unknown }>()
    return { ok: true, message: body.message || {} }
  }
  if (provider === 'naver') {
    const { getNaverMailMessage } = await import('../naver-mail/naver-mail-message-api')
    const response = await getNaverMailMessage(ctx.env, user, accountId, messageId)
    const body = await response.json<{ message?: unknown }>()
    return { ok: true, message: body.message || {} }
  }
  if (provider === 'yandex') {
    const { getYandexMailMessage } = await import('../yandex-mail/yandex-mail-message-api')
    const response = await getYandexMailMessage(ctx.env, user, accountId, messageId)
    const body = await response.json<{ message?: unknown }>()
    return { ok: true, message: body.message || {} }
  }
  if (provider === 'linuxdo') {
    const { getLinuxDoMailMessage } = await import('../linux-do-mail/linux-do-mail-api')
    const response = await getLinuxDoMailMessage(ctx.env, user, messageId)
    const body = await response.json<{ message?: unknown }>()
    return { ok: true, message: body.message || {} }
  }
  return { error: `不支持的邮箱来源：${provider}` }
}

export async function agentSendExternalMessage(
  ctx: AgentExternalContext,
  provider: string,
  accountId: string,
  input: { to?: unknown; subject?: unknown; text?: unknown; idempotencyKey?: unknown },
): Promise<{ ok: true; messageId: string } | { error: string }> {
  const userOrError = await hasExternalScope(ctx, provider, accountId, scopeForSend(provider))
  if ('error' in userOrError) return userOrError
  const user = userOrError
  if (!user.canReply) return { error: '当前账户没有发信权限。' }
  if (provider === 'qq') {
    const { sendQqMailMessage } = await import('../qq-mail/qq-mail-send-api')
    const request = new Request('http://internal', jsonBody({
      to: input.to,
      subject: input.subject,
      text: input.text,
      idempotencyKey: input.idempotencyKey,
    }))
    const response = await sendQqMailMessage(ctx.env, user, accountId, request, 'agent')
    const body = await response.json<{ message?: { id?: string } }>()
    return { ok: true, messageId: body.message?.id || '' }
  }
  if (provider === 'linuxdo') {
    const { sendLinuxDoMailMessage } = await import('../linux-do-mail/linux-do-mail-api')
    const request = new Request('http://internal', jsonBody({
      to: input.to,
      subject: input.subject,
      text: input.text,
      idempotencyKey: input.idempotencyKey,
    }))
    const response = await sendLinuxDoMailMessage(ctx.env, user, request, 'agent')
    const body = await response.json<{ message?: { id?: string } }>()
    return { ok: true, messageId: body.message?.id || '' }
  }
  return { error: `当前邮箱来源不支持发信：${provider}` }
}

export async function agentDownloadExternalAttachment(
  ctx: AgentExternalContext,
  provider: string,
  accountId: string,
  messageId: string,
  partId: string,
): Promise<{ ok: true; attachment: unknown } | { error: string }> {
  const userOrError = await hasExternalScope(ctx, provider, accountId, scopeForAttachments(provider))
  if ('error' in userOrError) return userOrError
  const user = userOrError
  if (provider === 'qq') {
    const { getQqMailAttachment } = await import('../qq-mail/qq-mail-message-api')
    const response = await getQqMailAttachment(ctx.env, user, accountId, messageId, partId)
    const body = await response.json<{ attachment?: unknown }>()
    return { ok: true, attachment: body.attachment || {} }
  }
  if (provider === 'gmail') {
    const { getGmailAttachment } = await import('../gmail/gmail-api')
    const response = await getGmailAttachment(ctx.env, user, accountId, messageId, partId)
    const body = await response.json<{ attachment?: unknown }>()
    return { ok: true, attachment: body.attachment || {} }
  }
  if (provider === 'microsoft') {
    const { getMicrosoftAttachment } = await import('../microsoft/microsoft-message-api')
    const response = await getMicrosoftAttachment(ctx.env, user, accountId, messageId, partId)
    const body = await response.json<{ attachment?: unknown }>()
    return { ok: true, attachment: body.attachment || {} }
  }
  if (provider === 'naver') {
    const { getNaverMailAttachment } = await import('../naver-mail/naver-mail-message-api')
    const response = await getNaverMailAttachment(ctx.env, user, accountId, messageId, partId)
    const body = await response.json<{ attachment?: unknown }>()
    return { ok: true, attachment: body.attachment || {} }
  }
  if (provider === 'yandex') {
    const { getYandexMailAttachment } = await import('../yandex-mail/yandex-mail-message-api')
    const response = await getYandexMailAttachment(ctx.env, user, accountId, messageId, partId)
    const body = await response.json<{ attachment?: unknown }>()
    return { ok: true, attachment: body.attachment || {} }
  }
  return { error: `当前邮箱来源不支持附件下载：${provider}` }
}
