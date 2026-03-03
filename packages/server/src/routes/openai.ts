import { Hono } from "hono"
import z from "zod"

import type { AgentSession } from "@mariozechner/pi-coding-agent"

import type { MessageWithParts } from "@/schema"
import {
  appendMessage,
  createSession,
  getSessionByAlias,
  hydrateSession,
  setSessionAlias,
  setSessionStatus,
  type SessionRecord,
} from "@/session/store"
import { convertAgentMessages } from "@/session/convert"
import { flushSession } from "@/session/persist"
import { Id } from "@/util/id"
import { log } from "@/util/log"

// ---------------------------------------------------------------------------
// OpenAI Chat Completions request/response types
// ---------------------------------------------------------------------------

const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.null()]).optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
})

const ChatCompletionRequestSchema = z.object({
  model: z.string().default("piclaw"),
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  max_tokens: z.number().optional(),
  max_completion_tokens: z.number().optional(),
  stream: z.boolean().default(false),
  user: z.string().optional(),
  n: z.number().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  // Accept but ignore these
  tools: z.unknown().optional(),
  tool_choice: z.unknown().optional(),
  response_format: z.unknown().optional(),
})

type ChatMessage = z.infer<typeof ChatMessageSchema>

// ---------------------------------------------------------------------------
// Error response helper
// ---------------------------------------------------------------------------

function oaiError(message: string, type: string) {
  return {
    error: {
      message,
      type,
      param: null,
      code: null,
    },
  }
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

function buildCompletion(input: {
  sessionID: string
  model: string
  content: string
  finishReason: string
  usage: { prompt: number; completion: number }
}) {
  return {
    id: `chatcmpl-${input.sessionID}`,
    object: "chat.completion" as const,
    created: Math.floor(Date.now() / 1000),
    model: input.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: input.content,
        },
        finish_reason: input.finishReason,
      },
    ],
    usage: {
      prompt_tokens: input.usage.prompt,
      completion_tokens: input.usage.completion,
      total_tokens: input.usage.prompt + input.usage.completion,
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the last user message content as the prompt text.
 * System messages are collected separately.
 */
function extractPrompt(messages: ChatMessage[]): { system: string | null; prompt: string } {
  const systemParts: string[] = []
  let prompt = ""

  for (const msg of messages) {
    if (msg.role === "system" && msg.content) {
      systemParts.push(msg.content)
    }
  }

  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role === "user" && msg.content) {
      prompt = msg.content
      break
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : null,
    prompt,
  }
}

/**
 * Extract text content and token usage from the agent's response messages.
 */
function extractResponse(messages: MessageWithParts[]): {
  content: string
  tokens: { input: number; output: number }
} {
  const textParts: string[] = []
  let inputTokens = 0
  let outputTokens = 0

  for (const msg of messages) {
    if (msg.info.role === "assistant") {
      const info = msg.info
      if ("tokens" in info) {
        inputTokens += info.tokens.input
        outputTokens += info.tokens.output
      }
    }

    for (const part of msg.parts) {
      if (part.type === "text") {
        textParts.push(part.text)
      }
    }
  }

  return {
    content: textParts.join("\n\n"),
    tokens: { input: inputTokens, output: outputTokens },
  }
}

/**
 * Resolve or create a session for the request.
 * If `alias` is provided, try to reuse an existing session mapped to that alias.
 * Otherwise create a new session every time.
 */
async function resolveSession(alias: string | undefined): Promise<SessionRecord> {
  if (alias) {
    const existing = getSessionByAlias(alias)
    if (existing) {
      log.info({ alias, sessionID: existing.info.id }, "openai.session.reused")
      return existing
    }
  }

  const record = await createSession({ title: "OpenAI API" })
  log.info({ sessionID: record.info.id, alias }, "openai.session.created")

  if (alias) {
    setSessionAlias(alias, record.info.id)
  }

  return record
}

async function requireRuntime(record: SessionRecord): Promise<AgentSession> {
  await hydrateSession(record)
  return record.runtime!
}

function resolveModelRef(runtime: AgentSession): { providerID: string; modelID: string } {
  const model = runtime.model
  if (!model) return { providerID: "unknown", modelID: "unknown" }
  return { providerID: model.provider, modelID: model.id }
}

function modelName(runtime: AgentSession): string {
  const model = runtime.model
  if (!model) return "unknown"
  return `${model.provider}/${model.id}`
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function OpenAIRoutes() {
  return new Hono()
    .get("/v1/models", async (c) => {
      return c.json({
        object: "list",
        data: [
          {
            id: "piclaw",
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "piclaw",
          },
        ],
      })
    })
    .post("/v1/chat/completions", async (c) => {
      let body: z.infer<typeof ChatCompletionRequestSchema>
      try {
        const raw = await c.req.json()
        body = ChatCompletionRequestSchema.parse(raw)
      } catch (err) {
        return c.json(
          oaiError(
            `Invalid request body: ${err instanceof Error ? err.message : "parse error"}`,
            "invalid_request_error",
          ),
          400,
        )
      }

      if (body.stream) {
        return c.json(
          oaiError("Streaming is not supported yet. Set stream: false or omit it.", "invalid_request_error"),
          400,
        )
      }

      const { system, prompt } = extractPrompt(body.messages)
      if (!prompt) {
        return c.json(oaiError("No user message found in messages array.", "invalid_request_error"), 400)
      }

      // Resolve session (use `user` field or X-Session-ID header as alias)
      const alias = body.user || c.req.header("x-session-id") || undefined
      let session: SessionRecord
      try {
        session = await resolveSession(alias)
      } catch (err) {
        log.error({ err }, "openai.session.resolve.failed")
        return c.json(
          oaiError(`Failed to create session: ${err instanceof Error ? err.message : "unknown"}`, "server_error"),
          500,
        )
      }

      if (session.status === "running") {
        return c.json(
          oaiError("Session is currently processing another request. Try again later.", "server_error"),
          409,
        )
      }

      const runtime = await requireRuntime(session)
      const sessionID = session.info.id
      const modelRef = resolveModelRef(runtime)

      // Build and append user message to our internal store
      const userMessageId = Id.create("message")
      const userMessage: MessageWithParts = {
        info: {
          id: userMessageId,
          sessionID,
          role: "user",
          time: { created: Date.now() },
          agent: "pi",
          model: modelRef,
          system: system ?? undefined,
        },
        parts: [
          {
            id: Id.create("part"),
            sessionID,
            messageID: userMessageId,
            type: "text",
            text: prompt,
          },
        ],
      }

      // Auto-title from first message
      const isFirstMessage = session.messages.length === 0
      appendMessage(sessionID, userMessage)

      if (isFirstMessage) {
        const firstLine = prompt.split("\n")[0] ?? prompt
        const title = firstLine.trim().slice(0, 80) || "OpenAI API"
        session.info.title = title
        session.info.time.updated = Date.now()
        runtime.sessionManager.appendSessionInfo(title)
      }

      // Run the agent
      setSessionStatus(sessionID, "running")
      try {
        const messagesBefore = runtime.messages.length
        await runtime.prompt(prompt)

        const currentModelRef = resolveModelRef(runtime)
        const newAgentMessages = runtime.messages.slice(messagesBefore)
        const converted = convertAgentMessages(newAgentMessages, {
          sessionID,
          parentID: userMessageId,
          agent: "pi",
          model: currentModelRef,
          cwd: session.info.directory,
        })

        for (const msg of converted) {
          appendMessage(sessionID, msg)
        }

        // Persist
        const sessionFile = flushSession(runtime.sessionManager)
        if (sessionFile && !session.sessionFile) {
          runtime.sessionManager.setSessionFile(sessionFile)
          session.sessionFile = sessionFile
        }

        // Build OpenAI-format response
        const { content, tokens } = extractResponse(converted)
        const model = modelName(runtime)

        log.info({ sessionID, model, tokens, contentLength: content.length }, "openai.completion.done")

        return c.json(
          buildCompletion({
            sessionID,
            model,
            content: content || "",
            finishReason: "stop",
            usage: { prompt: tokens.input, completion: tokens.output },
          }),
        )
      } catch (err) {
        log.error({ sessionID, err }, "openai.completion.failed")
        return c.json(oaiError(`Agent error: ${err instanceof Error ? err.message : "unknown"}`, "server_error"), 500)
      } finally {
        setSessionStatus(sessionID, "idle")
      }
    })
}
