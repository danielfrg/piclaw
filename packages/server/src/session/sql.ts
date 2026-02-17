import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const SessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
