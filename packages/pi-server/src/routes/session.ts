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
  TextPartSchema,
  type MessageWithParts,
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
            description: "Created message",
            content: {
              "application/json": {
                schema: asOpenApiSchema(MessageWithPartsSchema),
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
          return c.json(userMessage)
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
          await session.runtime.prompt(promptText)
          const assistantText = extractAssistantText(session)
          const assistantMessage = buildAssistantMessage({
            sessionID,
            parentID: userMessageId,
            agent: agentName,
            model: resolveModelRef(session),
            text: assistantText,
            cwd: session.info.directory,
          })
          appendMessage(sessionID, assistantMessage)
          log.info({ sessionID, messageID: assistantMessage.info.id }, "session.prompt.completed")
          return c.json(assistantMessage)
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
  const part = buildTextPart({
    sessionID: input.sessionID,
    messageID: input.messageID,
    text: input.text,
  })

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
    parts: [part],
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

function buildAssistantMessage(input: {
  sessionID: string
  parentID: string
  agent: string
  model: z.infer<typeof ModelRefSchema>
  text: string
  cwd: string
}): MessageWithParts {
  const now = Date.now()
  const messageID = Id.create("message")
  const part = buildTextPart({
    sessionID: input.sessionID,
    messageID,
    text: input.text,
  })

  return {
    info: {
      id: messageID,
      sessionID: input.sessionID,
      role: "assistant",
      time: {
        created: now,
        completed: now,
      },
      parentID: input.parentID,
      modelID: input.model.modelID,
      providerID: input.model.providerID,
      mode: "server",
      agent: input.agent,
      path: {
        cwd: input.cwd,
        root: input.cwd,
      },
      cost: 0,
      tokens: {
        total: 0,
        input: 0,
        output: 0,
        reasoning: 0,
        cache: {
          read: 0,
          write: 0,
        },
      },
    },
    parts: [part],
  }
}

function buildTextPart(input: { sessionID: string; messageID: string; text: string }): z.infer<typeof TextPartSchema> {
  return {
    id: Id.create("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "text",
    text: input.text,
  }
}

function extractAssistantText(session: SessionRecord): string {
  const messages = session.runtime.messages
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (!message) continue
    if ((message as { role?: string }).role === "assistant") {
      return extractTextFromContent((message as { content: unknown }).content)
    }
  }
  return ""
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  const textParts = content
    .filter((part: unknown): part is { type: "text"; text: string } => {
      if (!part || typeof part !== "object") return false
      if (!("type" in part) || !("text" in part)) return false
      return (part as { type: string }).type === "text" && typeof (part as { text: string }).text === "string"
    })
    .map((part) => part.text)

  return textParts.join("\n")
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unknown error"
}
