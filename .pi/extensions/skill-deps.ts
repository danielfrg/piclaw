/**
 * Skill dependency auto-install extension for pi.
 *
 * Intercepts `read` tool calls for SKILL.md files, parses the `requires`
 * frontmatter field, and installs missing CLI dependencies before the
 * read proceeds.
 *
 * SKILL.md frontmatter format:
 *   ---
 *   name: my-skill
 *   description: ...
 *   requires:
 *     - command: mdvector
 *       install: "uv tool install mdvector"
 *     - command: qdrant
 *       optional: true
 *   ---
 *
 * Drop this file into ~/.pi/agent/extensions/ or .pi/extensions/ and pi
 * will auto-discover it on startup.
 */

import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"

interface SkillRequirement {
  command: string
  install?: string
  optional?: boolean
}

function parseRequires(filepath: string): SkillRequirement[] {
  let content: string
  try {
    content = readFileSync(filepath, "utf-8")
  } catch {
    return []
  }

  // Extract frontmatter between --- markers
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match?.[1]) return []

  const lines = match[1].split("\n")

  // Walk lines to find "requires:" then collect indented list items
  let inRequires = false
  const requires: SkillRequirement[] = []
  let current: SkillRequirement | null = null

  for (const line of lines) {
    // Top-level key (no leading whitespace) -- either enters or exits "requires:"
    if (/^\S/.test(line)) {
      if (line.startsWith("requires:")) {
        inRequires = true
        continue
      }
      if (inRequires) break
      continue
    }

    if (!inRequires) continue

    // List item start: "  - key: value"
    const itemStart = line.match(/^\s+-\s+(\w+):\s*(.+)$/)
    if (itemStart) {
      if (current?.command) requires.push(current)
      current = { command: "" }
      const key = itemStart[1]
      const value = itemStart[2]?.replace(/^["']|["']$/g, "") ?? ""
      if (key === "command") current.command = value
      else if (key === "install") current.install = value
      else if (key === "optional") current.optional = value === "true"
      continue
    }

    // Continuation line: "    key: value"
    if (current) {
      const kv = line.match(/^\s+(\w+):\s*(.+)$/)
      if (kv) {
        const key = kv[1]
        const value = kv[2]?.replace(/^["']|["']$/g, "") ?? ""
        if (key === "command") current.command = value
        else if (key === "install") current.install = value
        else if (key === "optional") current.optional = value === "true"
      }
    }
  }

  // Push last item
  if (current?.command) requires.push(current)

  return requires
}

function commandExists(command: string): boolean {
  try {
    if (typeof Bun !== "undefined") return Bun.which(command) !== null
    execSync(`which ${command}`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

const checked = new Set<string>()

export default function (pi: any) {
  pi.on("tool_call", async (event: any) => {
    if (event.toolName !== "read") return

    const path = event.input?.path as string | undefined
    if (!path) return
    if (!path.endsWith("SKILL.md") && !path.endsWith(".md")) return
    if (checked.has(path)) return

    checked.add(path)

    const requires = parseRequires(path)
    if (requires.length === 0) return

    console.error(`[skill-deps] checking ${requires.length} deps for ${path}`)

    for (const dep of requires) {
      if (commandExists(dep.command)) continue

      if (dep.optional) {
        console.error(`[skill-deps] optional dep missing: ${dep.command}`)
        continue
      }

      if (!dep.install) {
        console.error(`[skill-deps] required dep missing (no install command): ${dep.command}`)
        continue
      }

      console.error(`[skill-deps] installing: ${dep.install}`)
      try {
        execSync(dep.install, { stdio: "pipe", timeout: 120_000 })
        console.error(`[skill-deps] installed: ${dep.command}`)
      } catch (err) {
        console.error(`[skill-deps] install failed for ${dep.command}: ${err}`)
      }
    }
  })
}
