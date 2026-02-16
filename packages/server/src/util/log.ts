import fs from "fs/promises"
import path from "path"
import pino from "pino"
import z from "zod"

import { Global } from "../global"

export namespace Log {
  export const Level = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).meta({ ref: "LogLevel", description: "Log level" })

  export type Level = z.infer<typeof Level>

  export type Logger = {
    debug(message?: unknown, extra?: Record<string, unknown>): void
    info(message?: unknown, extra?: Record<string, unknown>): void
    error(message?: unknown, extra?: Record<string, unknown>): void
    warn(message?: unknown, extra?: Record<string, unknown>): void
    tag(key: string, value: string): Logger
    clone(): Logger
    time(
      message: string,
      extra?: Record<string, unknown>,
    ): {
      stop(): void
      [Symbol.dispose](): void
    }
  }

  export interface Options {
    print: boolean
    dev?: boolean
    level?: Level
    enabled?: boolean
  }

  const loggers = new Map<string, Logger>()
  let logpath = ""
  let enabled = true
  let currentLevel: Level = "INFO"
  let root = createRoot({ level: currentLevel, print: true })

  export const Default = create({ service: "default" })

  export function file() {
    return logpath
  }

  export async function init(options: Options) {
    if (options.level) {
      currentLevel = options.level
    }
    if (typeof options.enabled === "boolean") {
      enabled = options.enabled
    }
    await cleanup(Global.Path.log)
    if (options.print) {
      logpath = ""
      root = createRoot({ level: currentLevel, print: true, enabled })
      return
    }
    const timestamp = new Date().toISOString().split(".")[0] ?? new Date().toISOString()
    const filename = options.dev ? "dev.log" : `${timestamp.replace(/:/g, "")}.log`
    logpath = path.join(Global.Path.log, filename)
    await fs.truncate(logpath).catch(() => { })
    root = createRoot({ level: currentLevel, print: false, destination: logpath, enabled })
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
      error(message?: unknown, extra?: Record<string, unknown>) {
        if (!enabled) return
        root.child(bindings).error(extra ?? {}, message as any)
      },
      warn(message?: unknown, extra?: Record<string, unknown>) {
        if (!enabled) return
        root.child(bindings).warn(extra ?? {}, message as any)
      },
      tag(key: string, value: string) {
        bindings[key] = value
        return api
      },
      clone() {
        return Log.create({ ...bindings })
      },
      time(message: string, extra?: Record<string, unknown>) {
        const start = Date.now()
        api.info(message, { status: "started", ...extra })
        const stop = () => {
          api.info(message, {
            status: "completed",
            durationMs: Date.now() - start,
            ...extra,
          })
        }
        return {
          stop,
          [Symbol.dispose]() {
            stop()
          },
        }
      },
    }

    if (service) {
      loggers.set(service, api)
    }
    return api
  }
}

function createRoot(options: { level: Log.Level; print: boolean; destination?: string; enabled?: boolean }) {
  const level = options.enabled === false ? "silent" : toPinoLevel(options.level)
  if (options.print) {
    return pino({ level })
  }
  const dest = options.destination ? pino.destination({ dest: options.destination, sync: false }) : undefined
  return pino({ level }, dest)
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

async function cleanup(dir: string) {
  let entries: string[] = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return
  }
  const files = entries.filter((entry) => /^\d{4}-\d{2}-\d{2}T\d{6}\.log$/.test(entry)).sort()
  if (files.length <= 10) return
  const filesToDelete = files.slice(0, -10)
  await Promise.all(filesToDelete.map((file) => fs.unlink(path.join(dir, file)).catch(() => { })))
}
