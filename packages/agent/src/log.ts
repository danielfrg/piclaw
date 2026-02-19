import pino from "pino"
import z from "zod"

export const LogLevel = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).meta({ ref: "LogLevel", description: "Log level" })
export type LogLevel = z.infer<typeof LogLevel>

export type Logger = {
  debug(message?: unknown, extra?: Record<string, unknown>): void
  info(message?: unknown, extra?: Record<string, unknown>): void
  error(message?: unknown, extra?: Record<string, unknown>): void
  warn(message?: unknown, extra?: Record<string, unknown>): void
}

export interface LogOptions {
  level?: LogLevel
  enabled?: boolean
}

const loggers = new Map<string, Logger>()
let enabled = true
let currentLevel: LogLevel = "INFO"
let root = createRoot({ level: currentLevel })

export const defaultLogger = createLogger({ service: "default" })

export async function initLog(options: LogOptions) {
  if (options.level) {
    currentLevel = options.level
  }
  if (typeof options.enabled === "boolean") {
    enabled = options.enabled
  }
  root = createRoot({ level: currentLevel, enabled })
}

export function createLogger(tags?: Record<string, unknown>): Logger {
  const bindings = { ...(tags ?? {}) }
  const service = typeof bindings.service === "string" ? bindings.service : undefined
  if (service) {
    const cached = loggers.get(service)
    if (cached) return cached
  }

  const api: Logger = {
    debug(message?: unknown, extra?: Record<string, unknown>) {
      if (!enabled) return
      root.child(bindings).debug(extra ?? {}, message as any)
    },
    info(message?: unknown, extra?: Record<string, unknown>) {
      if (!enabled) return
      root.child(bindings).info(extra ?? {}, message as any)
    },
    warn(message?: unknown, extra?: Record<string, unknown>) {
      if (!enabled) return
      root.child(bindings).warn(extra ?? {}, message as any)
    },
    error(message?: unknown, extra?: Record<string, unknown>) {
      if (!enabled) return
      root.child(bindings).error(extra ?? {}, message as any)
    },
  }

  if (service) {
    loggers.set(service, api)
  }
  return api
}

function createRoot(options: { level: LogLevel; enabled?: boolean }) {
  const level = options.enabled === false ? "silent" : toPinoLevel(options.level)
  return pino({ level })
}

function toPinoLevel(level: LogLevel): pino.Level {
  switch (level) {
    case "DEBUG":
      return "debug"
    case "INFO":
      return "info"
    case "WARN":
      return "warn"
    case "ERROR":
      return "error"
  }
}
