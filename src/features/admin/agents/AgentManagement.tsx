import { Bot, Plus, KeyRound, Trash2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
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

function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  const [error, setError] = useState('')

  async function loadAgents() {
    try {
      const data = await apiFetch<{ agents: AgentItem[] }>('/api/v1/agents')
      setAgents(data.agents)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Agent 失败')
    }
  }

  useEffect(() => {
    void loadAgents()
  }, [])

  async function createAgent() {
    if (!name.trim()) return
    setError('')
    await apiFetch('/api/v1/agents', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: description.trim() }),
    })
    setName('')
    setDescription('')
    await loadAgents()
  }

  async function createApiKey(agentId: string) {
    setError('')
    const data = await apiFetch<{ apiKey: string }>(`/api/v1/agents/${agentId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({ name: 'mcp' }),
    })
    setKeyByAgent((prev) => ({ ...prev, [agentId]: data }))
  }

  async function loadGrants(agentId: string) {
    const data = await apiFetch<{ grants: GrantItem[] }>(`/api/v1/agents/${agentId}/grants`)
    setGrants((prev) => ({ ...prev, [agentId]: data.grants }))
  }

  async function addGrant(agentId: string) {
    const resourceId = prompt('邮箱地址或外部账号 ID：')
    if (!resourceId) return
    const resourceType = prompt('资源类型 (mailbox/external_account/user)：') || 'mailbox'
    const scope = prompt('Scope（逗号分隔，如 messages:read,messages:send）：') || 'messages:read'
    const trigger = window.confirm('启用触发？')
    await apiFetch(`/api/v1/agents/${agentId}/grants`, {
      method: 'POST',
      body: JSON.stringify({
        resourceType,
        resourceId,
        scope: scope.split(',').map((s) => s.trim()).join(' '),
        triggerEnabled: trigger,
      }),
    })
    await loadGrants(agentId)
  }

  async function revokeApiKey(agentId: string, keyId: string) {
    await apiFetch(`/api/v1/agents/${agentId}/api-keys/${keyId}/revoke`, {
      method: 'POST',
    })
  }

  async function removeGrant(agentId: string, grantId: string) {
    await apiFetch(`/api/v1/agents/${agentId}/grants/${grantId}`, {
      method: 'DELETE',
    })
    await loadGrants(agentId)
  }

  return (
    <div className="admin-agent-management">
      <div className="admin-page-header">
        <h2>{t('Agent 管理')}</h2>
      </div>
      {error && <p className="admin-error">{error}</p>}
      <div className="agent-create">
        <input
          placeholder={t('Agent 名称')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder={t('描述（可选）')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="button" onClick={() => void createAgent()}>
          <Plus size={16} /> {t('创建 Agent')}
        </button>
      </div>
      <div className="agent-list">
        {agents.map((agent) => (
          <div className="agent-card" key={agent.id}>
            <div className="agent-card-header">
              <Bot size={18} />
              <strong>{agent.name}</strong>
              <span className="agent-status">{agent.status}</span>
            </div>
            <p>{agent.description}</p>
            <div className="agent-actions">
              <button type="button" onClick={() => void createApiKey(agent.id)}>
                <KeyRound size={14} /> {t('生成 API Key')}
              </button>
              <button type="button" onClick={() => void loadGrants(agent.id)}>
                <ShieldCheck size={14} /> {t('查看授权')}
              </button>
              <button type="button" onClick={() => void addGrant(agent.id)}>
                <Plus size={14} /> {t('添加授权')}
              </button>
            </div>
            {keyByAgent[agent.id] && (
              <pre className="api-key-preview">
                {t('API Key（仅显示一次）：')}
                {keyByAgent[agent.id].apiKey}
              </pre>
            )}
            {grants[agent.id] && (
              <ul className="grant-list">
                {grants[agent.id].map((grant) => (
                  <li key={grant.id}>
                    <span>{grant.resourceType}: {grant.resourceId}</span>
                    <span>{grant.scopes.join(' ')}</span>
                    <span>{grant.triggerEnabled ? t('触发') : t('拉取')}</span>
                    <button type="button" onClick={() => void removeGrant(agent.id, grant.id)}>
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
