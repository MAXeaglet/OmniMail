
// Agent mail operations: list/read/search/send/create mailbox.
import type { Env, SessionUser, StoredBody } from '../../app/types'
import { normalizeEmail, safeJsonArray, validEmail } from '../../shared/http/api-helpers'
import type { AgentGrantRow } from './agent-types'
import {
  hasGrantForMailbox,
  grantScopesForMailbox,
} from './agent-auth'

export interface AgentMailContext {
  env: Env
  agentId: string
  grants: AgentGrantRow[]
}

async function loadUserForMailbox(
  env: Env,
  userId: string,
): Promise<SessionUser | null> {
  const row = await env.DB.prepare(
    `SELECT id, email, display_name, role, status, mailbox_limit,
            storage_quota_bytes, storage_used_bytes, can_create_mailboxes,
            can_reply, can_translate, temporary_expires_at
       FROM users WHERE id = ?`,
  ).bind(userId).first<{
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

async function requireMailboxScope(
  ctx: AgentMailContext,
  mailboxAddress: string,
  required: string,
): Promise<{ user: SessionUser; address: string } | { error: string }> {
  const address = normalizeEmail(mailboxAddress)
  const mailbox = await ctx.env.DB.prepare(
    `SELECT address, user_id, is_active, is_hidden FROM mailboxes WHERE address = ?`,
  ).bind(address).first<{
    address: string
    user_id: string
    is_active: number
    is_hidden: number
  }>()
  if (!mailbox || mailbox.is_active !== 1 || mailbox.is_hidden !== 0) {
    return { error: '邮箱不存在或已停用。' }
  }
  if (!await hasGrantForMailbox(ctx.env.DB, ctx.grants, mailbox.address)) {
    return { error: 'Agent 无权访问此邮箱。' }
  }
  const scopes = grantScopesForMailbox(ctx.grants, mailbox.address, mailbox.user_id)
  if (!scopes.has(required)) {
    return { error: 'Agent 没有执行此操作的权限。' }
  }
  const user = await loadUserForMailbox(ctx.env, mailbox.user_id)
  if (!user) return { error: '邮箱所属用户不可用。' }
  return { user, address: mailbox.address }
}

export async function agentListMailboxMessages(
  ctx: AgentMailContext,
  mailboxAddress: string,
  folder: string,
  limit: number,
  cursor: number | null,
): Promise<{ ok: true; messages: unknown[]; nextCursor?: number } | { error: string }> {
  const scoped = await requireMailboxScope(ctx, mailboxAddress, 'messages:read')
  if ('error' in scoped) return { error: scoped.error }
  const conditions = ['m.mailbox_address = ?', 'm.folder = ?']
  const bindings: unknown[] = [scoped.address, folder]
  if (cursor !== null) {
    conditions.push('COALESCE(m.received_at, m.sent_at, m.created_at) < ?')
    bindings.push(cursor)
  }
  bindings.push(limit)
  const rows = await ctx.env.DB.prepare(
    `SELECT m.id, m.mailbox_address, m.direction, m.status, m.folder,
            m.sender_name, m.sender_address, m.delivered_to, m.recipients_json,
            m.subject, m.preview, m.received_at, m.sent_at, m.attachment_count,
            m.is_read, m.is_starred, m.processing_error, m.delivery_status,
            m.purge_after, m.created_at
       FROM messages m
      WHERE ${conditions.join(' AND ')}
      ORDER BY COALESCE(m.received_at, m.sent_at, m.created_at) DESC, m.id DESC
      LIMIT ?`,
  ).bind(...bindings).all<Record<string, unknown>>()
  const messages = rows.results.map((row) => ({
    id: row.id,
    mailboxAddress: row.delivered_to || row.mailbox_address,
    direction: row.direction,
    status: row.status,
    folder: row.folder,
    senderName: row.sender_name || '',
    senderAddress: row.sender_address,
    recipients: safeJsonArray(String(row.recipients_json)),
    subject: row.subject || '无主题',
    preview: row.preview,
    date: (Number(row.received_at ?? row.sent_at ?? row.created_at)) * 1000,
    attachmentCount: Number(row.attachment_count),
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
  }))
  const last = rows.results[rows.results.length - 1]
  const nextCursor = rows.results.length === limit && last
    ? Number(last.received_at ?? last.sent_at ?? last.created_at)
    : null
  return { ok: true, messages, nextCursor: nextCursor ?? undefined }
}

export async function agentReadMailboxMessage(
  ctx: AgentMailContext,
  mailboxAddress: string,
  messageId: string,
): Promise<{ ok: true; message: unknown; thread: unknown[] } | { error: string }> {
  const scoped = await requireMailboxScope(ctx, mailboxAddress, 'messages:read')
  if ('error' in scoped) return { error: scoped.error }
  const message = await ctx.env.DB.prepare(
    `SELECT m.* FROM messages m WHERE m.id = ? AND m.mailbox_address = ?`,
  ).bind(messageId, scoped.address).first<Record<string, unknown>>()
  if (!message) return { error: '邮件不存在。' }
  let body: StoredBody = { text: '', html: '' }
  if (message.body_key) {
    const object = await ctx.env.MAIL_BUCKET.get(String(message.body_key))
    if (object) body = await object.json<StoredBody>()
  }
  const attachments = await ctx.env.DB.prepare(
    `SELECT id, message_id, filename, content_type, size, r2_key, content_id, disposition
       FROM attachments WHERE message_id = ? ORDER BY id`,
  ).bind(messageId).all<Record<string, unknown>>()
  return {
    ok: true,
    message: {
      id: message.id,
      mailboxAddress: message.delivered_to || message.mailbox_address,
      direction: message.direction,
      status: message.status,
      folder: message.folder,
      senderName: message.sender_name || '',
      senderAddress: message.sender_address,
      recipients: safeJsonArray(String(message.recipients_json)),
      cc: safeJsonArray(String(message.cc_json)),
      subject: message.subject || '无主题',
      date: (Number(message.received_at ?? message.sent_at ?? message.created_at)) * 1000,
      text: body.text,
      html: body.html,
      attachments: attachments.results.map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        size: a.size,
        contentId: a.content_id,
        disposition: a.disposition,
      })),
    },
    thread: [],
  }
}

export async function agentSearchMailboxMessages(
  ctx: AgentMailContext,
  mailboxAddress: string,
  query: string,
  limit: number,
): Promise<{ ok: true; messages: unknown[] } | { error: string }> {
  const scoped = await requireMailboxScope(ctx, mailboxAddress, 'messages:search')
  if ('error' in scoped) return { error: scoped.error }
  const like = `%${query}%`
  const rows = await ctx.env.DB.prepare(
    `SELECT m.id, m.mailbox_address, m.direction, m.status, m.folder,
            m.sender_name, m.sender_address, m.recipients_json, m.subject,
            m.preview, m.received_at, m.sent_at, m.attachment_count,
            m.is_read, m.is_starred
       FROM messages m
      WHERE m.mailbox_address = ?
        AND (m.subject LIKE ? OR m.sender_address LIKE ? OR m.preview LIKE ?)
      ORDER BY COALESCE(m.received_at, m.sent_at, m.created_at) DESC, m.id DESC
      LIMIT ?`,
  ).bind(scoped.address, like, like, like, limit).all<Record<string, unknown>>()
  return {
    ok: true,
    messages: rows.results.map((row) => ({
      id: row.id,
      mailboxAddress: row.mailbox_address,
      senderName: row.sender_name || '',
      senderAddress: row.sender_address,
      subject: row.subject || '无主题',
      preview: row.preview,
      date: (Number(row.received_at ?? row.sent_at ?? row.created_at)) * 1000,
      isRead: Boolean(row.is_read),
    })),
  }
}

export async function agentSendMailboxMessage(
  ctx: AgentMailContext,
  mailboxAddress: string,
  input: {
    to?: unknown
    subject?: unknown
    text?: unknown
    idempotencyKey?: unknown
  },
): Promise<{ ok: true; messageId: string } | { error: string }> {
  const scoped = await requireMailboxScope(ctx, mailboxAddress, 'messages:send')
  if ('error' in scoped) return { error: scoped.error }
  const user = scoped.user
  if (!user.canReply) return { error: '当前账户没有发信权限。' }
  const to = typeof input.to === 'string' ? input.to : ''
  const recipients = [...new Set(to.split(/[;,]/).map(normalizeEmail).filter(Boolean))]
  const subject = typeof input.subject === 'string' ? input.subject.trim() : ''
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  const idempotencyKey = typeof input.idempotencyKey === 'string' ? input.idempotencyKey : ''
  if (!recipients.length || recipients.some((r) => !validEmail(r))) return { error: '请输入有效的收件邮箱地址。' }
  if (!subject || subject.length > 500 || /[\r\n]/.test(subject)) return { error: '邮件主题需要在 1–500 个字符之间。' }
  if (!text || text.length > 50_000) return { error: '邮件正文需要在 1–50,000 个字符之间。' }

  const { sendOutboundMessage } = await import('../outbound/outbound-message')
  const response = await sendOutboundMessage(ctx.env, user, {
    mailboxAddress: scoped.address,
    recipients,
    subject,
    text,
    idempotencyKey,
    auditAction: 'message.send',
    auditDetail: { via: 'agent', agentId: ctx.agentId },
  }, 'agent')
  const body = await response.json<{ message?: { id?: string } }>().catch(() => ({} as {
    message?: { id?: string }
  }))
  return { ok: true, messageId: body.message?.id || '' }
}

export async function agentCreateMailbox(
  ctx: AgentMailContext,
  domain: string,
  localPart: string,
): Promise<{ ok: true; address: string } | { error: string }> {
  // Creating a mailbox requires a user-level grant that covers the domain owner.
  const address = `${localPart.toLowerCase()}@${domain.toLowerCase()}`
  if (!validEmail(address)) return { error: '邮箱地址无效。' }
  const domainRow = await ctx.env.DB.prepare(
    `SELECT d.name FROM domains d WHERE d.name = ? AND d.is_active = 1`,
  ).bind(domain.toLowerCase()).first<{ name: string }>()
  if (!domainRow) return { error: '域名不存在或未启用。' }

  const userGrant = ctx.grants.find((g) => g.resource_type === 'user')
  if (!userGrant) return { error: '只有拥有用户级授权的 Agent 才能创建邮箱。' }
  const scopes = userGrant.scope.split(/\s+/)
  if (!scopes.includes('mailboxes:create')) return { error: 'Agent 没有创建邮箱的权限。' }

  const owner = await ctx.env.DB.prepare(
    `SELECT u.id FROM users u WHERE u.id = ? AND u.status = 'active'`,
  ).bind(userGrant.resource_id).first<{ id: string }>()
  if (!owner) return { error: '用户不存在或不可用。' }
  const userRow = await ctx.env.DB.prepare(
    `SELECT can_create_mailboxes FROM users WHERE id = ?`,
  ).bind(owner.id).first<{ can_create_mailboxes: number }>()
  if (!userRow || !userRow.can_create_mailboxes) return { error: '用户没有创建邮箱的权限。' }

  await ctx.env.DB.prepare(
    `INSERT OR IGNORE INTO mailboxes (address, user_id, is_primary, is_active, is_hidden)
     VALUES (?, ?, 0, 1, 0)`,
  ).bind(address, owner.id).run()
  return { ok: true, address }
}
