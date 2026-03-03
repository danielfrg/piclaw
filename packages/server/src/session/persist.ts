import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { FileEntry, SessionManager } from "@mariozechner/pi-coding-agent"

export function flushSession(sessionManager: SessionManager): string | undefined {
  // Persist a brand-new session immediately so it can be listed and resumed over REST.
  // SessionManager normally waits for the first assistant message before writing.
  if (!sessionManager.isPersisted()) return undefined

  const sessionFile = sessionManager.getSessionFile()
  if (!sessionFile) return undefined

  const header = sessionManager.getHeader()
  if (!header) return undefined

  mkdirSync(dirname(sessionFile), { recursive: true })

  const entries: FileEntry[] = [header, ...sessionManager.getEntries()]
  const content = `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`
  writeFileSync(sessionFile, content)

  return sessionFile
}
