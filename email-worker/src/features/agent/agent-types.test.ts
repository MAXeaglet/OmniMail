import { describe, expect, it } from 'vitest'
import { expandAgentScope, agentScopeAllows } from './agent-types'

describe('agent scope expansion', () => {
  it('expands full scope to all known capabilities', () => {
    const scopes = expandAgentScope('full')
    expect(scopes).toContain('messages:read')
    expect(scopes).toContain('messages:send')
    expect(scopes).toContain('mailboxes:create')
    expect(scopes).toContain('qq-mail:messages:send')
  })

  it('keeps explicit scopes as-is', () => {
    expect(expandAgentScope('messages:read messages:send')).toEqual([
      'messages:read',
      'messages:send',
    ])
  })

  it('checks required scope', () => {
    expect(agentScopeAllows('messages:read', 'messages:read')).toBe(true)
    expect(agentScopeAllows('messages:read', 'messages:send')).toBe(false)
    expect(agentScopeAllows('full', 'gmail:messages:read')).toBe(true)
  })
})
