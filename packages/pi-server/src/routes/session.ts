import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { describeRoute, resolver, validator } from "hono-openapi"
import type { OpenAPIV3_1 } from "openapi-types"
import z from "zod"

import {
  CapabilitiesSchema,
  MessageWithPartsSchema,
  ModelRefSchema,
  PromptInputSchema,
  SessionConfigSchema,
  SessionConfigUpdateSchema,
  SessionCreateInputSchema,
  SessionSchema,
  SessionUpdateInputSchema,
  StreamEventSchema,
  type Capabilities,
  type MessageWithParts,
  type SessionConfig,
  type StreamEvent,
} from "@/schema"
import type { AgentSession, AgentSessionEvent } from "@mariozechner/pi-coding-agent"

import {
  appendMessage,
  createSession,
  deleteSession,
  getSession,
  hydrateSession,
  listSessions,
  setSessionStatus,
  updateSession,
  type SessionRecord,
} from "@/session/store"
import { convertAgentMessages } from "@/session/convert"
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
        // Hydrate resumed sessions so their messages are loaded from disk
        if (session.messages.length === 0 && session.sessionFile) {
          await hydrateSession(session)
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

        const runtime = await requireRuntime(session)
        const modelRef = resolveModelRef(runtime)
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
        // Derive title from first prompt on new sessions
        const isFirstMessage = session.messages.length === 0
        appendMessage(sessionID, userMessage)

        if (isFirstMessage) {
          const firstLine = promptText.split("\n")[0] ?? promptText
          const title = firstLine.trim().slice(0, 80) || "Untitled"
          session.info.title = title
          session.info.time.updated = Date.now()
          runtime.sessionManager.appendSessionInfo(title)
          log.info({ sessionID, title }, "session.title.derived")
        }

        if (input.noReply) {
          log.info({ sessionID, messageID: userMessageId }, "session.prompt.no_reply")
          // Persist user-only messages immediately for REST usage without waiting on the agent.
          // SessionManager only writes after an assistant message by default.
          const sessionManager = runtime.sessionManager
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
            await setSessionModel(runtime, input.model)
          }
          log.info(
            {
              sessionID,
              model: runtime.model ? { providerID: runtime.model.provider, modelID: runtime.model.id } : null,
            },
            "session.prompt.model",
          )
          // Snapshot message count before prompting so we can extract new messages after.
          const messagesBefore = runtime.messages.length
          await runtime.prompt(promptText)

          const currentModelRef = resolveModelRef(runtime)
          const newAgentMessages = runtime.messages.slice(messagesBefore)
          const converted = convertAgentMessages(newAgentMessages, {
            sessionID,
            parentID: userMessageId,
            agent: agentName,
            model: currentModelRef,
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
      "/:sessionID/message/stream",
      describeRoute({
        summary: "Send message (streaming)",
        description:
          "Send a message and stream the assistant response as SSE events including text deltas, thinking deltas, tool calls, and tool execution updates.",
        operationId: "session.promptStream",
        requestBody: {
          content: {
            "application/json": {
              schema: asOpenApiSchema(PromptInputSchema),
            },
          },
        },
        responses: {
          200: {
            description: "Event stream",
            content: {
              "text/event-stream": {
                schema: asOpenApiSchema(StreamEventSchema),
              },
            },
          },
          400: { description: "Bad request" },
          404: { description: "Session not found" },
          409: { description: "Session already running" },
        },
      }),
      validator("param", sessionParamSchema),
      validator("json", PromptInputSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const input = c.req.valid("json")
        const session = getSession(sessionID)
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        if (session.status === "running") {
          return c.json({ error: "Session already running" }, 409)
        }

        const promptText = extractPromptText(input)
        if (!promptText) {
          return c.json({ error: "Prompt text is required" }, 400)
        }

        const runtime = await requireRuntime(session)
        const modelRef = resolveModelRef(runtime)
        const userMessageId = input.messageID ?? Id.create("message")
        const agentName = input.agent ?? "pi"
        log.info({ sessionID, messageID: userMessageId, agent: agentName, model: modelRef }, "session.prompt.stream")
        const userMessage = buildUserMessage({
          sessionID,
          messageID: userMessageId,
          agent: agentName,
          model: modelRef,
          text: promptText,
        })

        const isFirstMessage = session.messages.length === 0
        appendMessage(sessionID, userMessage)

        if (isFirstMessage) {
          const firstLine = promptText.split("\n")[0] ?? promptText
          const title = firstLine.trim().slice(0, 80) || "Untitled"
          session.info.title = title
          session.info.time.updated = Date.now()
          runtime.sessionManager.appendSessionInfo(title)
          log.info({ sessionID, title }, "session.title.derived")
        }

        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")

        return streamSSE(c, async (stream) => {
          setSessionStatus(sessionID, "running")

          // Track current message ID for delta events
          let currentMessageId = ""

          const unsubscribe = runtime.subscribe((event: AgentSessionEvent) => {
            const sseEvent = mapAgentEventToSSE(event, currentMessageId)
            if (!sseEvent) return

            // Track the message ID from message_start events
            if (event.type === "message_start" && event.message?.role === "assistant") {
              currentMessageId = Id.create("message")
            }

            void stream.writeSSE({
              event: sseEvent.type,
              data: JSON.stringify(sseEvent),
            })
          })

          // Heartbeat to keep connection alive
          const heartbeat = setInterval(() => {
            void stream.writeSSE({
              event: "heartbeat",
              data: "{}",
            })
          }, 10_000)

          try {
            if (input.model) {
              await setSessionModel(runtime, input.model)
            }

            const messagesBefore = runtime.messages.length
            await runtime.prompt(promptText)

            const currentModelRef = resolveModelRef(runtime)
            const newAgentMessages = runtime.messages.slice(messagesBefore)
            const converted = convertAgentMessages(newAgentMessages, {
              sessionID,
              parentID: userMessageId,
              agent: agentName,
              model: currentModelRef,
              cwd: session.info.directory,
            })
            for (const msg of converted) {
              appendMessage(sessionID, msg)
            }

            const finalEvent: StreamEvent = {
              type: "final",
              messages: converted,
            }
            await stream.writeSSE({
              event: "final",
              data: JSON.stringify(finalEvent),
            })
            log.info({ sessionID, count: converted.length }, "session.prompt.stream.completed")
          } catch (error) {
            const errorEvent: StreamEvent = {
              type: "error",
              error: errorMessage(error),
            }
            await stream.writeSSE({
              event: "error",
              data: JSON.stringify(errorEvent),
            })
            log.error({ sessionID, error }, "session.prompt.stream.failed")
          } finally {
            clearInterval(heartbeat)
            unsubscribe()
            setSessionStatus(sessionID, "idle")
          }
        })
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
        if (!session.runtime) {
          return c.json({ error: "Session has no active runtime to abort" }, 400)
        }
        await session.runtime.abort()
        setSessionStatus(sessionID, "idle")
        return c.json(true)
      },
    )
    .get(
      "/:sessionID/config",
      describeRoute({
        summary: "Get session config",
        description: "Get current model and thinking level for a session.",
        operationId: "session.config",
        responses: {
          200: {
            description: "Session config",
            content: {
              "application/json": {
                schema: asOpenApiSchema(SessionConfigSchema),
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
        if (!session.runtime) {
          return c.json({ error: "Session has no runtime (read-only)" }, 400)
        }

        const model = session.runtime.model
        const config: SessionConfig = {
          model: model
            ? {
                provider: model.provider,
                id: model.id,
                name: model.name,
                reasoning: model.reasoning,
              }
            : null,
          thinkingLevel: session.runtime.thinkingLevel,
          availableThinkingLevels: session.runtime.getAvailableThinkingLevels(),
          supportsThinking: session.runtime.supportsThinking(),
        }

        return c.json(config)
      },
    )
    .patch(
      "/:sessionID/config",
      describeRoute({
        summary: "Update session config",
        description: "Change model and/or thinking level for a session.",
        operationId: "session.updateConfig",
        requestBody: {
          content: {
            "application/json": {
              schema: asOpenApiSchema(SessionConfigUpdateSchema),
            },
          },
        },
        responses: {
          200: {
            description: "Updated session config",
            content: {
              "application/json": {
                schema: asOpenApiSchema(SessionConfigSchema),
              },
            },
          },
          400: {
            description: "Bad request",
          },
          404: {
            description: "Session not found",
          },
        },
      }),
      validator("param", sessionParamSchema),
      validator("json", SessionConfigUpdateSchema),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const input = c.req.valid("json")
        const session = getSession(sessionID)
        if (!session) {
          return c.json({ error: "Session not found" }, 404)
        }
        if (!session.runtime) {
          return c.json({ error: "Session has no runtime (read-only)" }, 400)
        }

        if (input.provider && input.modelId) {
          const available = session.runtime.modelRegistry.getAvailable()
          const model = available.find((m) => m.provider === input.provider && m.id === input.modelId)
          if (!model) {
            return c.json({ error: `Model not found: ${input.provider}/${input.modelId}` }, 400)
          }
          try {
            await session.runtime.setModel(model)
            log.info({ sessionID, provider: input.provider, modelId: input.modelId }, "session.config.model_changed")
          } catch (error) {
            return c.json({ error: errorMessage(error) }, 400)
          }
        }

        if (input.thinkingLevel) {
          session.runtime.setThinkingLevel(input.thinkingLevel)
          log.info({ sessionID, thinkingLevel: input.thinkingLevel }, "session.config.thinking_changed")
        }

        const model = session.runtime.model
        const config: SessionConfig = {
          model: model
            ? {
                provider: model.provider,
                id: model.id,
                name: model.name,
                reasoning: model.reasoning,
              }
            : null,
          thinkingLevel: session.runtime.thinkingLevel,
          availableThinkingLevels: session.runtime.getAvailableThinkingLevels(),
          supportsThinking: session.runtime.supportsThinking(),
        }

        return c.json(config)
      },
    )
    .get(
      "/:sessionID/capabilities",
      describeRoute({
        summary: "Get session capabilities",
        description: "Get loaded skills and tools for a session.",
        operationId: "session.capabilities",
        responses: {
          200: {
            description: "Session capabilities",
            content: {
              "application/json": {
                schema: asOpenApiSchema(CapabilitiesSchema),
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

        const runtime = await requireRuntime(session)
        const { skills } = runtime.resourceLoader.getSkills()
        const allTools = runtime.getAllTools()

        const capabilities: Capabilities = {
          skills: skills.map((s) => ({
            name: s.name,
            description: s.description,
            source: s.source,
          })),
          tools: allTools.map((t) => ({
            name: t.name,
            description: t.description,
          })),
        }

        return c.json(capabilities)
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

/**
 * Ensure a session's runtime is hydrated and return the non-null runtime.
 * Call this before any handler code that needs session.runtime.
 */
async function requireRuntime(record: SessionRecord): Promise<AgentSession> {
  await hydrateSession(record)
  return record.runtime!
}

function resolveModelRef(runtime: AgentSession): z.infer<typeof ModelRefSchema> {
  const model = runtime.model
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

async function setSessionModel(runtime: AgentSession, model: z.infer<typeof ModelRefSchema>): Promise<void> {
  const resolved = runtime.modelRegistry.find(model.providerID, model.modelID)
  if (!resolved) {
    throw new Error(`Unknown model ${model.providerID}/${model.modelID}`)
  }
  await runtime.setModel(resolved)
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Unknown error"
}

/**
 * Map an AgentSessionEvent to a StreamEvent for SSE.
 * Returns null for events we don't stream (agent_start, turn_start, etc).
 */
function mapAgentEventToSSE(event: AgentSessionEvent, messageId: string): StreamEvent | null {
  switch (event.type) {
    case "message_update": {
      const sub = event.assistantMessageEvent
      switch (sub.type) {
        case "text_delta":
          return {
            type: "text-delta",
            messageID: messageId,
            contentIndex: sub.contentIndex,
            delta: sub.delta,
          }
        case "thinking_delta":
          return {
            type: "thinking-delta",
            messageID: messageId,
            contentIndex: sub.contentIndex,
            delta: sub.delta,
          }
        case "toolcall_start":
          return null
        case "toolcall_delta":
          return {
            type: "tool-call-delta",
            messageID: messageId,
            contentIndex: sub.contentIndex,
            delta: sub.delta,
          }
        case "toolcall_end":
          return {
            type: "tool-call-end",
            messageID: messageId,
            toolCallId: sub.toolCall.id,
            toolName: sub.toolCall.name,
          }
        default:
          return null
      }
    }
    case "tool_execution_start":
      return {
        type: "tool-exec-start",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args as Record<string, unknown>,
      }
    case "tool_execution_update":
      return {
        type: "tool-exec-update",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.partialResult,
      }
    case "tool_execution_end":
      return {
        type: "tool-exec-end",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        error: event.isError,
      }
    default:
      return null
  }
}
