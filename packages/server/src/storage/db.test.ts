import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { sql } from "drizzle-orm"

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-db-"))
  process.env.NODE_ENV = "production"
  process.env.XDG_DATA_HOME = tempDir
  process.env.XDG_CACHE_HOME = tempDir
  process.env.XDG_CONFIG_HOME = tempDir
  process.env.XDG_STATE_HOME = tempDir
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true })
})

describe("Database", () => {
  test("creates the database file", async () => {
    const { Database } = await import("./db")
    const dbPath = Database.Path

    const exists = await fs
      .access(dbPath)
      .then(() => true)
      .catch(() => false)

    expect(exists).toBe(true)
  })

  test("runs a simple select(1)", async () => {
    const { Database } = await import("./db")
    const rows = Database.Client.all<{ value: number }>(sql.raw("select 1 as value"))
    expect(rows[0]?.value).toBe(1)
  })
})
