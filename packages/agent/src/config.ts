import fs from "fs/promises"
import os from "os"
import path from "path"
import z from "zod"
import { parse } from "jsonc-parser"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"

import { createLogger } from "./log"

const appName = "piclaw"
const isDev = process.env.NODE_ENV !== "production"

const root = isDev ? path.join(resolveRepoRoot(), "data") : xdgData!

const data = isDev ? root : xdgData!
const cache = isDev ? path.join(root, "cache") : path.join(xdgCache!, appName)
const config = isDev ? path.join(root, "config") : path.join(xdgConfig!, appName)
const state = isDev ? path.join(root, "state") : path.join(xdgState!, appName)
const CONFIG_FILE = "config.json"

const log = createLogger({ service: "config" })

export const paths = {
  get home() {
    return process.env.PICLAW_HOME || os.homedir()
  },
  data,
  log: path.join(data, "log"),
  cache,
  config,
  state,
}

function resolveRepoRoot() {
  const cwd = process.cwd()
  const parts = cwd.split(path.sep)
  if (parts.length >= 2 && parts[parts.length - 2] === "packages") {
    return path.resolve(cwd, "..", "..")
  }
  return cwd
}

// Create config directories
await Promise.all([
  fs.mkdir(paths.data, { recursive: true }),
  fs.mkdir(paths.log, { recursive: true }),
  fs.mkdir(paths.cache, { recursive: true }),
  fs.mkdir(paths.config, { recursive: true }),
  fs.mkdir(paths.state, { recursive: true }),
])

export const ConfigModelSchema = z.object({
  id: z.string().optional(),
  provider: z.string().optional(),
  api: z.string().optional(),
  baseUrl: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  contextWindow: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  reasoning: z.boolean().optional(),
  input: z.array(z.enum(["text", "image"])).optional(),
  cost: z
    .object({
      input: z.number().nonnegative().optional(),
      output: z.number().nonnegative().optional(),
      cacheRead: z.number().nonnegative().optional(),
      cacheWrite: z.number().nonnegative().optional(),
    })
    .optional(),
})
export type ConfigModelSchema = z.infer<typeof ConfigModelSchema>

export const ConfigSchema = z.object({
  defaultModel: z.string().optional(),
  models: z.record(z.string(), ConfigModelSchema).optional(),
})
export type ConfigSchema = z.infer<typeof ConfigSchema>

export async function loadConfig(): Promise<ConfigSchema> {
  const filepath = path.join(paths.config, CONFIG_FILE)
  const text = await fs.readFile(filepath, "utf-8").catch((err) => {
    if (err?.code === "ENOENT") return ""
    throw err
  })
  if (!text) return {}

  const rawText = text.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, key) => {
    return process.env[key] ?? ""
  })
  const raw = parse(rawText) as unknown
  const parsed = ConfigSchema.safeParse(raw)
  if (!parsed.success) {
    log.error("invalid config", { path: filepath, error: parsed.error.flatten() })
    throw parsed.error
  }
  return parsed.data
}
