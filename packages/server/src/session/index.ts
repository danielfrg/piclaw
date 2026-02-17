import z from "zod"
import { desc, eq } from "drizzle-orm"

import { Database } from "@/storage/db"
import { SessionTable } from "@/session/sql"
import { Id } from "@/util/id"
import { Log } from "@/util/log"

export namespace Session {
  const log = Log.create({ service: "session" })

  export const Info = z
    .object({
      id: z.string(),
      title: z.string(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({
      ref: "Session",
    })

  export type Info = z.infer<typeof Info>

  export const CreateInput = z.object({
    title: z.string().optional(),
  })

  export const UpdateInput = z.object({
    title: z.string().optional(),
  })

  type SessionRow = typeof SessionTable.$inferSelect

  function fromRow(row: SessionRow): Info {
    return {
      id: row.id,
      title: row.title,
      time: {
        created: row.createdAt.getTime(),
        updated: row.updatedAt.getTime(),
      },
    }
  }

  function toRow(info: Info) {
    return {
      id: info.id,
      title: info.title,
      createdAt: new Date(info.time.created),
      updatedAt: new Date(info.time.updated),
    }
  }

  function now() {
    return Date.now()
  }

  export function list(): Info[] {
    const rows = Database.use((db) =>
      db.select().from(SessionTable).orderBy(desc(SessionTable.updatedAt)).all(),
    )
    return rows.map(fromRow)
  }

  export function get(id: string): Info | null {
    const row = Database.use((db) =>
      db.select().from(SessionTable).where(eq(SessionTable.id, id)).get(),
    )
    return row ? fromRow(row) : null
  }

  export function create(input: z.infer<typeof CreateInput> = {}): Info {
    const time = now()
    const session: Info = {
      id: Id.create("session"),
      title: input.title ?? "New Session",
      time: {
        created: time,
        updated: time,
      },
    }
    const row = Database.use((db) =>
      db.insert(SessionTable).values(toRow(session)).returning().get(),
    )
    log.info("created", { id: session.id })
    return row ? fromRow(row) : session
  }

  export function update(id: string, input: z.infer<typeof UpdateInput>): Info | null {
    const row = Database.use((db) =>
      db
        .update(SessionTable)
        .set({
          title: input.title,
          updatedAt: new Date(now()),
        })
        .where(eq(SessionTable.id, id))
        .returning()
        .get(),
    )
    return row ? fromRow(row) : null
  }
}
