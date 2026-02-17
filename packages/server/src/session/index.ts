import z from "zod"
import { ulid } from "ulid"

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
        compacting: z.number().optional(),
        archived: z.number().optional(),
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

  const store = new Map<string, Info>()

  function now() {
    return Date.now()
  }

  export function list(): Info[] {
    return Array.from(store.values()).sort((a, b) => b.time.updated - a.time.updated)
  }

  export function get(id: string): Info | null {
    return store.get(id) ?? null
  }

  export function create(input: z.infer<typeof CreateInput> = {}): Info {
    const time = now()
    const session: Info = {
      id: ulid(),
      title: input.title ?? "New Session",
      time: {
        created: time,
        updated: time,
      },
    }
    store.set(session.id, session)
    return session
  }

  export function update(id: string, input: z.infer<typeof UpdateInput>): Info | null {
    const current = store.get(id)
    if (!current) return null
    const next: Info = {
      ...current,
      title: input.title ?? current.title,
      time: {
        ...current.time,
        updated: now(),
      },
    }
    store.set(id, next)
    return next
  }
}
