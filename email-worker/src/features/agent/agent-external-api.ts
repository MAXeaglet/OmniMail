// Agent external account helpers.
import type { D1Database } from '@cloudflare/workers-types'
import type { AgentGrantRow } from './agent-types'

export interface ExternalAccountSummary {
  provider: string
  accountId: string
  email: string
  name: string
}

export async function listExternalAccountsForUser(
  db: D1Database,
  userId: string,
): Promise<ExternalAccountSummary[]> {
  const results: ExternalAccountSummary[] = []
  const gmail = await db.prepare(
    'SELECT id, email, name FROM gmail_imap_accounts WHERE user_id = ?',
  ).bind(userId).all<{ id: string; email: string; name: string }>()
  for (const row of gmail.results) {
    results.push({ provider: 'gmail', accountId: row.id, email: row.email, name: row.name })
  }

  const qq = await db.prepare(
    'SELECT id, email, name FROM qq_mail_accounts WHERE user_id = ?',
  ).bind(userId).all<{ id: string; email: string; name: string }>()
  for (const row of qq.results) {
    results.push({ provider: 'qq', accountId: row.id, email: row.email, name: row.name })
  }

  const microsoft = await db.prepare(
    'SELECT id, normalized_email AS email, name FROM microsoft_imap_accounts WHERE user_id = ?',
  ).bind(userId).all<{ id: string; email: string; name: string }>()
  for (const row of microsoft.results) {
    results.push({ provider: 'microsoft', accountId: row.id, email: row.email, name: row.name })
  }

  const naver = await db.prepare(
    'SELECT id, email, name FROM naver_mail_accounts WHERE user_id = ?',
  ).bind(userId).all<{ id: string; email: string; name: string }>()
  for (const row of naver.results) {
    results.push({ provider: 'naver', accountId: row.id, email: row.email, name: row.name })
  }

  const yandex = await db.prepare(
    'SELECT id, email, name FROM yandex_mail_accounts WHERE user_id = ?',
  ).bind(userId).all<{ id: string; email: string; name: string }>()
  for (const row of yandex.results) {
    results.push({ provider: 'yandex', accountId: row.id, email: row.email, name: row.name })
  }

  const linuxdo = await db.prepare(
    'SELECT id, username AS email, username AS name FROM linux_do_mail_accounts WHERE user_id = ?',
  ).bind(userId).all<{ id: string; email: string; name: string }>()
  for (const row of linuxdo.results) {
    results.push({ provider: 'linuxdo', accountId: row.id, email: row.email, name: row.name })
  }

  const icloud = await db.prepare(
    'SELECT id, real_email AS email, name FROM icloud_accounts WHERE user_id = ?',
  ).bind(userId).all<{ id: string; email: string; name: string }>()
  for (const row of icloud.results) {
    results.push({ provider: 'icloud', accountId: row.id, email: row.email, name: row.name })
  }

  return results
}

export async function listExternalAccountsForAgent(
  db: D1Database,
  grants: AgentGrantRow[],
): Promise<ExternalAccountSummary[]> {
  const out: ExternalAccountSummary[] = []
  const seen = new Set<string>()

  for (const grant of grants) {
    if (grant.resource_type === 'external_account') {
      const provider = grant.provider
      const accountId = grant.resource_id
      const key = `${provider}:${accountId}`
      if (seen.has(key)) continue
      seen.add(key)
      const account = await findExternalAccount(db, provider, accountId)
      if (account) out.push(account)
    }
  }

  for (const grant of grants) {
    if (grant.resource_type === 'user' && grant.include_external === 1) {
      const accounts = await listExternalAccountsForUser(db, grant.resource_id)
      for (const account of accounts) {
        const key = `${account.provider}:${account.accountId}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(account)
      }
    }
  }

  return out
}

export async function findExternalAccount(
  db: D1Database,
  provider: string,
  accountId: string,
): Promise<ExternalAccountSummary | null> {
  if (provider === 'gmail') {
    const row = await db.prepare(
      'SELECT id, email, name FROM gmail_imap_accounts WHERE id = ?',
    ).bind(accountId).first<{ id: string; email: string; name: string }>()
    return row ? { provider, accountId: row.id, email: row.email, name: row.name } : null
  }
  if (provider === 'qq') {
    const row = await db.prepare(
      'SELECT id, email, name FROM qq_mail_accounts WHERE id = ?',
    ).bind(accountId).first<{ id: string; email: string; name: string }>()
    return row ? { provider, accountId: row.id, email: row.email, name: row.name } : null
  }
  if (provider === 'microsoft') {
    const row = await db.prepare(
      'SELECT id, normalized_email AS email, name FROM microsoft_imap_accounts WHERE id = ?',
    ).bind(accountId).first<{ id: string; email: string; name: string }>()
    return row ? { provider, accountId: row.id, email: row.email, name: row.name } : null
  }
  if (provider === 'naver') {
    const row = await db.prepare(
      'SELECT id, email, name FROM naver_mail_accounts WHERE id = ?',
    ).bind(accountId).first<{ id: string; email: string; name: string }>()
    return row ? { provider, accountId: row.id, email: row.email, name: row.name } : null
  }
  if (provider === 'yandex') {
    const row = await db.prepare(
      'SELECT id, email, name FROM yandex_mail_accounts WHERE id = ?',
    ).bind(accountId).first<{ id: string; email: string; name: string }>()
    return row ? { provider, accountId: row.id, email: row.email, name: row.name } : null
  }
  if (provider === 'linuxdo') {
    const row = await db.prepare(
      'SELECT id, username AS email, username AS name FROM linux_do_mail_accounts WHERE id = ?',
    ).bind(accountId).first<{ id: string; email: string; name: string }>()
    return row ? { provider, accountId: row.id, email: row.email, name: row.name } : null
  }
  if (provider === 'icloud') {
    const row = await db.prepare(
      'SELECT id, real_email AS email, name FROM icloud_accounts WHERE id = ?',
    ).bind(accountId).first<{ id: string; email: string; name: string }>()
    return row ? { provider, accountId: row.id, email: row.email, name: row.name } : null
  }
  return null
}
