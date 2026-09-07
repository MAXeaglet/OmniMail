import { describe, expect, it } from 'vitest'
import { handleMcpRequest } from './mcp-server'
import type { Env } from '../../app/types'

function mockEnv(): Env {
  return { DB: {} as never, MAIL_BUCKET: {} as never, MAIL_QUEUE: {} as never, ASSETS: {} as never }
}

describe('MCP protocol', () => {
  it('answers initialize', async () => {
    const response = await handleMcpRequest(
      new Request('http://internal/mcp', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      }),
      mockEnv(),
      null,
    )
    expect(response.status).toBe(200)
    const body = await response.json<{ result: { serverInfo: { name: string } } }>()
    expect(body.result.serverInfo.name).toBe('omnimail-mcp')
  })

  it('lists tools without authentication', async () => {
    const response = await handleMcpRequest(
      new Request('http://internal/mcp', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      }),
      mockEnv(),
      null,
    )
    const body = await response.json<{ result: { tools: unknown[] } }>()
    expect(body.result.tools.length).toBeGreaterThan(10)
  })

  it('rejects tools/call without auth', async () => {
    const response = await handleMcpRequest(
      new Request('http://internal/mcp', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'agent_info', arguments: {} },
        }),
      }),
      mockEnv(),
      null,
    )
    const body = await response.json<{ error: { code: number } }>()
    expect(body.error.code).toBe(-32001)
  })

  it('lists skill resources', async () => {
    const response = await handleMcpRequest(
      new Request('http://internal/mcp', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'resources/list' }),
      }),
      mockEnv(),
      null,
    )
    const body = await response.json<{ result: { resources: unknown[] } }>()
    expect(body.result.resources.length).toBeGreaterThan(0)
  })
})
