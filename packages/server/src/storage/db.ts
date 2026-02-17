import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import path from "path"

import { Database as BunDatabase } from "bun:sqlite"

import { Global } from "@/global"
import { Log } from "@/util/log"
import * as schema from "@/storage/schema"

const log = Log.create({ service: "db" })

export namespace Database {
  export const Path = path.join(Global.Path.data, "app.db")

  type Schema = typeof schema
  type Client = BunSQLiteDatabase<Schema>

  export type Transaction = Parameters<Parameters<Client["transaction"]>[0]>[0]
  export type TxOrDb = Transaction | Client

  log.info("opening database", { path: Database.Path })

  const sqlite = new BunDatabase(Database.Path, { create: true })

  sqlite.run("PRAGMA journal_mode = WAL")
  sqlite.run("PRAGMA synchronous = NORMAL")
  sqlite.run("PRAGMA busy_timeout = 5000")
  sqlite.run("PRAGMA cache_size = -64000")
  sqlite.run("PRAGMA foreign_keys = ON")
  sqlite.run("PRAGMA wal_checkpoint(PASSIVE)")

  export const Client = drizzle({ client: sqlite, schema })

  export function use<T>(callback: (db: TxOrDb) => T): T {
    return callback(Client)
  }

  export function transaction<T>(callback: (tx: Transaction) => T): T {
    return Client.transaction((tx) => callback(tx))
  }
}
