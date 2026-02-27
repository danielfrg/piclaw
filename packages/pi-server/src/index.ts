import { homedir } from "node:os"
import { join } from "node:path"

import { createApp } from "@/app"
import { seedSession } from "@/session/seed"
import { registerSession } from "@/session/store"
import { log } from "@/util/log"

const app = createApp()

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent")
log.info(
  {
    agentDir,
  },
  "server.config",
)

const isDev = process.env.NODE_ENV !== "production"
if (isDev) {
  const record = seedSession()
  registerSession(record)
  log.info({ sessionID: record.info.id }, "seed.session.registered")
}

export default {
  port: 3000,
  fetch: app.fetch,
}
