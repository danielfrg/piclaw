import type { AgentSession } from "@mariozechner/pi-coding-agent"

import type { MessageWithParts, SessionInfo } from "@/schema"
import { flushSession } from "@/session/persist"
import { createSessionRuntime } from "@/session/runtime"

export type SessionStatus = "idle" | "running"

export type SessionRecord = {
  info: SessionInfo
  runtime: AgentSession
  messages: MessageWithParts[]
  status: SessionStatus
}

const sessions = new Map<string, SessionRecord>()

export function listSessions(): SessionInfo[] {
  return Array.from(sessions.values())
    .map((record) => record.info)
    .sort((a, b) => b.time.updated - a.time.updated)
}

export function getSession(sessionID: string): SessionRecord | undefined {
  return sessions.get(sessionID)
}

export async function createSession(input: {
  title?: string
  parentID?: string
  directory?: string
}): Promise<SessionRecord> {
  const directory = input.directory ?? process.cwd()
  const runtime = await createSessionRuntime(directory)
  const sessionFile = flushSession(runtime.sessionManager)
  if (sessionFile) {
    // Reload from disk to mark the session as flushed.
    // Without this, the first assistant message would bulk-write entries again.
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
