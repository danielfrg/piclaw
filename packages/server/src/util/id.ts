import { ulid } from "ulid"
import z from "zod"

export namespace Id {
  const prefixes = {
    session: "ses",
  } as const

  type PrefixKey = keyof typeof prefixes

  export function create(prefix?: PrefixKey) {
    if (!prefix) return ulid()
    const resolved = prefix in prefixes ? prefixes[prefix as PrefixKey] : prefix
    return `${resolved}_${ulid()}`
  }

  export function schema(prefix?: PrefixKey) {
    if (!prefix) return z.string().min(1)
    const resolved = prefix in prefixes ? prefixes[prefix as PrefixKey] : prefix
    const pattern = new RegExp(`^${resolved}_[0-9A-HJKMNP-TV-Z]{26}$`)
    return z.string().regex(pattern)
  }
}
