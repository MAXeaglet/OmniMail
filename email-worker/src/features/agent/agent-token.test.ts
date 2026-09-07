import { describe, expect, it } from 'vitest'
import { validAgentAccessToken, validAgentApiKey } from './agent-token'

describe('agent credential validators', () => {
  it('accepts well-formed access tokens', () => {
    expect(validAgentAccessToken('om_agent_at_' + 'a'.repeat(32))).toBe(true)
    expect(validAgentAccessToken('om_agent_at_short')).toBe(false)
    expect(validAgentAccessToken('om_at_abc')).toBe(false)
  })

  it('accepts well-formed API keys', () => {
    expect(validAgentApiKey('om_ak_' + 'b'.repeat(32))).toBe(true)
    expect(validAgentApiKey('om_ak_short')).toBe(false)
    expect(validAgentApiKey('')).toBe(false)
  })
})
