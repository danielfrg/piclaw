import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"

import type { ExtensionFactory } from "@mariozechner/pi-coding-agent"

import { log } from "@/util/log"

export interface SkillRequirement {
  command: string
  install?: string
  optional?: boolean
}

/**
 * Parse the YAML frontmatter from a SKILL.md file and extract the `requires` array.
 *
 * Frontmatter format:
 * ---
 * name: skill-name
 * requires:
 *   - command: foo
 *     install: "brew install foo"
 *   - command: bar
 *     optional: true
 * ---
 */
export function parseRequires(filepath: string): SkillRequirement[] {
  let content: string
  try {
    content = readFileSync(filepath, "utf-8")
  } catch {
    return []
  }

  return parseRequiresFromContent(content)
}

/** Parse the `requires` array from raw SKILL.md content. */
export function parseRequiresFromContent(content: string): SkillRequirement[] {
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
      // Any other top-level key ends the requires block
      if (inRequires) break
      continue
    }

    if (!inRequires) continue

    // List item start: "  - key: value"
    const itemStart = line.match(/^\s+-\s+(\w+):\s*(.+)$/)
    if (itemStart) {
      // Push previous item
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

/** Check if a command exists on the system. */
function commandExists(command: string): boolean {
  try {
    // Bun.which is available in Bun, fall back to which for Node
    if (typeof Bun !== "undefined") {
      return Bun.which(command) !== null
    }
    execSync(`which ${command}`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/**
 * Install missing skill dependencies from a parsed `requires` array.
 * Returns an array of results for each dependency.
 */
export function installDeps(
  requires: SkillRequirement[],
  opts?: { skill?: string },
): Array<{ command: string; status: "found" | "installed" | "failed" | "missing" | "skipped" }> {
  const results: Array<{ command: string; status: "found" | "installed" | "failed" | "missing" | "skipped" }> = []

  for (const dep of requires) {
    if (commandExists(dep.command)) {
      results.push({ command: dep.command, status: "found" })
      continue
    }

    if (dep.optional) {
      log.warn({ command: dep.command, skill: opts?.skill }, "skill.dep.optional.missing")
      results.push({ command: dep.command, status: "skipped" })
      continue
    }

    if (!dep.install) {
      log.warn({ command: dep.command, skill: opts?.skill }, "skill.dep.missing")
      results.push({ command: dep.command, status: "missing" })
      continue
    }

    log.info({ command: dep.command, install: dep.install, skill: opts?.skill }, "skill.dep.installing")
    try {
      execSync(dep.install, { stdio: "pipe", timeout: 120_000 })
      log.info({ command: dep.command }, "skill.dep.installed")
      results.push({ command: dep.command, status: "installed" })
    } catch (err) {
      log.error(
        { command: dep.command, error: err instanceof Error ? err.message : String(err) },
        "skill.dep.install.failed",
      )
      results.push({ command: dep.command, status: "failed" })
    }
  }

  return results
}

/** Track already-checked skill files to avoid re-checking on every read. */
const checked = new Set<string>()

/**
 * Extension factory that intercepts `read` tool calls for SKILL.md files.
 *
 * When the LLM reads a skill, this parses the frontmatter for a `requires`
 * array and installs any missing dependencies before the read proceeds.
 *
 * Follows the pi-mom pattern: tools are installed on-demand, not at startup.
 */
export const skillDepsExtension: ExtensionFactory = (pi) => {
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "read") return

    const path = (event.input as { path: string }).path
    if (!path.endsWith("SKILL.md") && !path.endsWith(".md")) return
    if (checked.has(path)) return

    checked.add(path)

    const requires = parseRequires(path)
    if (requires.length === 0) return

    log.info({ skill: path, deps: requires.length }, "skill.deps.checking")
    installDeps(requires, { skill: path })

    // Never block -- let the read proceed
  })
}
