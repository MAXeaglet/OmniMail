// Lightweight MCP protocol handler for Cloudflare Workers.
import type { Env } from '../../app/types'
import { mcpTools } from './mcp-tools'
import type { McpToolContext } from './mcp-tools'
import type { AgentIdentity } from './agent-token'

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_NAME = 'omnimail-mcp'

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  return request.json<Record<string, unknown>>().catch(() => ({}))
}

function supportedTools() {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }))
}

export async function handleMcpRequest(
  request: Request,
  env: Env,
  agentIdentity: AgentIdentity | null,
): Promise<Response> {
  if (request.method === 'GET') {
    return new Response(null, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed. Use POST or GET.' }, { status: 405 })
  }

  const body = await readJsonBody(request)
  const id = body.id ?? null
  const method = body.method

  if (method === 'initialize') {
    return Response.json(jsonRpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {}, resources: {}, prompts: {} },
      serverInfo: { name: SERVER_NAME, version: '0.1.0' },
    }))
  }

  if (method === 'notifications/initialized') {
    return new Response(null, { status: 204 })
  }

  if (method === 'tools/list') {
    return Response.json(jsonRpcResult(id, { tools: supportedTools() }))
  }

  if (method === 'tools/call') {
    if (!agentIdentity) {
      return Response.json(jsonRpcError(id, -32001, 'Agent authentication required.'))
    }
    const params = (body.params ?? {}) as { name?: unknown; arguments?: Record<string, unknown> }
    const name = params.name
    const args = (params.arguments ?? {}) as Record<string, unknown>
    const tool = mcpTools.find((t) => t.name === name)
    if (!tool) {
      return Response.json(jsonRpcError(id, -32602, `Unknown tool: ${String(name)}`))
    }
    const ctx: McpToolContext = { env, agentId: agentIdentity.agent.id }
    try {
      const result = await tool.execute(args, ctx)
      return Response.json(jsonRpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
      }))
    } catch (error) {
      return Response.json(jsonRpcResult(id, {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      }))
    }
  }

  if (method === 'resources/list') {
    return Response.json(jsonRpcResult(id, { resources: [] }))
  }

  if (method === 'prompts/list') {
    return Response.json(jsonRpcResult(id, { prompts: [] }))
  }

  return Response.json(jsonRpcError(id, -32601, `Method not found: ${String(method)}`))
}
