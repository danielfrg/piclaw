import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  AuthStorage,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createAgentSession,
  createCodingTools,
  type AgentSession,
} from "@mariozechner/pi-coding-agent"

import { log } from "@/util/log"

const __dirname = dirname(fileURLToPath(import.meta.url))

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

const SOUL_PATH = join(homedir(), ".pi", "SOUL.md")
const PROMPT_PATH = join(__dirname, "..", "..", "prompts", "system-full.md")

function loadSystemPrompt(): string {
  const prompt = readFileSync(PROMPT_PATH, "utf-8")
  log.info({ path: PROMPT_PATH }, "prompt.loaded")
  return prompt
}

function loadSoul(): string | undefined {
  if (!existsSync(SOUL_PATH)) return undefined
  const content = readFileSync(SOUL_PATH, "utf-8").trim()
  if (!content) return undefined
  log.info({ path: SOUL_PATH }, "soul.loaded")
  return content
}

function buildFullPrompt(): string {
  const base = loadSystemPrompt()
  const soul = loadSoul()
  if (!soul) return base
  return `${base}\n\n# SOUL.md\n\n${soul}`
}

export async function createSessionRuntime(): Promise<AgentSession> {
  const agentDir = getAgentDir()
  const cwd = homedir()
  const sessionManager = SessionManager.create(cwd)
  const settingsManager = SettingsManager.create(cwd, agentDir)

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    systemPrompt: buildFullPrompt(),
  })
  await resourceLoader.reload()

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    tools: createCodingTools(cwd),
    sessionManager,
    settingsManager,
    resourceLoader,
  })

  return session
}
