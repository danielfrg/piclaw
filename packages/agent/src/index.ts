export { Agent, AgentSchema, type AgentOptions, resolveModel } from "./agent"
export { buildSystemPrompt, type SystemPromptOptions } from "./prompts"
export { loadConfig, ConfigSchema, ConfigModelSchema, paths } from "./config"
export { createLogger, initLog, defaultLogger, LogLevel, type Logger, type LogOptions } from "./log"
export { echoTool } from "./tools/echo"

// Re-export key pi-agent-core types for convenience
export type { AgentEvent, AgentTool, AgentMessage, AgentState } from "@mariozechner/pi-agent-core"
export type { Api, Model, Message } from "@mariozechner/pi-ai"
