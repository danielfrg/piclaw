import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createClient } from "@piclaw/sdk"

import { createApp } from "@/app"

function buildSessionDir(agentDir: string, cwd: string): string {
  const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`
  return join(agentDir, "sessions", safePath)
}

describe("session create", () => {
  let tempRoot = ""
  let agentDir = ""
  let projectDir = ""
  let originalCwd = ""
  let originalAgentDir: string | undefined

  beforeEach(() => {
    originalCwd = process.cwd()
    originalAgentDir = process.env.PI_CODING_AGENT_DIR

    tempRoot = join(tmpdir(), `pi-server-test-${Date.now()}`)
    agentDir = join(tempRoot, "agent")
    projectDir = join(tempRoot, "project")

    mkdirSync(agentDir, { recursive: true })
    mkdirSync(projectDir, { recursive: true })

    process.env.PI_CODING_AGENT_DIR = agentDir
    process.chdir(projectDir)
    projectDir = process.cwd()
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (originalAgentDir) {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir
    } else {
      delete process.env.PI_CODING_AGENT_DIR
    }
    if (tempRoot && existsSync(tempRoot)) {
      rmSync(tempRoot, { recursive: true })
    }
  })

  it("creates a session file on creation", async () => {
    const app = createApp()
    const client = createClient({
      baseUrl: "http://localhost",
      fetch: ((input: string | Request, init?: RequestInit) => app.request(input, init)) as typeof fetch,
    })

    const response = await client.session.create()
    const session = response.data as { id: string }
    expect(response.error).toBeUndefined()
    expect(session.id.startsWith("ses_")).toBe(true)

    const sessionDir = buildSessionDir(agentDir, process.cwd())
    expect(existsSync(sessionDir)).toBe(true)

    const jsonlFiles = readdirSync(sessionDir).filter((name) => name.endsWith(".jsonl"))
    expect(jsonlFiles.length).toBe(1)
  })
})
