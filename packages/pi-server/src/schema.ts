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

const PartTimeSchema = z
  .object({
    start: z.number().optional(),
    end: z.number().optional(),
  })
  .optional()

const PartBaseSchema = z.object({
  id: Id.schema("part"),
  sessionID: Id.schema("session"),
  messageID: Id.schema("message"),
  synthetic: z.boolean().optional(),
  ignored: z.boolean().optional(),
  time: PartTimeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const TextPartSchema = PartBaseSchema.extend({
  type: z.literal("text"),
  text: z.string(),
}).meta({ ref: "TextPart" })

export const ThinkingPartSchema = PartBaseSchema.extend({
  type: z.literal("thinking"),
  thinking: z.string(),
}).meta({ ref: "ThinkingPart" })

export const ToolCallPartSchema = PartBaseSchema.extend({
  type: z.literal("tool-call"),
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
}).meta({ ref: "ToolCallPart" })

export const ToolResultPartSchema = PartBaseSchema.extend({
  type: z.literal("tool-result"),
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  content: z.string(),
  error: z.boolean().optional(),
}).meta({ ref: "ToolResultPart" })

export const PartSchema = z
  .discriminatedUnion("type", [TextPartSchema, ThinkingPartSchema, ToolCallPartSchema, ToolResultPartSchema])
  .meta({ ref: "Part" })

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
    parts: z.array(PartSchema),
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

export const ThinkingLevelSchema = z.enum(["off", "minimal", "low", "medium", "high", "xhigh"])

export const ModelInfoSchema = z
  .object({
    provider: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1),
    api: z.string().min(1),
    reasoning: z.boolean(),
    input: z.array(z.string()),
    cost: z.object({
      input: z.number(),
      output: z.number(),
      cacheRead: z.number(),
      cacheWrite: z.number(),
    }),
    contextWindow: z.number(),
    maxTokens: z.number(),
  })
  .meta({ ref: "ModelInfo" })

export const SessionConfigSchema = z
  .object({
    model: z
      .object({
        provider: z.string().min(1),
        id: z.string().min(1),
        name: z.string().min(1),
        reasoning: z.boolean(),
      })
      .nullable(),
    thinkingLevel: ThinkingLevelSchema,
    availableThinkingLevels: z.array(ThinkingLevelSchema),
    supportsThinking: z.boolean(),
  })
  .meta({ ref: "SessionConfig" })

export const SessionConfigUpdateSchema = z.object({
  provider: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
})

export type SessionInfo = z.infer<typeof SessionSchema>
export type MessageInfo = z.infer<typeof MessageSchema>
export type MessageWithParts = z.infer<typeof MessageWithPartsSchema>
export type Part = z.infer<typeof PartSchema>
export type TextPart = z.infer<typeof TextPartSchema>
export type ThinkingPart = z.infer<typeof ThinkingPartSchema>
export type ToolCallPart = z.infer<typeof ToolCallPartSchema>
export type ToolResultPart = z.infer<typeof ToolResultPartSchema>
export type ModelInfo = z.infer<typeof ModelInfoSchema>
export type SessionConfig = z.infer<typeof SessionConfigSchema>
export const SkillInfoSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    source: z.string(),
  })
  .meta({ ref: "SkillInfo" })

export const ToolInfoSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
  })
  .meta({ ref: "ToolInfoItem" })

export const CapabilitiesSchema = z
  .object({
    skills: z.array(SkillInfoSchema),
    tools: z.array(ToolInfoSchema),
  })
  .meta({ ref: "Capabilities" })

export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>
export type PromptInput = z.infer<typeof PromptInputSchema>
export type SkillInfoItem = z.infer<typeof SkillInfoSchema>
export type ToolInfoItem = z.infer<typeof ToolInfoSchema>
export type Capabilities = z.infer<typeof CapabilitiesSchema>
