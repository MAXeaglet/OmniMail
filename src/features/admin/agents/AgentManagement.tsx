
import {
  Bot,
  Copy,
  KeyRound,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import './AgentManagement.css'
import { t } from '../../../shared/i18n'
import type { User } from '../../../shared/api'

interface AgentItem {
  id: string
  name: string
  description: string
  status: string
  ownerUserId: string | null
}

interface GrantItem {
  id: string
  resourceType: string
  resourceId: string
  provider: string
  includeExternal: boolean
  scopes: string[]
  triggerEnabled: boolean
}

async function agentFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  }).then(async (response) => {
    if (!response.ok) throw new Error(await response.text())
    return response.json() as Promise<T>
  })
}

export function AgentManagement({ currentUser }: { currentUser: User }) {
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keyByAgent, setKeyByAgent] = useState<Record<string, { apiKey: string }>>({})
  const [grants, setGrants] = useState<Record<string, GrantItem[]>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void loadAgents()
  }, [])

  useEffect(() => {
    if (!error && !notice) return
    const timer = window.setTimeout(() => {
      setError('')
      setNotice('')
    }, error ? 5200 : 3200)
    return () => window.clearTimeout(timer)
  }, [error, notice])

  async function loadAgents() {
    try {
      const data = await agentFetch<{ agents: AgentItem[] }>('/api/v1/agents')
      setAgents(data.agents)
    } catch (err) {
      setError(t(err instanceof Error ? err.message : '加载 Agent 失败'))
    }
  }

  async function run(key: string, action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
      return true
    } catch (err) {
      setError(t(err instanceof Error ? err.message : 'Agent 操作失败。'))
      return false
    } finally {
      setBusy('')
    }
  }

  async function createAgent() {
    if (!name.trim()) return
    await run('create-agent', async () => {
      await agentFetch('/api/v1/agents', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      setName('')
      setDescription('')
      await loadAgents()
    }, t('Agent 已创建。'))
  }

  async function createApiKey(agentId: string) {
    await run(`key:${agentId}`, async () => {
      const data = await agentFetch<{ apiKey: string }>(`/api/v1/agents/${agentId}/api-keys`, {
        method: 'POST',
        body: JSON.stringify({ name: 'mcp' }),
      })
      setKeyByAgent((prev) => ({ ...prev, [agentId]: data }))
    }, t('API Key 已生成。'))
  }

  async function loadGrants(agentId: string) {
    const data = await agentFetch<{ grants: GrantItem[] }>(`/api/v1/agents/${agentId}/grants`)
    setGrants((prev) => ({ ...prev, [agentId]: data.grants }))
  }

  async function addGrant(agentId: string) {
    const resourceId = window.prompt(t('邮箱地址或外部账号 ID：'))
    if (!resourceId) return
    const resourceType = window.prompt(t('资源类型 (mailbox/external_account/user)：')) || 'mailbox'
    const scope = window.prompt(t('Scope（逗号分隔，如 messages:read,messages:send）：')) || 'messages:read'
    const trigger = window.confirm(t('启用触发？'))
    await run(`grant:${agentId}`, async () => {
      await agentFetch(`/api/v1/agents/${agentId}/grants`, {
        method: 'POST',
        body: JSON.stringify({
          resourceType,
          resourceId,
          scope: scope.split(',').map((item) => item.trim()).join(' '),
          triggerEnabled: trigger,
        }),
      })
      await loadGrants(agentId)
    }, t('授权已添加。'))
  }

  async function removeGrant(agentId: string, grantId: string) {
    await run(`revoke:${grantId}`, async () => {
      await agentFetch(`/api/v1/agents/${agentId}/grants/${grantId}`, {
        method: 'DELETE',
      })
      await loadGrants(agentId)
    }, t('授权已撤销。'))
  }

  return (
    <section className="admin-card domain-management-card agent-management-card">
      <header>
        <Bot size={17} />
        <div>
          <h2>{t('Agent 管理')}</h2>
          <p>{t('创建 Agent、管理 API Key 与邮箱授权')}</p>
        </div>
      </header>

      <form
        className="agent-create-form"
        onSubmit={(event) => {
          event.preventDefault()
          void createAgent()
        }}
      >
        <label htmlFor="agent-name">{t('Agent 名称')}</label>
        <div className="agent-create-row">
          <div className="agent-create-input">
            <Bot size={17} />
            <input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('例如：邮箱助手')}
              autoComplete="off"
              required
            />
          </div>
          <input
            className="agent-description-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('描述（可选）')}
            autoComplete="off"
          />
          <button
            className="button button--primary button--small"
            disabled={Boolean(busy) || !name.trim()}
            type="submit"
          >
            {busy === 'create-agent' ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
            {t('创建 Agent')}
          </button>
        </div>
      </form>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}

      <div className="agent-list">
        {agents.length === 0 && (
          <p className="agent-empty">{t('还没有 Agent，先去创建一个吧。')}</p>
        )}
        {agents.map((agent) => (
          <div className="agent-card" key={agent.id}>
            <div className="agent-card__main">
              <div className="agent-card__icon">
                <Bot size={18} />
              </div>
              <div className="agent-card__identity">
                <strong>{agent.name}</strong>
                <small>{agent.description || `${agent.id.slice(0, 8)}…`}</small>
              </div>
              <span className={`agent-state ${agent.status === 'active' ? 'is-active' : ''}`}>
                {agent.status === 'active' ? t('运行中') : t('已停用')}
              </span>
            </div>

            <div className="agent-card__actions">
              <button
                className="button button--ghost button--small"
                type="button"
                disabled={busy.startsWith(`key:${agent.id}`)}
                onClick={() => void createApiKey(agent.id)}
              >
                {busy.startsWith(`key:${agent.id}`)
                  ? <LoaderCircle className="spin" size={14} />
                  : <KeyRound size={14} />}
                {t('生成 API Key')}
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => void loadGrants(agent.id)}
              >
                <ShieldCheck size={14} />
                {t('查看授权')}
              </button>
              <button
                className="button button--ghost button--small"
                type="button"
                onClick={() => void addGrant(agent.id)}
              >
                <Plus size={14} />
                {t('添加授权')}
              </button>
            </div>

            {keyByAgent[agent.id] && (
              <div className="agent-api-key">
                <span>{t('API Key（仅显示一次）：')}</span>
                <code>{keyByAgent[agent.id].apiKey}</code>
                <button
                  className="agent-copy-button"
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(keyByAgent[agent.id].apiKey)}
                >
                  <Copy size={12} />
                </button>
                <button
                  className="agent-dismiss-button"
                  type="button"
                  onClick={() => setKeyByAgent((prev) => ({ ...prev, [agent.id]: undefined as never }))}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {grants[agent.id] && (
              <ul className="agent-grant-list">
                {grants[agent.id].map((grant) => (
                  <li key={grant.id}>
                    <span className="agent-grant-type">{grant.resourceType}</span>
                    <span className="agent-grant-target">{grant.resourceId}</span>
                    <span className="agent-grant-mode">
                      {grant.triggerEnabled ? t('触发') : t('拉取')}
                    </span>
                    <button
                      className="agent-grant-remove"
                      type="button"
                      onClick={() => void removeGrant(agent.id, grant.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
