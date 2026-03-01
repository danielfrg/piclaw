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
    return `${prefixes[prefix]}_${crypto.randomUUID()}`
  },
  schema(prefix?: PrefixKey) {
    if (!prefix) return z.string().min(1)
    const tag = prefixes[prefix]
    return z.string().startsWith(`${tag}_`)
  },
}
