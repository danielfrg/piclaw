import { homedir } from "node:os"
import { join } from "node:path"

import { createApp } from "@/app"
import { loadPersistedSessions } from "@/session/store"
import { log } from "@/util/log"

const app = createApp()

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent")
log.info({ agentDir }, "server.config")

// Load persisted sessions from disk (lazy hydration on first access)
loadPersistedSessions().catch((error) => {
  log.error({ error }, "sessions.persisted.load_failed")
})

export default {
  port: 3000,
  fetch: app.fetch,
}
