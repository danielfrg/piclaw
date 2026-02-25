import {
  SessionManager,
  SettingsManager,
  createAgentSession,
  createCodingTools,
  type AgentSession,
} from "@mariozechner/pi-coding-agent"

export async function createSessionRuntime(cwd: string): Promise<AgentSession> {
  const sessionManager = SessionManager.create(cwd)
  const settingsManager = SettingsManager.inMemory()

  const { session } = await createAgentSession({
    cwd,
    tools: createCodingTools(cwd),
    sessionManager,
    settingsManager,
  })

  return session
}
