export { Agent, type AgentOptions, resolveModel } from "./agent"
export { buildSystemPrompt, type SystemPromptOptions } from "./prompts"
export { loadConfig, ConfigSchema, ConfigModelSchema, paths } from "./config"
export { createLogger, initLog, defaultLogger, LogLevel, type Logger, type LogOptions } from "./log"
export { echoTool } from "./tools/echo"
export {
  loadSkills,
  formatSkillsForPrompt,
  type Skill,
  type ResourceDiagnostic,
  type LoadSkillsResult,
  type LoadSkillsOptions,
} from "./skills"

// Tools from pi-coding-agent
export { bashTool, createBashTool } from "@mariozechner/pi-coding-agent"

// Re-export key pi-agent-core types for convenience
export type { AgentEvent, AgentTool, AgentMessage, AgentState } from "@mariozechner/pi-agent-core"
export type { Api, Model, Message } from "@mariozechner/pi-ai"
