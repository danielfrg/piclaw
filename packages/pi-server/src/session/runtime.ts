import { homedir } from "node:os"
import { join } from "node:path"

import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createAgentSession,
  createCodingTools,
  type AgentSession,
} from "@mariozechner/pi-coding-agent"

function getAgentDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent")
}

let _modelRegistry: ModelRegistry | undefined

/**
 * Get or create the global model registry.
 * Initialized once from the agent config directory (~/.pi/agent/).
 */
export function getGlobalModelRegistry(): ModelRegistry {
  if (!_modelRegistry) {
    const agentDir = getAgentDir()
    const authStorage = new AuthStorage(join(agentDir, "auth.json"))
    _modelRegistry = new ModelRegistry(authStorage, join(agentDir, "models.json"))
  }
  return _modelRegistry
}

export async function createSessionRuntime(cwd: string): Promise<AgentSession> {
  const agentDir = getAgentDir()
  const sessionManager = SessionManager.create(cwd)
  const settingsManager = SettingsManager.create(cwd, agentDir)

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    tools: createCodingTools(cwd),
    sessionManager,
    settingsManager,
  })

  return session
}
