import { homedir } from "node:os"

import type { AgentSession } from "@mariozechner/pi-coding-agent"

import type { MessageWithParts, SessionInfo } from "@/schema"
import { convertAgentMessages } from "@/session/convert"
import { flushSession } from "@/session/persist"
import { createSessionRuntime, resumeSessionRuntime, SessionManager } from "@/session/runtime"
import { log } from "@/util/log"

export type SessionStatus = "idle" | "running"

export type SessionRecord = {
  info: SessionInfo
  /** null until the session runtime is hydrated on first access */
  runtime: AgentSession | null
  /** JSONL file path for resuming (set for persisted sessions) */
  sessionFile: string | null
  messages: MessageWithParts[]
  status: SessionStatus
}

const sessions = new Map<string, SessionRecord>()

/**
 * Map external alias keys (e.g. OpenAI `user` field) to internal session IDs.
 * Used by the OpenAI-compatible endpoint to reuse sessions across requests.
 */
const aliases = new Map<string, string>()

export function getSessionByAlias(alias: string): SessionRecord | undefined {
  const sessionID = aliases.get(alias)
  if (!sessionID) return undefined
  return sessions.get(sessionID)
}

export function setSessionAlias(alias: string, sessionID: string): void {
  aliases.set(alias, sessionID)
}

export function listSessions(): SessionInfo[] {
  return Array.from(sessions.values())
    .map((record) => record.info)
    .sort((a, b) => b.time.updated - a.time.updated)
}

export function getSession(sessionID: string): SessionRecord | undefined {
  return sessions.get(sessionID)
}

/**
 * Hydrate the runtime for a session that was loaded from disk.
 * Converts existing agent messages into MessageWithParts[].
 */
export async function hydrateSession(record: SessionRecord): Promise<void> {
  if (record.runtime) return
  if (!record.sessionFile) {
    throw new Error(`Cannot hydrate session ${record.info.id}: no session file`)
  }

  log.info({ sessionID: record.info.id, path: record.sessionFile }, "session.hydrating")
  const runtime = await resumeSessionRuntime(record.sessionFile)
  record.runtime = runtime

  // Convert existing agent messages into our format
  if (runtime.messages.length > 0) {
    const model = runtime.model
    const converted = convertAgentMessages(
      runtime.messages,
      {
        sessionID: record.info.id,
        parentID: "",
        agent: "pi",
        model: {
          providerID: model?.provider ?? "unknown",
          modelID: model?.id ?? "unknown",
        },
        cwd: record.info.directory,
      },
      true,
    )
    record.messages = converted
  }
  log.info({ sessionID: record.info.id, messages: runtime.messages.length }, "session.hydrated")
}

export async function createSession(input: { title?: string; parentID?: string }): Promise<SessionRecord> {
  const directory = homedir()
  const runtime = await createSessionRuntime()
  const sessionFile = flushSession(runtime.sessionManager)
  if (sessionFile) {
    runtime.sessionManager.setSessionFile(sessionFile)
  }
  const now = Date.now()
  const id = `ses_${runtime.sessionId}`

  const info: SessionInfo = {
    id,
    slug: id,
    projectID: "local",
    directory,
    parentID: input.parentID,
    title: input.title ?? "New session",
    version: "0.1.0",
    time: {
      created: now,
      updated: now,
    },
  }

  const record: SessionRecord = {
    info,
    runtime,
    sessionFile: sessionFile ?? null,
    messages: [],
    status: "idle",
  }

  sessions.set(id, record)
  return record
}

export function updateSession(sessionID: string, input: { title?: string; archived?: number }): SessionRecord | null {
  const record = sessions.get(sessionID)
  if (!record) return null

  if (input.title) {
    record.info.title = input.title
  }
  if (input.archived !== undefined) {
    record.info.time.archived = input.archived
  }

  record.info.time.updated = Date.now()
  return record
}

export function deleteSession(sessionID: string): boolean {
  const record = sessions.get(sessionID)
  if (!record) return false
  record.runtime?.dispose()
  return sessions.delete(sessionID)
}

export function setSessionStatus(sessionID: string, status: SessionStatus): void {
  const record = sessions.get(sessionID)
  if (!record) return
  record.status = status
  record.info.time.updated = Date.now()
}

export function appendMessage(sessionID: string, message: MessageWithParts): void {
  const record = sessions.get(sessionID)
  if (!record) return
  record.messages.push(message)
  record.info.time.updated = Date.now()
}

/**
 * Load all persisted sessions from disk as metadata-only records.
 * Runtimes are hydrated lazily on first access.
 */
export async function loadPersistedSessions(): Promise<void> {
  const cwd = homedir()
  const piSessions = await SessionManager.list(cwd)
  log.info({ count: piSessions.length, cwd }, "sessions.persisted.found")

  for (const piSession of piSessions) {
    const id = `ses_${piSession.id}`

    // Skip if already loaded (e.g. created during this server run)
    if (sessions.has(id)) continue

    const info: SessionInfo = {
      id,
      slug: id,
      projectID: "local",
      directory: piSession.cwd || homedir(),
      title: piSession.name || piSession.firstMessage.slice(0, 80) || "Untitled",
      version: "0.1.0",
      time: {
        created: piSession.created.getTime(),
        updated: piSession.modified.getTime(),
      },
    }

    const record: SessionRecord = {
      info,
      runtime: null,
      sessionFile: piSession.path,
      messages: [],
      status: "idle",
    }

    sessions.set(id, record)
  }

  log.info({ total: sessions.size }, "sessions.loaded")
}
