import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import type { OpenAPIV3_1 } from "openapi-types"
import z from "zod"

import {
  MessageWithPartsSchema,
  ModelRefSchema,
  PromptInputSchema,
  SessionCreateInputSchema,
  SessionSchema,
  SessionUpdateInputSchema,
  type MessageWithParts,
  type Part,
} from "@/schema"
import {
  appendMessage,
  createSession,
  deleteSession,
  getSession,
  listSessions,
  setSessionStatus,
  updateSession,
  type SessionRecord,
} from "@/session/store"
import { flushSession } from "@/session/persist"
import { log } from "@/util/log"
import { Id } from "@/util/id"

const sessionParamSchema = z.object({
  sessionID: Id.schema("session"),
})

const messagesListSchema = z.array(MessageWithPartsSchema)

type OpenApiSchema = OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject

function asOpenApiSchema<T extends Parameters<typeof resolver>[0]>(schema: T): OpenApiSchema {
  return resolver(schema) as unknown as OpenApiSchema
}

export function SessionRoutes() {
  return new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List sessions",
        description: "List all sessions ordered by last update.",
        operationId: "session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: asOpenApiSchema(SessionSchema.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const sessions = listSessions()
        return c.json(sessions)
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create session",
        description: "Create a new session.",
        operationId: "session.create",
        requestBody: {
          content: {
            "application/json": {
              schema: asOpenApiSchema(SessionCreateInputSchema),
            },
          },
        },
        responses: {
          200: {
            description: "Created session",
            content: {
              "application/json": {
                schema: asOpenApiSchema(SessionSchema),
              },
            },
          },
        },
      }),
      validator("json", SessionCreateInputSchema),
      async (c) => {
        const input = c.req.valid("json")
        log.info({ parentID: input.parentID, title: input.title }, "session.create")
        const session = await createSession({
          title: input.title,
          parentID: input.parentID,
        })
        log.info({ sessionID: session.info.id }, "session.created")
        return c.json(session.info)
      },
    )
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get session",
        description: "Retrieve a session by id.",
        operationId: "session.get",
        responses: {
          200: {
            description: "Session",
            content: {
              "application/json": {
                schema: asOpenApiSchema(SessionSchema),
              },
            },
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator("param", sessionParamSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const session = getSession(sessionID)
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        return c.json(session.info)
      },
    )
    .patch(
      "/:sessionID",
      describeRoute({
        summary: "Update session",
        description: "Update an existing session.",
        operationId: "session.update",
        requestBody: {
          content: {
            "application/json": {
              schema: asOpenApiSchema(SessionUpdateInputSchema),
            },
          },
        },
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: asOpenApiSchema(SessionSchema),
              },
            },
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator("param", sessionParamSchema),
      validator("json", SessionUpdateInputSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const input = c.req.valid("json")
        const session = updateSession(sessionID, {
          title: input.title,
          archived: input.time?.archived,
        })
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        return c.json(session.info)
      },
    )
    .delete(
      "/:sessionID",
      describeRoute({
        summary: "Delete session",
        description: "Delete a session.",
        operationId: "session.delete",
        responses: {
          200: {
            description: "Session deleted",
            content: {
              "application/json": {
                schema: asOpenApiSchema(z.boolean()),
              },
            },
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator("param", sessionParamSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const removed = deleteSession(sessionID)
        if (!removed) {
          return c.json({ error: "Session not found" }, 404)
        }
        return c.json(true)
      },
    )
    .get(
      "/:sessionID/message",
      describeRoute({
        summary: "Get session messages",
        description: "Retrieve all messages in a session.",
        operationId: "session.messages",
        responses: {
          200: {
            description: "List of messages",
            content: {
              "application/json": {
                schema: asOpenApiSchema(messagesListSchema),
              },
            },
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator("param", sessionParamSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const session = getSession(sessionID)
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        return c.json(session.messages)
      },
    )
    .post(
      "/:sessionID/message",
      describeRoute({
        summary: "Send message",
        description: "Create and send a new message to a session.",
        operationId: "session.prompt",
        requestBody: {
          content: {
            "application/json": {
              schema: asOpenApiSchema(PromptInputSchema),
            },
          },
        },
        responses: {
          200: {
            description: "Messages produced by the agent",
            content: {
              "application/json": {
                schema: asOpenApiSchema(z.array(MessageWithPartsSchema)),
              },
            },
          },
          400: {
            description: "Bad request",
          },
          404: {
            description: "Session not found",
          },
          409: {
            description: "Session already running",
          },
        },
      }),
      validator("param", sessionParamSchema),
      validator("json", PromptInputSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const input = c.req.valid("json")
        const session = getSession(sessionID)
        if (!session) {
          log.warn({ sessionID }, "session.prompt.not_found")
          return c.json({ error: "Session not found" }, 404)
        }

        if (session.status === "running") {
          log.warn({ sessionID }, "session.prompt.already_running")
          return c.json({ error: "Session already running" }, 409)
        }

        const promptText = extractPromptText(input)
        if (!promptText) {
          log.warn({ sessionID }, "session.prompt.empty")
          return c.json({ error: "Prompt text is required" }, 400)
        }

        const modelRef = resolveModelRef(session)
        const userMessageId = input.messageID ?? Id.create("message")
        const agentName = input.agent ?? "pi"
        log.info({ sessionID, messageID: userMessageId, agent: agentName, model: modelRef }, "session.prompt")
        const userMessage = buildUserMessage({
          sessionID,
          messageID: userMessageId,
          agent: agentName,
          model: modelRef,
          text: promptText,
        })
        appendMessage(sessionID, userMessage)

        if (input.noReply) {
          log.info({ sessionID, messageID: userMessageId }, "session.prompt.no_reply")
          // Persist user-only messages immediately for REST usage without waiting on the agent.
          // SessionManager only writes after an assistant message by default.
          const sessionManager = session.runtime.sessionManager
          sessionManager.appendMessage(buildAgentUserMessage(promptText))
          const sessionFile = flushSession(sessionManager)
          if (sessionFile) {
            // Mark the session as flushed so future assistant messages append incrementally.
            sessionManager.setSessionFile(sessionFile)
          }
          return c.json([userMessage])
        }

        setSessionStatus(sessionID, "running")
        try {
          if (input.model) {
            await setSessionModel(session, input.model)
          }
          log.info(
            {
              sessionID,
              model: session.runtime.model
                ? { providerID: session.runtime.model.provider, modelID: session.runtime.model.id }
                : null,
            },
            "session.prompt.model",
          )
          // Snapshot message count before prompting so we can extract new messages after.
          const messagesBefore = session.runtime.messages.length
          await session.runtime.prompt(promptText)

          const modelRef = resolveModelRef(session)
          const newAgentMessages = session.runtime.messages.slice(messagesBefore)
          for (const msg of newAgentMessages) {
            const m = msg as { role: string; content?: unknown }
            const contentTypes = Array.isArray(m.content)
              ? (m.content as Array<{ type: string }>).map((c) => c.type)
              : typeof m.content
            log.info({ role: m.role, contentTypes }, "session.prompt.agent_message")
          }
          const converted = convertAgentMessages(newAgentMessages, {
            sessionID,
            parentID: userMessageId,
            agent: agentName,
            model: modelRef,
            cwd: session.info.directory,
          })
          for (const msg of converted) {
            appendMessage(sessionID, msg)
          }
          log.info({ sessionID, count: converted.length }, "session.prompt.completed")
          return c.json(converted)
        } catch (error) {
          log.error({ sessionID, error }, "session.prompt.failed")
          return c.json({ error: errorMessage(error) }, 400)
        } finally {
          setSessionStatus(sessionID, "idle")
        }
      },
    )
    .post(
      "/:sessionID/abort",
      describeRoute({
        summary: "Abort session",
        description: "Abort an active session and stop any ongoing processing.",
        operationId: "session.abort",
        responses: {
          200: {
            description: "Aborted session",
            content: {
              "application/json": {
                schema: asOpenApiSchema(z.boolean()),
              },
            },
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator("param", sessionParamSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const session = getSession(sessionID)
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        await session.runtime.abort()
        setSessionStatus(sessionID, "idle")
        return c.json(true)
      },
    )
}

function extractPromptText(input: z.infer<typeof PromptInputSchema>): string {
  const parts = input.parts
  if (!parts.length) return ""
  return parts
    .filter((part: { type: "text"; text: string }) => part.type === "text")
    .map((part: { text: string }) => part.text)
    .join("\n")
    .trim()
}

function resolveModelRef(session: SessionRecord): z.infer<typeof ModelRefSchema> {
  const model = session.runtime.model
  if (!model) {
    return {
      providerID: "unknown",
      modelID: "unknown",
    }
  }
  return {
    providerID: model.provider,
    modelID: model.id,
  }
}

async function setSessionModel(session: SessionRecord, model: z.infer<typeof ModelRefSchema>): Promise<void> {
  const resolved = session.runtime.modelRegistry.find(model.providerID, model.modelID)
  if (!resolved) {
    throw new Error(`Unknown model ${model.providerID}/${model.modelID}`)
  }
  await session.runtime.setModel(resolved)
}

function buildUserMessage(input: {
  sessionID: string
  messageID: string
  agent: string
  model: z.infer<typeof ModelRefSchema>
  text: string
}): MessageWithParts {
  const now = Date.now()

  return {
    info: {
      id: input.messageID,
      sessionID: input.sessionID,
      role: "user",
      time: {
        created: now,
      },
      agent: input.agent,
      model: input.model,
    },
    parts: [
      {
        id: Id.create("part"),
        sessionID: input.sessionID,
        messageID: input.messageID,
        type: "text",
        text: input.text,
      },
    ],
  }
}

function buildAgentUserMessage(text: string): {
  role: "user"
  content: { type: "text"; text: string }[]
  timestamp: number
} {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// AgentMessage -> MessageWithParts conversion
// ---------------------------------------------------------------------------

type AgentMsg = { role: string; [key: string]: unknown }

type ConvertCtx = {
  sessionID: string
  parentID: string
  agent: string
  model: z.infer<typeof ModelRefSchema>
  cwd: string
}

/**
 * Convert a slice of AgentMessage[] (from pi-coding-agent) into our
 * MessageWithParts[] with full part types (text, thinking, tool-call, tool-result).
 */
function convertAgentMessages(agentMessages: unknown[], ctx: ConvertCtx): MessageWithParts[] {
  const results: MessageWithParts[] = []
  let lastParentID = ctx.parentID

  for (const raw of agentMessages) {
    const msg = raw as AgentMsg
    const role = msg.role as string

    if (role === "assistant") {
      const messageID = Id.create("message")
      const parts = convertAssistantContent(msg.content, ctx.sessionID, messageID)
      const usage = msg.usage as Record<string, unknown> | undefined

      results.push({
        info: {
          id: messageID,
          sessionID: ctx.sessionID,
          role: "assistant",
          time: {
            created: (msg.timestamp as number) ?? Date.now(),
            completed: Date.now(),
          },
          parentID: lastParentID,
          modelID: (msg.model as string) ?? ctx.model.modelID,
          providerID: (msg.provider as string) ?? ctx.model.providerID,
          mode: "server",
          agent: ctx.agent,
          path: { cwd: ctx.cwd, root: ctx.cwd },
          cost: extractCost(usage),
          tokens: extractTokens(usage),
        },
        parts,
      })
      lastParentID = messageID
    } else if (role === "toolResult") {
      const messageID = Id.create("message")
      const content = Array.isArray(msg.content)
        ? (msg.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === "text" && c.text)
            .map((c) => c.text!)
            .join("\n")
        : String(msg.content ?? "")

      const part: Part = {
        id: Id.create("part"),
        sessionID: ctx.sessionID,
        messageID,
        type: "tool-result",
        toolCallId: (msg.toolCallId as string) ?? "",
        toolName: (msg.toolName as string) ?? "",
        content,
        error: (msg.isError as boolean) ?? false,
      }

      results.push({
        info: {
          id: messageID,
          sessionID: ctx.sessionID,
          role: "assistant",
          time: { created: (msg.timestamp as number) ?? Date.now(), completed: Date.now() },
          parentID: lastParentID,
          modelID: ctx.model.modelID,
          providerID: ctx.model.providerID,
          mode: "server",
          agent: ctx.agent,
          path: { cwd: ctx.cwd, root: ctx.cwd },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        },
        parts: [part],
      })
      lastParentID = messageID
    } else if (role === "bashExecution") {
      const messageID = Id.create("message")
      const cmd = (msg.command as string) ?? ""
      const output = (msg.output as string) ?? ""
      const exitCode = msg.exitCode as number | undefined

      const callPart: Part = {
        id: Id.create("part"),
        sessionID: ctx.sessionID,
        messageID,
        type: "tool-call",
        toolCallId: messageID,
        toolName: "bash",
        args: { command: cmd },
      }

      const resultPart: Part = {
        id: Id.create("part"),
        sessionID: ctx.sessionID,
        messageID,
        type: "tool-result",
        toolCallId: messageID,
        toolName: "bash",
        content: output,
        error: exitCode !== undefined && exitCode !== 0,
      }

      results.push({
        info: {
          id: messageID,
          sessionID: ctx.sessionID,
          role: "assistant",
          time: { created: (msg.timestamp as number) ?? Date.now(), completed: Date.now() },
          parentID: lastParentID,
          modelID: ctx.model.modelID,
          providerID: ctx.model.providerID,
          mode: "server",
          agent: ctx.agent,
          path: { cwd: ctx.cwd, root: ctx.cwd },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        },
        parts: [callPart, resultPart],
      })
      lastParentID = messageID
    }
    // Skip user messages (already added optimistically) and other custom roles.
  }

  return results
}

/**
 * Convert an AssistantMessage's content array into Part[].
 * Content items can be: { type: "text" }, { type: "thinking" }, { type: "toolCall" }.
 */
function convertAssistantContent(content: unknown, sessionID: string, messageID: string): Part[] {
  if (!Array.isArray(content)) return []

  const parts: Part[] = []
  for (const item of content) {
    const c = item as { type: string; [key: string]: unknown }
    if (c.type === "text" && typeof c.text === "string" && c.text.trim()) {
      parts.push({
        id: Id.create("part"),
        sessionID,
        messageID,
        type: "text",
        text: c.text,
      })
    } else if (c.type === "thinking" && typeof c.thinking === "string" && c.thinking.trim()) {
      parts.push({
        id: Id.create("part"),
        sessionID,
        messageID,
        type: "thinking",
        thinking: c.thinking,
      })
    } else if (c.type === "toolCall") {
      parts.push({
        id: Id.create("part"),
        sessionID,
        messageID,
        type: "tool-call",
        toolCallId: (c.id as string) ?? "",
        toolName: (c.name as string) ?? "",
        args: (c.arguments as Record<string, unknown>) ?? {},
      })
    }
  }
  return parts
}

function extractCost(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0
  const cost = usage.cost as Record<string, number> | undefined
  return cost?.total ?? 0
}

type TokenInfo = {
  total: number
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

function extractTokens(usage: Record<string, unknown> | undefined): TokenInfo {
  if (!usage) {
    return { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
  }
  return {
    total: (usage.totalTokens as number) ?? 0,
    input: (usage.input as number) ?? 0,
    output: (usage.output as number) ?? 0,
    reasoning: 0,
    cache: {
      read: (usage.cacheRead as number) ?? 0,
      write: (usage.cacheWrite as number) ?? 0,
    },
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unknown error"
}
