import fs from "fs/promises"
import path from "path"
import z from "zod"
import { parse } from "jsonc-parser"

import { Global } from "@/global"
import { Log } from "@/util/log"

export namespace Config {
  const log = Log.create({ service: "config" })

  export const ModelSchema = z.object({
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
  export type ModelSchema = z.infer<typeof ModelSchema>

  export const Schema = z.object({
    defaultModel: z.string().optional(),
    models: z.record(z.string(), ModelSchema).optional(),
  })
  export type Schema = z.infer<typeof Schema>

  const CONFIG_FILE = "config.jsonc"

  export async function load(): Promise<Schema> {
    const filepath = path.join(Global.Path.config, CONFIG_FILE)
    const text = await fs.readFile(filepath, "utf-8").catch((err) => {
      if (err?.code === "ENOENT") return ""
      throw err
    })
    if (!text) return {}

    const rawText = text.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, key) => {
      return process.env[key] ?? ""
    })
    const raw = parse(rawText) as unknown
    const parsed = Schema.safeParse(raw)
    if (!parsed.success) {
      log.error("invalid config", { path: filepath, error: parsed.error.flatten() })
      throw parsed.error
    }
    return parsed.data
  }
}
