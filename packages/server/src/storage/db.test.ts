import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { sql } from "drizzle-orm"

let tempDir: string
const originalDbPath = process.env.CODEC_DB_PATH

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-db-"))
  process.env.CODEC_DB_PATH = path.join(tempDir, "app.db")
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true })
  restoreEnv("CODEC_DB_PATH", originalDbPath)
})

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

describe("Database", () => {
  test("creates the database file", async () => {
    const { Database } = await import("@/storage/db")
    const dbPath = Database.Path

    const exists = await fs
      .access(dbPath)
      .then(() => true)
      .catch(() => false)

    expect(exists).toBe(true)
  })

  test("runs a simple select(1)", async () => {
    const { Database } = await import("@/storage/db")
    const rows = Database.Client.all<{ value: number }>(sql.raw("select 1 as value"))
    expect(rows[0]?.value).toBe(1)
  })
})
