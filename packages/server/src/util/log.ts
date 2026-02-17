import pino from "pino"
import z from "zod"

export namespace Log {
  export const Level = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).meta({ ref: "LogLevel", description: "Log level" })

  export type Level = z.infer<typeof Level>

  export type Logger = {
    debug(message?: unknown, extra?: Record<string, unknown>): void
    info(message?: unknown, extra?: Record<string, unknown>): void
    error(message?: unknown, extra?: Record<string, unknown>): void
    warn(message?: unknown, extra?: Record<string, unknown>): void
  }

  export interface Options {
    level?: Level
    enabled?: boolean
  }

  const loggers = new Map<string, Logger>()
  let enabled = true
  let currentLevel: Level = "INFO"
  let root = createRoot({ level: currentLevel })

  export const Default = create({ service: "default" })

  export async function init(options: Options) {
    if (options.level) {
      currentLevel = options.level
    }
    if (typeof options.enabled === "boolean") {
      enabled = options.enabled
    }
    root = createRoot({ level: currentLevel, enabled })
  }

  export function create(tags?: Record<string, unknown>): Logger {
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
}

function createRoot(options: { level: Log.Level; enabled?: boolean }) {
  const level = options.enabled === false ? "silent" : toPinoLevel(options.level)
  return pino({ level })
}

function toPinoLevel(level: Log.Level): pino.Level {
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
