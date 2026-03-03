import type { MessageWithParts, Part } from "@/schema"
import { Id } from "@/util/id"

type AgentMsg = { role: string; [key: string]: unknown }

export type ConvertCtx = {
  sessionID: string
  parentID: string
  agent: string
  model: { providerID: string; modelID: string }
  cwd: string
}

/**
 * Convert a slice of AgentMessage[] (from pi-coding-agent) into our
 * MessageWithParts[] with full part types (text, thinking, tool-call, tool-result).
 * When `includeUser` is true, user messages are also converted (for session hydration).
 */
export function convertAgentMessages(
  agentMessages: unknown[],
  ctx: ConvertCtx,
  includeUser = false,
): MessageWithParts[] {
  const results: MessageWithParts[] = []
  let lastParentID = ctx.parentID

  for (const raw of agentMessages) {
    const msg = raw as AgentMsg
    const role = msg.role as string

    if (role === "user" && includeUser) {
      const messageID = Id.create("message")
      const text = extractTextFromContent(msg.content)
      if (!text) continue

      results.push({
        info: {
          id: messageID,
          sessionID: ctx.sessionID,
          role: "user",
          time: { created: (msg.timestamp as number) ?? Date.now() },
          agent: ctx.agent,
          model: ctx.model,
        },
        parts: [
          {
            id: Id.create("part"),
            sessionID: ctx.sessionID,
            messageID,
            type: "text",
            text,
          },
        ],
      })
      lastParentID = messageID
    } else if (role === "assistant") {
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
  }

  return results
}

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

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter(
      (part: unknown): part is { type: "text"; text: string } =>
        !!part &&
        typeof part === "object" &&
        "type" in part &&
        "text" in part &&
        (part as { type: string }).type === "text" &&
        typeof (part as { text: string }).text === "string",
    )
    .map((part) => part.text)
    .join("\n")
}

function extractCost(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0
  const cost = usage.cost as Record<string, number> | undefined
  return cost?.total ?? 0
}

function extractTokens(usage: Record<string, unknown> | undefined) {
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
