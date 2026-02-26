import { homedir } from "node:os"
import { join } from "node:path"

import {
  SessionManager,
  SettingsManager,
  createAgentSession,
  createCodingTools,
  type AgentSession,
} from "@mariozechner/pi-coding-agent"

export async function createSessionRuntime(cwd: string): Promise<AgentSession> {
  const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent")
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
