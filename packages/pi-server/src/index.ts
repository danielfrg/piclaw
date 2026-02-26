import { homedir } from "node:os"
import { join } from "node:path"

import { createApp } from "@/app"
import { log } from "@/util/log"

const app = createApp()

const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent")
log.info(
  {
    agentDir,
  },
  "server.config",
)

export default {
  port: 3000,
  fetch: app.fetch,
}
