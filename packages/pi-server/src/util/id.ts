import z from "zod"

const prefixes = {
  session: "ses",
  message: "msg",
  part: "part",
} as const

type PrefixKey = keyof typeof prefixes

export const Id = {
  create(prefix?: PrefixKey) {
    if (!prefix) return crypto.randomUUID()
    const resolved = prefix in prefixes ? prefixes[prefix] : prefix
    if (prefix === "session") {
      return `${resolved}_${crypto.randomUUID()}`
    }
    return `${resolved}_${crypto.randomUUID()}`
  },
  schema(prefix?: PrefixKey) {
    return z.string().min(1)
  },
}
