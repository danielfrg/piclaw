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

async function buildAgentSession(sessionManager: SessionManager): Promise<AgentSession> {
  const agentDir = getAgentDir()
  const cwd = sessionManager.getCwd()
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

export async function createSessionRuntime(): Promise<AgentSession> {
  const cwd = homedir()
  const sessionManager = SessionManager.create(cwd)
  return buildAgentSession(sessionManager)
}

export async function resumeSessionRuntime(sessionFilePath: string): Promise<AgentSession> {
  const sessionManager = SessionManager.open(sessionFilePath)
  return buildAgentSession(sessionManager)
}

/**
 * Get global capabilities (skills + tools) without creating a session.
 * Cached after first call since skills/tools don't change at runtime.
 */
let _cachedCapabilities:
  | { skills: { name: string; description: string; source: string }[]; tools: { name: string; description: string }[] }
  | undefined

export async function getGlobalCapabilities() {
  if (_cachedCapabilities) return _cachedCapabilities

  const cwd = homedir()
  const agentDir = getAgentDir()
  const settingsManager = SettingsManager.create(cwd, agentDir)

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
  })
  await resourceLoader.reload()

  const { skills } = resourceLoader.getSkills()
  const tools = createCodingTools(cwd)

  _cachedCapabilities = {
    skills: skills.map((s) => ({ name: s.name, description: s.description, source: s.source })),
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
  }

  log.info(
    { skills: _cachedCapabilities.skills.length, tools: _cachedCapabilities.tools.length },
    "capabilities.loaded",
  )
  return _cachedCapabilities
}

export { SessionManager }
