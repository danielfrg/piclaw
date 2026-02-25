import z from "zod"

import { Id } from "@/util/id"

export const ModelRefSchema = z.object({
  providerID: z.string().min(1),
  modelID: z.string().min(1),
})

export const SessionTimeSchema = z.object({
  created: z.number(),
  updated: z.number(),
  compacting: z.number().optional(),
  archived: z.number().optional(),
})

export const PermissionRuleSchema = z.object({
  permission: z.string(),
  pattern: z.string(),
  action: z.enum(["allow", "deny", "ask"]),
})

export const SessionSchema = z
  .object({
    id: Id.schema("session"),
    slug: z.string().min(1),
    projectID: z.string().min(1),
    directory: z.string().min(1),
    parentID: Id.schema("session").optional(),
    title: z.string().min(1),
    version: z.string().min(1),
    time: SessionTimeSchema,
    permission: z.array(PermissionRuleSchema).optional(),
  })
  .meta({ ref: "Session" })

export const TextPartSchema = z.object({
  id: Id.schema("part"),
  sessionID: Id.schema("session"),
  messageID: Id.schema("message"),
  type: z.literal("text"),
  text: z.string(),
  synthetic: z.boolean().optional(),
  ignored: z.boolean().optional(),
  time: z
    .object({
      start: z.number().optional(),
      end: z.number().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const UserMessageSchema = z
  .object({
    id: Id.schema("message"),
    sessionID: Id.schema("session"),
    role: z.literal("user"),
    time: z.object({
      created: z.number(),
    }),
    format: z.unknown().optional(),
    summary: z
      .object({
        title: z.string().optional(),
        body: z.string().optional(),
        diffs: z.array(z.unknown()).optional(),
      })
      .optional(),
    agent: z.string().min(1),
    model: ModelRefSchema,
    system: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    variant: z.string().optional(),
  })
  .meta({ ref: "UserMessage" })

export const AssistantMessageSchema = z
  .object({
    id: Id.schema("message"),
    sessionID: Id.schema("session"),
    role: z.literal("assistant"),
    time: z.object({
      created: z.number(),
      completed: z.number().optional(),
    }),
    error: z.unknown().optional(),
    parentID: Id.schema("message"),
    modelID: z.string().min(1),
    providerID: z.string().min(1),
    mode: z.string().min(1),
    agent: z.string().min(1),
    path: z.object({
      cwd: z.string().min(1),
      root: z.string().min(1),
    }),
    summary: z.boolean().optional(),
    cost: z.number(),
    tokens: z.object({
      total: z.number(),
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: z.object({
        read: z.number(),
        write: z.number(),
      }),
    }),
    structured: z.unknown().optional(),
    variant: z.string().optional(),
    finish: z.string().optional(),
  })
  .meta({ ref: "AssistantMessage" })

export const MessageSchema = z.union([UserMessageSchema, AssistantMessageSchema])

export const MessageWithPartsSchema = z
  .object({
    info: MessageSchema,
    parts: z.array(TextPartSchema),
  })
  .meta({ ref: "MessageWithParts" })

export const SessionCreateInputSchema = z.object({
  parentID: Id.schema("session").optional(),
  title: z.string().min(1).optional(),
  permission: z.array(PermissionRuleSchema).optional(),
})

export const SessionUpdateInputSchema = z.object({
  title: z.string().min(1).optional(),
  time: z
    .object({
      archived: z.number().optional(),
    })
    .optional(),
})

export const TextPartInputSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
})

export const PromptInputSchema = z.object({
  messageID: Id.schema("message").optional(),
  model: ModelRefSchema.optional(),
  agent: z.string().optional(),
  noReply: z.boolean().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  format: z.unknown().optional(),
  system: z.string().optional(),
  variant: z.string().optional(),
  parts: z.array(TextPartInputSchema).min(1),
})

export type SessionInfo = z.infer<typeof SessionSchema>
export type MessageInfo = z.infer<typeof MessageSchema>
export type MessageWithParts = z.infer<typeof MessageWithPartsSchema>
export type TextPart = z.infer<typeof TextPartSchema>
export type PromptInput = z.infer<typeof PromptInputSchema>
