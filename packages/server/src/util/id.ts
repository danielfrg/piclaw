import { ulid } from "ulid"
import z from "zod"

export namespace Id {
  export const Prefix = {
    session: "ses",
  } as const

  const LENGTH = 26

  export function create(prefix?: string) {
    return prefix ? `${prefix}_${ulid()}` : ulid()
  }

  export function schema(prefix?: string) {
    if (!prefix) return z.string().min(1)
    const pattern = new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`)
    return z.string().regex(pattern)
  }
}
