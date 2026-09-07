import type { Env, SessionUser } from './types'
import type { AgentIdentity } from '../features/agent/agent-token'

export type AppContext = {
  Bindings: Env
  Variables: {
    user: SessionUser
    authKind: 'cookie' | 'bearer' | 'agent'
    deviceSessionId?: string
    agent?: AgentIdentity
  }
}
