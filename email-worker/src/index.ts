import { fetchApi } from './app/api'
import { cleanup } from './platform/scheduling/cleanup'
import { consumeEmailQueue, receiveEmail } from './app/handlers/mail'
import { handleMcpRequest } from './features/agent/mcp-server'
import {
  authenticateAgentAccessToken,
  exchangeAgentApiKey,
} from './features/agent/agent-token'
import type { AgentIdentity } from './features/agent/agent-token'
import type { Env, MailQueueJob } from './app/types'

export { OmniMailBackupWorkflow } from './features/backups/backup'
export { OmniMailCleanupWorkflow } from './platform/scheduling/cleanup-workflow'

async function resolveMcpIdentity(request: Request, env: Env): Promise<AgentIdentity | null> {
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') || '')?.[1]
  if (bearer) {
    return authenticateAgentAccessToken(env.DB, bearer)
  }
  const apiKey = request.headers.get('X-OmniMail-Api-Key')
  if (apiKey) {
    const exchanged = await exchangeAgentApiKey(env.DB, apiKey)
    if (exchanged) {
      return authenticateAgentAccessToken(env.DB, exchanged.accessToken)
    }
  }
  return null
}

async function fetchRequest(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === '/mcp') {
    const identity = await resolveMcpIdentity(request, env)
    return handleMcpRequest(request, env, identity)
  }
  return path === '/api' || path.startsWith('/api/')
    ? fetchApi(request, env, context)
    : env.ASSETS.fetch(request)
}

export default {
  fetch: fetchRequest,
  email: receiveEmail,
  queue: consumeEmailQueue,
  scheduled: (_controller, env) => cleanup(env),
} satisfies ExportedHandler<Env, MailQueueJob>
